#!/usr/bin/env bash
# Refresh the live dashboard figures (no Worker redeploy needed).
# 1) recompute the aggregate snapshot from the engagement DB
# 2) push it into the D1 `metrics` row; live within the 10-min edge cache.
#
# Uses --command instead of --file: the D1 import API (/import endpoint) requires
# a specific CF OAuth scope that the standard wrangler token may not have, while
# --command goes through the normal query endpoint which always works.
set -euo pipefail
cd "$(dirname "$0")/.."
python3 scripts/compute_metrics_json.py >/dev/null
python3 - <<'PY'
import json, subprocess, sys
j = open("metrics.json").read()
escaped = j.replace("'", "''")
sql = f"UPDATE metrics SET v='{escaped}', updated_at=datetime('now') WHERE k='current';"
r = subprocess.run(
    ["npx", "wrangler", "d1", "execute", "wv-ppcs-impact", "--remote", "--command", sql],
    capture_output=True, text=True)
if r.returncode != 0:
    print("ERROR:", r.stderr[-600:], file=sys.stderr); sys.exit(1)
import re
m = re.search(r'"changes":\s*(\d+)', r.stdout)
print(f"D1 updated ({m.group(1) if m else '?'} row changed).")
PY
echo "Edge cache clears within ~10 min — hard-refresh the dashboard to verify."
