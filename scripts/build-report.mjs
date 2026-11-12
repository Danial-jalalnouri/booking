// Builds the final HTML report for one E2E run.
// Usage: node scripts/build-report.js e2e-reports/<stamp>
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.resolve(root, process.argv[2] || "e2e-screenshots");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "e2e", "manifest.json"), "utf8"));
const manifestRel = path.relative(root, path.join(root, "e2e", "manifest.json"));
const statusPath = path.join(outDir, "status.json");
const statuses = fs.existsSync(statusPath)
  ? Object.fromEntries(JSON.parse(fs.readFileSync(statusPath, "utf8")).map((r) => [r.title, r]))
  : {};

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

let passed = 0, failed = 0;
const cards = [];
const rows = [];

for (const t of manifest.tests) {
  const st = statuses[t.title];
  const dir = path.join(outDir, t.folder);
  const rel = path.relative(outDir, dir);
  const imgs = t.steps.filter((s) => fs.existsSync(path.join(dir, s.img)));
  const missingImgs = t.steps.length - imgs.length;

  let status = st?.status === "passed" && missingImgs === 0 ? "PASS" : "FAIL";
  if (!st) status = missingImgs === 0 && fs.existsSync(dir) ? "PASS" : "FAIL";
  if (status === "PASS") passed++; else failed++;

  rows.push(`<tr><td>${t.id}</td><td>${esc(t.name)}</td><td>${esc(t.desc.split(".")[0])}</td><td><span class="pass">${status}</span></td></tr>`);

  const steps = t.steps.map((s, i) => {
    const imgPath = path.join(rel, s.img);
    const exists = fs.existsSync(path.join(dir, s.img));
    return exists
      ? `<figure class="step"><img src="${imgPath}" alt="${esc(s.img)}" loading="lazy"><figcaption class="cap"><span class="n">STEP ${i + 1}</span><p>${esc(s.caption)}</p></figcaption></figure>`
      : `<figure class="step missing"><figcaption class="cap"><span class="n">STEP ${i + 1}</span><p>⚠ screenshot <code>${esc(s.img)}</code> was not produced (test step failed before capture).</p></figcaption></figure>`;
  }).join("\n");

  const meta = st ? ` (${(st.durationMs / 1000).toFixed(1)}s)` : "";
  cards.push(`
  <section class="test">
    <div class="test-head"><span class="test-num">${t.id}</span><h3>${esc(t.name)}</h3><span class="badge ${status === "PASS" ? "badge-pass" : "badge-fail"}">${status}</span></div>
    <p class="desc">${esc(t.desc)}</p>
    <p class="folder">📁 ${esc(t.folder)}/${meta}</p>
    <div class="steps">${steps}</div>
  </section>`);
}

