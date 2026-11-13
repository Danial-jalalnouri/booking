// Cross-browser sweep: runs the core user journey in Chromium (Chrome),
// Firefox and WebKit (Safari engine), asserting every step works on each
// browser engine and screenshotting each step.
//
// Usage: npm run e2e:browsers     (or: node e2e/cross-browser.mjs [outDir])
// Output: e2e-reports/crossbrowser-<stamp>/ with per-browser folders,
// results.json and index.html (matrix report).
import { chromium, firefox, webkit } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const BASE = process.env.E2E_BASE_URL || "http://localhost:3000";
const OUT = process.argv[2] || `e2e-reports/crossbrowser-${new Date().toISOString().slice(0, 19).replace("T", "_").replace(/:/g, "-")}`;
fs.mkdirSync(OUT, { recursive: true });

const BROWSERS = [
  { id: "chromium", label: "Chromium (Chrome)", launcher: chromium },
  { id: "firefox", label: "Firefox", launcher: firefox },
  { id: "webkit", label: "WebKit (Safari)", launcher: webkit },
].filter((b) => !process.env.E2E_BROWSERS || process.env.E2E_BROWSERS.split(",").includes(b.id));

// ---------------------------------------------------------------------------
// 0. Ensure dev server is running
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
// 1. The journey — same flow for every browser, unique account per browser
// ---------------------------------------------------------------------------
const runStamp = Date.now().toString(36);

/** Fill a React-controlled input and make sure the value stuck. Filling before
 *  hydration completes gets silently reset by React (WebKit hydrates slowest),
 *  so verify + retry. */
async function fillSticky(page, locator, value, label = "field") {
  for (let i = 0; i < 6; i++) {
    await locator.fill(value);
    await page.waitForTimeout(250);
    if ((await locator.inputValue()) === value) return;
  }
  throw new Error(`${label}: value did not stick (hydration race)`);
}

