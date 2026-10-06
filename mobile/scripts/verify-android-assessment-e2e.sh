#!/usr/bin/env bash

set -euo pipefail

readonly app_id="com.mentalbridge.mobile"
readonly evidence_dir="${NATIVE_EVIDENCE_DIR:-native-evidence}"
readonly flow=".maestro/mb-612-assessment.yaml"

command -v adb >/dev/null
command -v maestro >/dev/null

if [[ -z "${MAESTRO_MB_USER_EMAIL:-}" || -z "${MAESTRO_MB_USER_PASSWORD:-}" ]]; then
  echo "The protected staging USER fixture credentials are required." >&2
  exit 1
fi

device="${ANDROID_DEVICE:-}"
if [[ -z "$device" ]]; then
  device="$(adb devices | awk 'NR > 1 && $2 == "device" { print $1; exit }')"
fi

if [[ -z "$device" ]]; then
  echo "No booted Android device or emulator is available." >&2
  exit 1
fi

mkdir -p "$evidence_dir"
rm -f "$evidence_dir/android-assessment-result.png" \
  "$evidence_dir/android-assessment-real-contract.txt"

maestro --device "$device" test "$flow"

adb -s "$device" exec-out screencap -p \
  >"$evidence_dir/android-assessment-result.png"

{
  printf 'MB-612 Android real-contract journey passed.\n'
  printf 'Commit: %s\n' "${GITHUB_SHA:-local}"
  printf 'Run: %s/%s/actions/runs/%s\n' \
    "${GITHUB_SERVER_URL:-https://github.com}" \
    "${GITHUB_REPOSITORY:-local}" \
    "${GITHUB_RUN_ID:-local}"
  printf 'Flow: PHQ-9 -> GAD-7 -> authoritative result -> persisted SupportGuide.\n'
  printf 'Evidence excludes credentials and raw answer payloads.\n'
} >"$evidence_dir/android-assessment-real-contract.txt"

printf 'Android real-contract assessment journey verified for %s.\n' "$device"