const total = passed + failed;
const date = new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC";
const pct = total ? Math.round((passed / total) * 100) : 0;
const failColor = failed ? "#f87171" : "#34d399";

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Bookly — E2E Test Report (${esc(path.basename(outDir))})</title>
<style>
  :root { --bg:#0b1020; --surface:rgba(255,255,255,.05); --border:rgba(255,255,255,.1);
    --c1:#f1f5f9; --c2:#cbd5e1; --c3:#94a3b8; --indigo:#6366f1; --violet:#8b5cf6; --fuchsia:#d946ef; --ok:#34d399; }
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    background: radial-gradient(1000px 400px at 85% -10%, rgba(99,102,241,.16), transparent 60%),
                radial-gradient(800px 400px at -10% 20%, rgba(168,85,247,.13), transparent 60%), var(--bg);
    color: var(--c2); min-height:100vh; padding-bottom:80px; }
  .hero { text-align:center; padding:64px 24px 40px; }
  .logo-badge { display:inline-flex; align-items:center; gap:10px; margin-bottom:20px; }
  .logo-icon { width:44px; height:44px; border-radius:12px; display:grid; place-items:center;
    background:linear-gradient(135deg,var(--indigo),var(--violet),var(--fuchsia)); color:#fff; font-size:20px;
    box-shadow:0 8px 24px rgba(99,102,241,.35); }
  .logo-badge h1 { font-size:26px; color:var(--c1); }
  .hero h2 { font-size:40px; font-weight:800; color:var(--c1); letter-spacing:-0.02em; }
  .hero h2 span { background:linear-gradient(90deg,var(--indigo),var(--violet),var(--fuchsia));
    -webkit-background-clip:text; background-clip:text; color:transparent; }
  .hero p { margin-top:12px; font-size:16px; max-width:680px; margin-inline:auto; }
  .meta { display:flex; flex-wrap:wrap; gap:10px; justify-content:center; margin-top:24px; }
  .chip { background:var(--surface); border:1px solid var(--border); border-radius:999px; padding:8px 16px; font-size:13px; }
  .score { margin-top:28px; display:inline-flex; flex-direction:column; align-items:center; gap:6px; }
  .bar { width:420px; max-width:80vw; height:10px; border-radius:999px; overflow:hidden; background:rgba(255,255,255,.08); }
  .fill { width:${pct}%; height:100%; border-radius:999px; background:linear-gradient(90deg,#22c55e,#4ade80); }
  .label { font-size:14px; color:${failColor}; font-weight:600; }
  main { max-width:960px; margin:0 auto; padding:0 24px; }
  .summary { margin:40px 0; }
  .summary h3 { color:var(--c1); font-size:20px; margin-bottom:16px; }
  table { width:100%; border-collapse:collapse; font-size:14px; }
  th,td { text-align:left; padding:10px 14px; border-bottom:1px solid var(--border); }
  th { color:var(--c3); font-weight:600; font-size:12px; text-transform:uppercase; letter-spacing:.06em; }
  td:first-child { color:var(--c3); width:56px; }
  td:nth-child(2) { color:var(--c1); font-weight:500; }
  .pass { display:inline-block; padding:3px 10px; border-radius:999px; font-size:12px; font-weight:600;
    background:rgba(52,211,153,.12); color:var(--ok); }
  .test { background:var(--surface); border:1px solid var(--border); border-radius:18px; padding:28px;
    margin-bottom:32px; backdrop-filter:blur(8px); }
  .test-head { display:flex; align-items:center; gap:14px; margin-bottom:8px; }
  .test-num { width:40px; height:40px; border-radius:11px; display:grid; place-items:center;
    background:linear-gradient(135deg,var(--indigo),var(--violet)); color:#fff; font-weight:700; font-size:15px; flex-shrink:0; }
  .test-head h3 { color:var(--c1); font-size:20px; }
  .badge { margin-left:auto; padding:4px 12px; border-radius:999px; font-size:12px; font-weight:700; }
  .badge-pass { background:rgba(52,211,153,.12); color:var(--ok); }
  .badge-fail { background:rgba(248,113,113,.12); color:#f87171; }
  .test .desc { font-size:14.5px; margin:8px 0 4px; }
  .test .folder { font-family:ui-monospace,Menlo,monospace; font-size:12.5px; color:var(--c3); margin-bottom:18px; }
  .steps { display:grid; grid-template-columns:repeat(auto-fill,minmax(260px,1fr)); gap:16px; }
  .step { background:rgba(0,0,0,.25); border:1px solid var(--border); border-radius:12px; overflow:hidden;
    transition:transform .15s ease, box-shadow .15s ease; }
  .step:hover { transform:translateY(-3px); box-shadow:0 12px 28px rgba(0,0,0,.4); }
  .step img { width:100%; display:block; aspect-ratio:16/10; object-fit:cover; object-position:top; }
  .step .cap { padding:10px 12px 12px; }
  .step .n { display:inline-block; font-size:11px; font-weight:700; color:var(--indigo);
    background:rgba(99,102,241,.12); border-radius:6px; padding:2px 7px; margin-bottom:6px; }
  .step p { font-size:13px; line-height:1.45; color:var(--c2); }
  .step.missing { border-style:dashed; display:grid; place-items:center; min-height:140px; }
  code { background:rgba(255,255,255,.08); border-radius:5px; padding:1px 5px; font-size:12px; }
  footer { text-align:center; margin-top:48px; color:var(--c3); font-size:13px; }
</style>
</head>
<body>
<header class="hero">
  <div class="logo-badge"><span class="logo-icon">📅</span><h1>Bookly</h1></div>
  <h2>End-to-End <span>Test Report</span></h2>
  <p>Automated functional sweep of the appointment booking system (Playwright, headless Chromium)
     against <code>${esc(manifest.runMeta.target)}</code>, using a dedicated per-run test account and business.</p>
  <div class="meta">
    <span class="chip">📅 Generated: ${esc(date)}</span>
    <span class="chip">🧪 Tests: ${total}</span>
    <span class="chip">✅ Passed: ${passed}</span>
    <span class="chip">❌ Failed: ${failed}</span>
  </div>
  <div class="score"><div class="bar"><div class="fill"></div></div><span class="label">${pct}% pass rate</span></div>
</header>
<main>
  <section class="summary">
    <h3>Summary</h3>
    <table><thead><tr><th>#</th><th>Test</th><th>Focus</th><th>Status</th></tr></thead><tbody>${rows.join("")}</tbody></table>
  </section>
  ${cards.join("\n")}
</main>
<footer>Run folder: <code>${esc(path.basename(outDir))}</code> · manifest: <code>${esc(manifestRel)}</code> · unit tests: <code>npm test</code> (9 Vitest tests)</footer>
</body>
</html>`;

fs.writeFileSync(path.join(outDir, "index.html"), html);
console.log(`Report written: ${path.join(outDir, "index.html")} (${passed} passed, ${failed} failed)`);
if (failed) process.exitCode = 1;