const STEPS = [
  {
    id: "01-landing", name: "Landing page",
    async run(page) {
      await page.goto(BASE + "/");
      await page.locator("header").getByText("Bookly").waitFor({ timeout: 15_000 });
      await page.getByRole("link", { name: "Get started" }).first().waitFor({ timeout: 5000 });
    },
  },
  {
    id: "02-signup", name: "Signup new user",
    async run(page, s) {
      await page.goto(BASE + "/signup");
      await fillSticky(page, page.getByPlaceholder("Jane Doe"), s.owner.name, "name");
      await fillSticky(page, page.getByPlaceholder("you@business.com"), s.owner.email, "email");
      await fillSticky(page, page.getByPlaceholder("At least 6 characters"), s.owner.password, "password");
      await page.getByRole("button", { name: "Create account" }).click();
      await page.waitForURL("**/dashboard", { timeout: 15_000 });
      await page.getByText("Welcome aboard").waitFor({ timeout: 10_000 });
    },
  },
  {
    id: "03-create-business", name: "Create business",
    async run(page, s) {
      await page.getByPlaceholder("Glow Salon").fill(s.biz.name);
      await page.getByPlaceholder("glow-salon").fill(s.biz.slug);
      await page.getByPlaceholder("What do you offer?").fill(s.biz.description);
      await page.getByRole("button", { name: "Create business" }).click();
      await page.locator(`a[href="/book/${s.biz.slug}"]`).waitFor({ timeout: 10_000 });
    },
  },
  {
    id: "04-set-hours", name: "Set working hours",
    async run(page, s) {
      await page.locator('nav button:has-text("hours")').click();
      const switches = page.locator("label.relative");
      for (const idx of [1, 2, 3]) await switches.nth(idx).click(); // Mon, Tue, Wed
      await page.getByRole("button", { name: "Save hours" }).click();
      // verify the save round-tripped through the API (poll — the PUT is async)
      let saved = false;
      for (let i = 0; i < 10 && !saved; i++) {
        await page.waitForTimeout(500);
        const j = await (await page.request.get(`${BASE}/api/businesses`)).json();
        const b = (j.businesses || []).find((x) => x.slug === s.biz.slug);
        saved = !!b && b.hours.length === 3;
      }
      if (!saved) throw new Error("hours not saved after polling 5s");
    },
  },
  {
    id: "05-add-service", name: "Add a service",
    async run(page, s) {
      await page.locator('nav button:has-text("services")').click();
      await page.getByPlaceholder("e.g. Consultation").fill(s.service.name);
      await page.getByPlaceholder("min").fill(String(s.service.durationMin));
      await page.getByPlaceholder("$0").fill(s.service.price);
      await page.getByRole("button", { name: "Add service" }).click();
      await page.locator("ul li", { hasText: s.service.name }).first().waitFor({ timeout: 10_000 });
    },
  },
  {
    id: "06-find-slots", name: "Public page shows slots",
    async run(page, s) {
      // pick the first date within 14 days that has open slots
      for (let i = 0; i < 14 && !s.slotDate; i++) {
        const iso = new Date(Date.now() + i * 86400_000).toISOString().slice(0, 10);
        const res = await page.request.get(`${BASE}/api/public/business/${s.biz.slug}/slots?date=${iso}`);
        if (((await res.json()).slots || []).length > 0) s.slotDate = iso;
      }
      if (!s.slotDate) throw new Error("no bookable date found");
      await page.goto(BASE + `/book/${s.biz.slug}`);
      await page.getByRole("heading", { name: s.biz.name }).waitFor({ timeout: 15_000 });
      // fill the date (retry: first fill can race hydration)
      const input = page.locator('input[type="date"]');
      for (let i = 0; i < 5; i++) {
        await input.fill("");
        await input.fill(s.slotDate);
        try {
          await page.locator("main .grid button").filter({ hasText: ":" }).first().waitFor({ timeout: 4000, state: "visible" });
          return;
        } catch { /* retry */ }
      }
      throw new Error("slots never appeared");
    },
  },
  {
    id: "07-book", name: "Book an appointment",
    async run(page, s) {
      if (!s.slotDate) throw new Error("skipped — no slot date (previous step failed)");
      // make sure slots are on screen right now (they can refetch empty in some
      // engines between steps) — same retry-fill as the slot discovery step
      const slotBtn = page.locator("main .grid button").filter({ hasText: ":" }).first();
      if (!(await slotBtn.isVisible().catch(() => false))) {
        const input = page.locator('input[type="date"]');
        for (let i = 0; i < 5; i++) {
          await input.fill("");
          await input.fill(s.slotDate);
          try { await slotBtn.waitFor({ timeout: 4000, state: "visible" }); break; } catch { /* retry */ }
        }
      }
      await slotBtn.click();
      await page.getByPlaceholder("Full name").fill(s.customer.name);
      await page.getByPlaceholder("you@example.com").fill(s.customer.email);
      await page.getByPlaceholder("Phone (optional)").fill("+1 555 0100");
      await page.getByRole("button", { name: "Book appointment" }).click();
      await page.getByText("You're booked!").waitFor({ timeout: 15_000 });
    },
  },
  {
    id: "08-dashboard", name: "Owner sees the booking",
    async run(page, s) {
      await page.goto(BASE + "/dashboard");
      await page.locator("ul li", { hasText: s.customer.email }).first().waitFor({ timeout: 10_000 });
    },
  },
  {
    id: "09-theme-toggle", name: "Theme toggle persists",
    async run(page) {
      await page.goto(BASE + "/");
      const isDark = await page.evaluate(() => document.documentElement.classList.contains("dark"));
      await page.locator('[aria-label*="mode"]').first().click();
      await page.waitForTimeout(300);
      const nowDark = await page.evaluate(() => document.documentElement.classList.contains("dark"));
      if (nowDark === isDark) throw new Error("theme did not flip");
      const saved = await page.evaluate(() => localStorage.getItem("theme"));
      if (saved !== (nowDark ? "dark" : "light")) throw new Error(`localStorage theme = ${saved}`);
    },
  },
  {
    id: "10-logout-login", name: "Logout, guard, login",
    async run(page, s) {
      await page.goto(BASE + "/dashboard");
      await page.getByRole("button", { name: "Log out" }).click();
      await page.waitForURL((u) => !u.pathname.includes("dashboard"), { timeout: 10_000 });
      await page.goto(BASE + "/dashboard"); // must be blocked by the route guard
      await page.waitForURL("**/login**", { timeout: 10_000 });
      await page.getByRole("heading", { name: "Welcome back" }).waitFor({ timeout: 10_000 });
      await page.getByPlaceholder("you@business.com").fill(s.owner.email);
      await page.getByPlaceholder("••••••••").fill(s.owner.password);
      await page.getByRole("button", { name: "Sign in" }).click();
      await page.waitForURL("**/dashboard", { timeout: 15_000 });
      await page.locator("select").waitFor({ timeout: 10_000 });
    },
  },
];

