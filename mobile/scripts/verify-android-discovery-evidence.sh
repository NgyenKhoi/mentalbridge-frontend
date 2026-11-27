#!/usr/bin/env bash
set -euo pipefail
readonly evidence_dir="${NATIVE_EVIDENCE_DIR:-native-evidence}"
mkdir -p "$evidence_dir"
edge_pid=""
cleanup() { if [[ -n "$edge_pid" ]]; then kill "$edge_pid" 2>/dev/null || true; fi; }
trap cleanup EXIT
if [[ "${PROVIDER_EVIDENCE:-protected-staging}" == 'protected-controlled-real-contract' ]]; then
  adb reverse tcp:8088 tcp:8088
  node scripts/controlled-discovery-edge.mjs >"$evidence_dir/android-discovery-edge.log" 2>&1 &
  edge_pid="$!"
  for attempt in {1..20}; do
    if curl -fsS http://127.0.0.1:8088/health/ready >/dev/null; then break; fi
    if [[ "$attempt" == 20 ]]; then echo 'Controlled discovery edge did not become ready.' >&2; exit 1; fi
    sleep 1
  done
fi
npm run native:android:smoke
if [[ "${PROVIDER_EVIDENCE:-protected-staging}" == 'protected-controlled-real-contract' ]]; then
  adb reverse tcp:8088 tcp:8088
fi
npm run e2e:android:discovery
