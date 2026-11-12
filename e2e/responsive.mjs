// Responsive sweep: visits every page at multiple screen sizes (mobile, tablet,
// laptop, desktop), checks for layout breakage (horizontal overflow, missing
// content, uncaught JS errors) and screenshots each combination.
//
// Usage: npm run e2e:responsive   (or: node e2e/responsive.mjs [outDir])
// Output: e2e-reports/responsive-<stamp>/ with per-viewport folders, results.json
// and index.html (matrix report).
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const BASE = process.env.E2E_BASE_URL || "http://localhost:3000";
const OUT = process.argv[2] || `e2e-reports/responsive-${new Date().toISOString().slice(0, 19).replace("T", "_").replace(/:/g, "-")}`;
fs.mkdirSync(OUT, { recursive: true });

const stamp = Date.now().toString(36);
const owner = { name: "Responsive Tester", email: `resp-${stamp}@bookly.dev`, password: "testpass123" };
const biz = { name: "Responsive Studio", slug: `resp-studio-${stamp}`, description: "Layout sweep across every screen size" };

const VIEWPORTS = [
  { id: "mobile-s", label: "Mobile S (360×800)", width: 360, height: 800, dsf: 2 },
  { id: "mobile-m", label: "Mobile M (390×844)", width: 390, height: 844, dsf: 2 },
  { id: "mobile-l", label: "Mobile L (414×896)", width: 414, height: 896, dsf: 2 },
  { id: "ipad-mini", label: "iPad Mini (768×1024)", width: 768, height: 1024, dsf: 2 },
  { id: "ipad-pro", label: "iPad Pro 11″ (834×1194)", width: 834, height: 1194, dsf: 2 },
  { id: "laptop", label: "Laptop (1280×800)", width: 1280, height: 800, dsf: 1 },
  { id: "laptop-l", label: "Laptop L (1440×900)", width: 1440, height: 900, dsf: 1 },
  { id: "desktop", label: "Desktop (1920×1080)", width: 1920, height: 1080, dsf: 1 },
];