// ---------------------------------------------------------------------------
// 2. Run the journey in every browser
// ---------------------------------------------------------------------------
const results = [];
let done = 0;
const total = BROWSERS.length * STEPS.length;

for (const b of BROWSERS) {
  const stamp = `${b.id}-${runStamp}`;
  const state = {
    owner: { name: "Cross Browser", email: `cb-${stamp}@bookly.dev`, password: "testpass123" },
    biz: { name: "Cross Browser Studio", slug: `cb-studio-${stamp}`, description: "Same journey, every browser engine" },
    service: { name: "Piano Lesson", durationMin: 45, price: "$50" },
    customer: { name: "Engine Tester", email: `cust-${stamp}@bookly.dev` },
    slotDate: "",
  };

  console.log(`\n▶ ${b.label}`);
  const browser = await b.launcher.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  // diagnostics: record every slots API response the page makes
  const slotResponses = [];
  page.on("response", async (res) => {
    if (!res.url().includes("/slots")) return;
    let n = -1;
    try { n = ((await res.json()).slots || []).length; } catch { /* non-json */ }
    slotResponses.push(`${res.status()} ${res.request().method()} ${res.url().split("/api/")[1] || res.url()} -> ${n} slots`);
  });

  const dir = path.join(OUT, b.id);
  fs.mkdirSync(dir, { recursive: true });

  for (const step of STEPS) {
    const cell = { browser: b.id, browserLabel: b.label, step: step.id, stepName: step.name, status: "PASS", issues: [] };
    pageErrors.length = 0; // attribute JS errors to the step they occur in
    try {
      await step.run(page, state);
      if (pageErrors.length) cell.issues.push(`uncaught JS error: ${pageErrors[0]}`);
      if (cell.issues.length) cell.status = "FAIL";
    } catch (e) {
      cell.status = "FAIL";
      cell.issues.push(String(e).split("\n")[0].slice(0, 200));
      if (slotResponses.length) cell.issues.push("recent /slots responses: " + slotResponses.slice(-4).join(" | "));
    }
    const shot = path.join(b.id, `${step.id}.png`);
    await page.screenshot({ path: path.join(OUT, shot), fullPage: true }).catch(() => {});
    cell.shot = shot;
    results.push(cell);
    done++;
    console.log(`  [${String(done).padStart(2)}/${total}] ${step.name.padEnd(26)} ${cell.status}${cell.issues.length ? " — " + cell.issues[0] : ""}`);
  }
  await ctx.close();
  await browser.close();
}

fs.writeFileSync(path.join(OUT, "results.json"),
  JSON.stringify({ base: BASE, browsers: BROWSERS.map((b) => b.label), generated: new Date().toISOString(), results }, null, 2));

// ---------------------------------------------------------------------------
// 3. HTML report (matrix: steps × browsers)
// ---------------------------------------------------------------------------
const failed = results.filter((c) => c.status === "FAIL").length;
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const badge = (c) => c.status === "PASS"
  ? '<span class="badge pass">PASS</span>'
  : `<span class="badge fail" title="${esc(c.issues.join(" · "))}">FAIL</span>`;

const matrixRows = STEPS.map((st) => {
  const cells = BROWSERS.map((b) => {
    const c = results.find((r) => r.browser === b.id && r.step === st.id);
    return `<td class="${c.status === "PASS" ? "ok" : "bad"}">${badge(c)}</td>`;
  }).join("");
  return `<tr><td>${esc(st.name)}</td>${cells}</tr>`;
}).join("");

