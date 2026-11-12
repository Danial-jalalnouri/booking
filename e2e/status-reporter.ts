import fs from "node:fs";
import path from "node:path";
import type { Reporter, TestCase, TestResult } from "@playwright/test/reporter";

const OUT = process.env.E2E_OUT || "e2e-screenshots";
const results: { title: string; status: string; durationMs: number }[] = [];

export default class StatusReporter implements Reporter {
  onTestEnd(test: TestCase, result: TestResult) {
    results.push({ title: test.title, status: result.status, durationMs: Math.round(result.duration) });
  }
  onEnd() {
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(path.join(OUT, "status.json"), JSON.stringify(results, null, 2));
  }
}