// ---------------------------------------------------------------------------
// 1. Ensure dev server is running
// ---------------------------------------------------------------------------
async function waitForServer(timeoutMs = 90_000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try {
      const r = await fetch(BASE);
      if (r.ok || r.status < 500) return true;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

let devProc = null;
if (!(await waitForServer(3000))) {
  console.log("▶ Dev server not running — starting npm run dev …");
  devProc = spawn("npm", ["run", "dev"], { detached: true, stdio: "ignore" });
  process.on("exit", () => { try { process.kill(-devProc.pid); } catch {} });
  if (!(await waitForServer())) {
    console.error("✗ Dev server did not come up on", BASE);
    process.exit(1);
  }
  await waitForServer(15_000); // first compile
}

// ---------------------------------------------------------------------------
// 2. Seed test data through the API (fresh per run — never collides)
// ---------------------------------------------------------------------------
let cookieValue = "";
async function api(method, url, body) {
  const res = await fetch(BASE + url, {
    method,
    headers: { "Content-Type": "application/json", ...(cookieValue ? { Cookie: `session=${cookieValue}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const setCookie = res.headers.getSetCookie?.().join(";") || "";
  const m = setCookie.match(/session=([^;]+)/);
  if (m) cookieValue = m[1];
  return res;
}

console.log("▶ Seeding test data via API …");
let r = await api("POST", "/api/auth/signup", owner);
if (!r.ok && r.status !== 409) throw new Error(`signup failed: ${r.status} ${await r.text()}`);
if (r.status === 409) { // already exists from an earlier attempt — log in
  r = await api("POST", "/api/auth/login", { email: owner.email, password: owner.password });
  if (!r.ok) throw new Error("login failed");
}

r = await api("POST", "/api/businesses", { ...biz, slotDuration: 30 });
if (!r.ok) throw new Error(`business create failed: ${r.status}`);
const { business } = await r.json();

await api("PUT", `/api/businesses/${business.id}/hours`,
  [1, 2, 3].map((d) => ({ dayOfWeek: d, startTime: "09:00", endTime: "17:00" })));

r = await api("POST", `/api/businesses/${business.id}/services`, { name: "Piano Lesson", durationMin: 45, price: "$50" });
const { service: svc } = await r.json();
await api("POST", `/api/businesses/${business.id}/services`, { name: "Guitar Lesson", durationMin: 30, price: "$40" });

// first date within 14 days that has open slots
let slotDate = "";
let firstSlot = "";
for (let i = 0; i < 14 && !slotDate; i++) {
  const iso = new Date(Date.now() + i * 86400_000).toISOString().slice(0, 10);
  const sr = await api("GET", `/api/public/business/${biz.slug}/slots?date=${iso}`);
  const slots = (await sr.json()).slots || [];
  if (slots.length) { slotDate = iso; firstSlot = slots[0].start; }
}
if (!slotDate) throw new Error("no bookable date found");

// one booking so the dashboard has content
await api("POST", "/api/public/bookings", {
  slug: biz.slug, serviceId: svc.id,
  customerName: "Layout Check", customerEmail: `layout-${stamp}@bookly.dev`, customerPhone: "+1 555 0100",
  startTime: firstSlot,
});
console.log(`  ✓ business ${biz.slug} ready — slot date ${slotDate}`);

// ---------------------------------------------------------------------------
// 3. Page definitions
// ---------------------------------------------------------------------------
const PAGES = [
  { id: "home", name: "Landing page", url: "/", ready: (p) => p.locator("header").getByText("Bookly").waitFor({ timeout: 10_000 }) },
  { id: "signup", name: "Signup", url: "/signup", ready: (p) => p.getByRole("heading", { name: "Create your account" }).waitFor({ timeout: 10_000 }) },
  { id: "login", name: "Login", url: "/login", ready: (p) => p.getByRole("heading", { name: "Welcome back" }).waitFor({ timeout: 10_000 }) },
  {
    id: "book", name: "Public booking page", url: `/book/${biz.slug}`,
    ready: async (p) => {
      await p.getByRole("heading", { name: biz.name }).waitFor({ timeout: 10_000 });
      // fill the date so slots render (retry: the first fill can race hydration)
      const input = p.locator('input[type="date"]');
      for (let i = 0; i < 5; i++) {
        await input.fill("");
        await input.fill(slotDate);
        try { await p.locator("main .grid button").filter({ hasText: ":" }).first().waitFor({ timeout: 4000, state: "visible" }); return; } catch { /* retry */ }
      }
      throw new Error("slots never appeared");
    },
  },
  {
    id: "dashboard-bookings", name: "Dashboard · bookings", url: "/dashboard",
    ready: (p) => p.locator("ul li", { hasText: `layout-${stamp}@bookly.dev` }).first().waitFor({ timeout: 10_000 }),
  },
  {
    id: "dashboard-services", name: "Dashboard · services", url: "/dashboard",
    ready: async (p) => {
      await p.locator('nav button:has-text("services")').click();
      await p.locator("ul li", { hasText: "Piano Lesson" }).first().waitFor({ timeout: 10_000 });
    },
  },
];

// ---------------------------------------------------------------------------
// 4. Sweep every viewport × page
// ---------------------------------------------------------------------------
const results = [];
const browser = await chromium.launch();
let done = 0;
const total = VIEWPORTS.length * PAGES.length;

for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: vp.dsf,
  });
  await ctx.addCookies([{ name: "session", value: cookieValue, domain: "localhost", path: "/" }]);
  const page = await ctx.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });

  const dir = path.join(OUT, vp.id);
  fs.mkdirSync(dir, { recursive: true });

  for (const pg of PAGES) {
    const cell = { viewport: vp.id, viewportLabel: vp.label, page: pg.id, pageName: pg.name, status: "PASS", overflowPx: 0, issues: [] };
    try {
      await page.goto(BASE + pg.url, { waitUntil: "domcontentloaded" });
      await pg.ready(page);

      // theme toggle must be reachable on every screen size
      const toggle = page.locator('[aria-label*="mode"]');
      if (!(await toggle.first().isVisible().catch(() => false)))
        cell.issues.push("theme toggle not visible");

      // no horizontal overflow
      const m = await page.evaluate(() => {
        const de = document.documentElement;
        return { iw: window.innerWidth, sw: Math.max(de.scrollWidth, document.body.scrollWidth) };
      });
      cell.overflowPx = Math.max(0, m.sw - m.iw);
      if (cell.overflowPx > 1) cell.issues.push(`horizontal overflow: content is ${cell.overflowPx}px wider than the ${vp.width}px viewport`);

      if (pageErrors.length) cell.issues.push(`uncaught JS error: ${pageErrors[0]}`);

      if (cell.issues.length) cell.status = "FAIL";
    } catch (e) {
      cell.status = "FAIL";
      cell.issues.push(`render/interaction problem: ${String(e).split("\n")[0].slice(0, 160)}`);
    }
    const shot = path.join(vp.id, `${pg.id}.png`);
    await page.screenshot({ path: path.join(OUT, shot), fullPage: true }).catch(() => {});
    cell.shot = shot;
    results.push(cell);
    done++;
    console.log(`  [${String(done).padStart(2)}/${total}] ${vp.label.padEnd(24)} ${pg.name.padEnd(24)} ${cell.status}${cell.issues.length ? " — " + cell.issues[0] : ""}`);
  }
  await ctx.close();
}
await browser.close();

fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify({ base: BASE, business: biz, generated: new Date().toISOString(), results }, null, 2));

// ---------------------------------------------------------------------------
// 5. HTML report
// ---------------------------------------------------------------------------
const failed = results.filter((c) => c.status === "FAIL").length;
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const badge = (c) => c.status === "PASS"
  ? '<span class="badge pass">PASS</span>'
  : `<span class="badge fail" title="${esc(c.issues.join(" · "))}">FAIL</span>`;

const matrixRows = PAGES.map((pg) => {
  const cells = VIEWPORTS.map((vp) => {
    const c = results.find((r) => r.viewport === vp.id && r.page === pg.id);
    return `<td class="${c.status === "PASS" ? "ok" : "bad"}">${badge(c)}</td>`;
  }).join("");
  return `<tr><td>${esc(pg.name)}</td>${cells}</tr>`;
}).join("");

const sections = VIEWPORTS.map((vp) => {
  const figs = PAGES.map((pg) => {
    const c = results.find((r) => r.viewport === vp.id && r.page === pg.id);
    const issues = c.issues.length
      ? `<p class="issue">${c.issues.map(esc).join("<br>")}</p>`
      : "";
    return `<figure><a href="${c.shot}" target="_blank"><img src="${c.shot}" alt="${esc(pg.name)} @ ${esc(vp.label)}" loading="lazy"></a>
      <figcaption><span class="n">${esc(pg.name)}</span> ${badge(c)}${issues}</figcaption></figure>`;
  }).join("");
  const vpFailed = results.filter((r) => r.viewport === vp.id && r.status === "FAIL").length;
  return `<section class="vp">
    <h2>${esc(vp.label)} <span class="mini">${vpFailed ? vpFailed + " failed" : "all clear"}</span></h2>
    <div class="grid">${figs}</div>
  </section>`;
}).join("");

const pct = Math.round(((total - failed) / total) * 100);
const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Bookly — Responsive Test Report</title><style>
  :root { --bg:#0b1020; --surface:rgba(255,255,255,.05); --border:rgba(255,255,255,.1);
    --c1:#f1f5f9; --c2:#cbd5e1; --c3:#94a3b8; --indigo:#6366f1; --violet:#8b5cf6; --ok:#34d399; }
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif; color:var(--c2);
    background:radial-gradient(1000px 400px at 85% -10%, rgba(99,102,241,.16), transparent 60%),
               radial-gradient(800px 400px at -10% 20%, rgba(168,85,247,.13), transparent 60%), var(--bg);
    padding-bottom:80px; }
  .hero { text-align:center; padding:56px 24px 32px; }
  .hero h1 { font-size:38px; font-weight:800; color:var(--c1); }
  .hero h1 span { background:linear-gradient(90deg,var(--indigo),var(--violet)); -webkit-background-clip:text; background-clip:text; color:transparent; }
  .hero p { margin-top:10px; max-width:640px; margin-inline:auto; }
  .chips { display:flex; flex-wrap:wrap; gap:10px; justify-content:center; margin-top:20px; }
  .chip { background:var(--surface); border:1px solid var(--border); border-radius:999px; padding:8px 16px; font-size:13px; }
  main { max-width:1400px; margin:0 auto; padding:0 24px; }
  table { width:100%; border-collapse:collapse; font-size:13.5px; margin:28px 0 8px; }
  th,td { padding:9px 10px; border-bottom:1px solid var(--border); text-align:center; }
  th { color:var(--c3); font-size:11.5px; text-transform:uppercase; letter-spacing:.05em; }
  td:first-child, th:first-child { text-align:left; color:var(--c1); font-weight:500; }
  td.ok, td.bad { color:var(--ok); }
  .badge { display:inline-block; padding:2px 9px; border-radius:999px; font-size:11px; font-weight:700; }
  .badge.pass { background:rgba(52,211,153,.12); color:var(--ok); }
  .badge.fail { background:rgba(248,113,113,.12); color:#f87171; }
  .vp { margin-top:44px; }
  .vp h2 { color:var(--c1); font-size:19px; margin-bottom:14px; }
  .vp .mini { font-size:12.5px; color:var(--c3); font-weight:400; margin-left:8px; }
  .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(230px,1fr)); gap:16px; }
  figure { background:var(--surface); border:1px solid var(--border); border-radius:12px; overflow:hidden; }
  figure img { width:100%; display:block; }
  figcaption { padding:10px 12px 12px; font-size:12.5px; }
  .n { color:var(--c1); font-weight:600; margin-right:6px; }
  .issue { margin-top:6px; color:#f87171; font-size:12px; line-height:1.4; }
  footer { text-align:center; margin-top:48px; color:var(--c3); font-size:13px; }
  code { background:rgba(255,255,255,.08); border-radius:5px; padding:1px 5px; font-size:12px; }
</style></head><body>
<header class="hero">
  <h1>Bookly — <span>Responsive Test Report</span></h1>
  <p>Every page swept at ${VIEWPORTS.length} screen sizes (mobile, tablet, laptop, desktop).
     Each cell checks content rendering, absence of horizontal overflow, reachable theme toggle,
     and uncaught JS errors. Click any screenshot to open it full-size.</p>
  <div class="chips">
    <span class="chip">📅 ${esc(new Date().toISOString().replace("T", " ").slice(0, 19))} UTC</span>
    <span class="chip">📱 ${VIEWPORTS.length} viewports</span>
    <span class="chip">📄 ${PAGES.length} page states</span>
    <span class="chip">🧪 ${total} checks</span>
    <span class="chip">✅ ${total - failed} passed</span>
    <span class="chip">❌ ${failed} failed</span>
    <span class="chip">${pct}% pass rate</span>
  </div>
</header>
<main>
  <table><thead><tr><th>Page</th>${VIEWPORTS.map((v) => `<th>${esc(v.id)}</th>`).join("")}</tr></thead>
  <tbody>${matrixRows}</tbody></table>
  ${sections}
</main>
<footer>Run folder: <code>${esc(path.basename(OUT))}</code> · test business: <code>${esc(biz.slug)}</code> · slot date: <code>${esc(slotDate)}</code></footer>
</body></html>`;

fs.writeFileSync(path.join(OUT, "index.html"), html);

console.log(`\n${failed ? "✗" : "✔"} ${total - failed}/${total} checks passed`);
console.log(`Report: ${OUT}/index.html`);
if (devProc) { try { process.kill(-devProc.pid); } catch {} }
process.exitCode = failed ? 1 : 0;