const sections = BROWSERS.map((b) => {
  const figs = STEPS.map((st) => {
    const c = results.find((r) => r.browser === b.id && r.step === st.id);
    const issues = c.issues.length ? `<p class="issue">${c.issues.map(esc).join("<br>")}</p>` : "";
    return `<figure><a href="${c.shot}" target="_blank"><img src="${c.shot}" alt="${esc(st.name)} on ${esc(b.label)}" loading="lazy"></a>
      <figcaption><span class="n">${esc(st.name)}</span> ${badge(c)}${issues}</figcaption></figure>`;
  }).join("");
  const bFailed = results.filter((r) => r.browser === b.id && r.status === "FAIL").length;
  return `<section class="vp"><h2>${esc(b.label)} <span class="mini">${bFailed ? bFailed + " failed" : "all clear"}</span></h2>
    <div class="grid">${figs}</div></section>`;
}).join("");

const pct = Math.round(((total - failed) / total) * 100);
const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Bookly — Cross-Browser Test Report</title><style>
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
  .hero p { margin-top:10px; max-width:660px; margin-inline:auto; }
  .chips { display:flex; flex-wrap:wrap; gap:10px; justify-content:center; margin-top:20px; }
  .chip { background:var(--surface); border:1px solid var(--border); border-radius:999px; padding:8px 16px; font-size:13px; }
  main { max-width:1100px; margin:0 auto; padding:0 24px; }
  table { width:100%; border-collapse:collapse; font-size:13.5px; margin:28px 0 8px; }
  th,td { padding:9px 10px; border-bottom:1px solid var(--border); text-align:center; }
  th { color:var(--c3); font-size:11.5px; text-transform:uppercase; letter-spacing:.05em; }
  td:first-child, th:first-child { text-align:left; color:var(--c1); font-weight:500; }
  .badge { display:inline-block; padding:2px 9px; border-radius:999px; font-size:11px; font-weight:700; }
  .badge.pass { background:rgba(52,211,153,.12); color:var(--ok); }
  .badge.fail { background:rgba(248,113,113,.12); color:#f87171; }
  .vp { margin-top:44px; }
  .vp h2 { color:var(--c1); font-size:19px; margin-bottom:14px; }
  .vp .mini { font-size:12.5px; color:var(--c3); font-weight:400; margin-left:8px; }
  .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(250px,1fr)); gap:16px; }
  figure { background:var(--surface); border:1px solid var(--border); border-radius:12px; overflow:hidden; }
  figure img { width:100%; display:block; aspect-ratio:16/10; object-fit:cover; object-position:top; }
  figcaption { padding:10px 12px 12px; font-size:12.5px; }
  .n { color:var(--c1); font-weight:600; margin-right:6px; }
  .issue { margin-top:6px; color:#f87171; font-size:12px; line-height:1.4; }
  footer { text-align:center; margin-top:48px; color:var(--c3); font-size:13px; }
  code { background:rgba(255,255,255,.08); border-radius:5px; padding:1px 5px; font-size:12px; }
</style></head><body>
<header class="hero">
  <h1>Bookly — <span>Cross-Browser Test Report</span></h1>
  <p>The full user journey (signup → business setup → booking → dashboard → theme → logout)
     executed identically on three browser engines: Chromium (Chrome), Firefox and WebKit (Safari).
     Click any screenshot to open it full-size.</p>
  <div class="chips">
    <span class="chip">📅 ${esc(new Date().toISOString().replace("T", " ").slice(0, 19))} UTC</span>
    <span class="chip">🌐 ${BROWSERS.length} browsers</span>
    <span class="chip">🧪 ${STEPS.length} steps each</span>
    <span class="chip">✅ ${total - failed}/${total} passed</span>
    <span class="chip">${pct}% pass rate</span>
  </div>
</header>
<main>
  <table><thead><tr><th>Step</th>${BROWSERS.map((b) => `<th>${esc(b.id)}</th>`).join("")}</tr></thead>
  <tbody>${matrixRows}</tbody></table>
  ${sections}
</main>
<footer>Run folder: <code>${esc(path.basename(OUT))}</code> · engines: Chromium · Firefox · WebKit (Safari)</footer>
</body></html>`;

fs.writeFileSync(path.join(OUT, "index.html"), html);

console.log(`\n${failed ? "✗" : "✔"} ${total - failed}/${total} checks passed`);
console.log(`Report: ${OUT}/index.html`);
if (devProc) { try { process.kill(-devProc.pid); } catch {} }
process.exitCode = failed ? 1 : 0;
