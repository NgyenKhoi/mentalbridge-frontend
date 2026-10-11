#!/usr/bin/env bash
set -euo pipefail
readonly evidence_dir="${NATIVE_EVIDENCE_DIR:-native-evidence}"
command -v adb >/dev/null
command -v maestro >/dev/null
test -n "${MAESTRO_MB_USER_EMAIL:-}" && test -n "${MAESTRO_MB_USER_PASSWORD:-}" && test -n "${MAESTRO_MB_DISCOVERY_SLOT_ID:-}"
device="${ANDROID_DEVICE:-}"
if [[ -z "$device" ]]; then device="$(adb devices | awk 'NR > 1 && $2 == "device" { print $1; exit }')"; fi
test -n "$device"
mkdir -p "$evidence_dir"
if [[ "${CI:-false}" == 'true' ]]; then adb -s "$device" shell wm size 750x1600; adb -s "$device" shell wm density 320; fi
report_dir="$(mktemp -d)"
if ! maestro --device "$device" test --debug-output "$report_dir" .maestro/mb-630-appointments.yaml; then
  adb -s "$device" shell uiautomator dump /data/local/tmp/mb630-failure.xml >/dev/null 2>&1 || true
  adb -s "$device" shell cat /data/local/tmp/mb630-failure.xml 2>/dev/null | node scripts/sanitize-discovery-diagnostics.mjs >"$evidence_dir/android-appointments-diagnostics.txt" || true
  echo 'Appointment journey failed; raw UI/login dumps not retained.' >&2; exit 1
fi
node scripts/verify-appointment-persistence.mjs
adb -s "$device" exec-out screencap -p >"$evidence_dir/android-appointments-persisted-detail.png"
if [[ "${CI:-false}" == 'true' ]]; then
  for viewport in '768 1024' '1280 800' '1440 900'; do
    read -r width height <<<"$viewport"
    adb -s "$device" shell wm size "$((width * 2))x$((height * 2))"
    sleep 2
    adb -s "$device" exec-out screencap -p >"$evidence_dir/android-appointments-layout-${width}.png"
  done
  adb -s "$device" shell wm size reset; adb -s "$device" shell wm density reset
fi
{
  printf 'MB-630 Android real-contract journey passed.\nCommit: %s\nProvider: %s\nProvider commit: %s\n' "${EVIDENCE_COMMIT_SHA:-${GITHUB_SHA:-local}}" "${PROVIDER_EVIDENCE:-protected-staging}" "${PROVIDER_COMMIT_SHA:-protected-staging}"
  printf 'Consultation public contract: v1.12.0\nRun: %s/%s/actions/runs/%s\n' "${GITHUB_SERVER_URL:-https://github.com}" "${GITHUB_REPOSITORY:-local}" "${GITHUB_RUN_ID:-local}"
  printf 'Flow: real USER login -> approved specialist detail/exact slot -> fresh policy/credit/cap/slot reads -> explicit request -> owner detail -> app stop/restart -> owner list -> persisted detail.\n'
  printf 'Post-flow real owner GET proves exactly one request for the fixture slot, HELD credit and one active reservation; no payment, ledger seed or settlement command.\n'
  printf 'Synthetic FREE browse then explicit PLUS DEMO established by synthetic ADMIN. Credits provisioned through real public owner read, not SQL ledger.\n'
  printf 'CI journey 375x800dp; layout captures 768x1024dp,1280x800dp,1440x900dp. No credentials/tokens/raw payloads/real accounts or health data retained.\n'
} >"$evidence_dir/android-appointments-real-contract.txt"
