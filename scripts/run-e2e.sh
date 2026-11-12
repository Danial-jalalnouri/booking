#!/usr/bin/env bash
# Runs the full E2E suite and builds the HTML report into e2e-reports/<date-time>/
set -u
cd "$(dirname "$0")/.."

STAMP=$(date "+%Y-%m-%d_%H-%M-%S")
OUT="e2e-reports/$STAMP"
mkdir -p "$OUT"

echo "▶ Running E2E suite → $OUT"
E2E_OUT="$OUT" npx playwright test
RC=$?

echo "▶ Building HTML report"
node scripts/build-report.mjs "$OUT"

echo ""
echo "✔ Done. Report: $OUT/index.html"
exit $RC
