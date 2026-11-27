#!/usr/bin/env bash
set -euo pipefail
readonly evidence_dir="${NATIVE_EVIDENCE_DIR:-native-evidence}"
command -v adb >/dev/null
command -v maestro >/dev/null
if [[ -z "${MAESTRO_MB_USER_EMAIL:-}" || -z "${MAESTRO_MB_USER_PASSWORD:-}" || -z "${MAESTRO_MB_DISCOVERY_SPECIALIST_ID:-}" || -z "${MAESTRO_MB_DISCOVERY_SLOT_ID:-}" ]]; then
  echo 'Dedicated protected USER, approved specialist and exact slot fixture required.' >&2; exit 1
fi
device="${ANDROID_DEVICE:-}"
if [[ -z "$device" ]]; then device="$(adb devices | awk 'NR > 1 && $2 == "device" { print $1; exit }')"; fi
if [[ -z "$device" ]]; then echo 'A booted Android device is required.' >&2; exit 1; fi
mkdir -p "$evidence_dir"
if [[ "${CI:-false}" == 'true' ]]; then
  adb -s "$device" shell wm size 750x1600
  adb -s "$device" shell wm density 320
fi
report_dir="$(mktemp -d)"
if ! maestro --device "$device" test --debug-output "$report_dir" .maestro/mb-629-discovery.yaml; then
  adb -s "$device" shell uiautomator dump /data/local/tmp/mb629-failure.xml >/dev/null 2>&1 || true
  adb -s "$device" shell cat /data/local/tmp/mb629-failure.xml 2>/dev/null |
    node scripts/sanitize-discovery-diagnostics.mjs >"$evidence_dir/android-discovery-diagnostics.txt" || true
  echo 'Discovery journey failed; sensitive UI dumps are not retained.' >&2; exit 1
fi
adb -s "$device" exec-out screencap -p >"$evidence_dir/android-discovery-selection.png"
if [[ "${CI:-false}" == 'true' ]]; then
  for viewport in '768 1024' '1280 800' '1440 900'; do
    read -r width height <<<"$viewport"
    adb -s "$device" shell wm size "$((width * 2))x$((height * 2))"
    sleep 2
    adb -s "$device" exec-out screencap -p >"$evidence_dir/android-discovery-layout-${width}.png"
  done
  adb -s "$device" shell wm size reset
  adb -s "$device" shell wm density reset
fi
{
  printf 'MB-629 Android real-contract journey passed.\n'
  printf 'Commit: %s\n' "${EVIDENCE_COMMIT_SHA:-${GITHUB_SHA:-local}}"
  printf 'Provider: %s\n' "${PROVIDER_EVIDENCE:-protected-staging}"
  printf 'Provider commit: %s\n' "${PROVIDER_COMMIT_SHA:-protected-staging}"
  printf 'Consultation public contract: v1.12.0\n'
  printf 'CI viewport evidence: journey at 375x800dp; layout captures at 768x1024dp, 1280x800dp and 1440x900dp.\n'
  printf 'Run: %s/%s/actions/runs/%s\n' "${GITHUB_SERVER_URL:-https://github.com}" "${GITHUB_REPOSITORY:-local}" "${GITHUB_RUN_ID:-local}"
  printf 'Flow: real USER login -> supported filter browse -> approved public detail -> fresh policy/profile/exact slot recheck -> in-memory selection handoff. No reservation or booking command.\n'
  printf 'Controlled fixture: FREE browse preflight -> explicit PLUS DEMO established by synthetic ADMIN; not PAID. Synthetic profile approval and exact chat slot publication use real public commands.\n'
  printf 'No real accounts, health content, credentials, tokens, payloads, private role state or financial lifecycle evidence retained.\n'
} >"$evidence_dir/android-discovery-real-contract.txt"
