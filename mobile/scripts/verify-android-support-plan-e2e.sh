#!/usr/bin/env bash

set -euo pipefail

readonly evidence_dir="${NATIVE_EVIDENCE_DIR:-native-evidence}"
readonly flow=".maestro/mb-625-support-plan.yaml"

command -v adb >/dev/null
command -v maestro >/dev/null

if [[ -z "${MAESTRO_MB_SUPPORT_PLAN_USER_EMAIL:-}" || -z "${MAESTRO_MB_SUPPORT_PLAN_USER_PASSWORD:-}" ]]; then
  echo "The protected staging SupportPlan USER fixture credentials are required." >&2
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
rm -f "$evidence_dir/android-support-plan-result.png" \
  "$evidence_dir/android-support-plan-real-contract.txt"

maestro --device "$device" test "$flow"

adb -s "$device" exec-out screencap -p \
  >"$evidence_dir/android-support-plan-result.png"

{
  printf 'MB-625 Android real-contract SupportPlan journey passed.\n'
  printf 'Commit: %s\n' "${GITHUB_SHA:-local}"
  printf 'Run: %s/%s/actions/runs/%s\n' \
    "${GITHUB_SERVER_URL:-https://github.com}" \
    "${GITHUB_REPOSITORY:-local}" \
    "${GITHUB_RUN_ID:-local}"
  printf 'Flow: current plan -> complete occurrence -> reload persisted completion -> reopen -> reload scheduled state.\n'
  printf 'Evidence excludes credentials, reflection text, and health payloads.\n'
} >"$evidence_dir/android-support-plan-real-contract.txt"

printf 'Android real-contract SupportPlan journey verified for %s.\n' "$device"
