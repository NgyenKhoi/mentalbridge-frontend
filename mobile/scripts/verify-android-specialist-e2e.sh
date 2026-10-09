#!/usr/bin/env bash

set -euo pipefail

readonly evidence_dir="${NATIVE_EVIDENCE_DIR:-native-evidence}"
readonly flow=".maestro/mb-633-specialist-profile-availability.yaml"

command -v adb >/dev/null
command -v maestro >/dev/null

if [[ -z "${MAESTRO_MB_SPECIALIST_EMAIL:-}" || -z "${MAESTRO_MB_SPECIALIST_PASSWORD:-}" ]]; then
  echo "The protected staging SPECIALIST fixture credentials are required." >&2
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

export MAESTRO_MB_SPECIALIST_SLOT_DATE="${MAESTRO_MB_SPECIALIST_SLOT_DATE:-$(date -u -d '+7 days' +%F)}"
export MAESTRO_MB_SPECIALIST_SLOT_TIME="${MAESTRO_MB_SPECIALIST_SLOT_TIME:-09:00}"

mkdir -p "$evidence_dir"
rm -f "$evidence_dir/android-specialist-result.png" \
  "$evidence_dir/android-specialist-real-contract.txt"

maestro --device "$device" test "$flow"

adb -s "$device" exec-out screencap -p \
  >"$evidence_dir/android-specialist-result.png"

{
  printf 'MB-633 Android real-contract SPECIALIST journey passed.\n'
  printf 'Commit: %s\n' "${GITHUB_SHA:-local}"
  printf 'Run: %s/%s/actions/runs/%s\n' \
    "${GITHUB_SERVER_URL:-https://github.com}" \
    "${GITHUB_REPOSITORY:-local}" \
    "${GITHUB_RUN_ID:-local}"
  printf 'Flow: approved profile -> publish exact 60-minute online slot -> withdraw -> reload persisted tombstone.\n'
  printf 'Evidence excludes credentials and professional profile fields.\n'
} >"$evidence_dir/android-specialist-real-contract.txt"

printf 'Android real-contract SPECIALIST journey verified for %s.\n' "$device"
