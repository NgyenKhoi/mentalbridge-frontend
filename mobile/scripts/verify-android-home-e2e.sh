#!/usr/bin/env bash

set -euo pipefail

readonly evidence_dir="${NATIVE_EVIDENCE_DIR:-native-evidence}"
readonly flow=".maestro/mb-663-home-next-step.yaml"

command -v adb >/dev/null
command -v maestro >/dev/null

if [[ -z "${MAESTRO_MB_HOME_USER_EMAIL:-}" || \
      -z "${MAESTRO_MB_HOME_USER_PASSWORD:-}" || \
      -z "${MAESTRO_MB_HOME_NEXT_STEP_TITLE:-}" ]]; then
  echo "The protected staging Home fixture credentials and next-step title are required." >&2
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
rm -f "$evidence_dir/android-home-next-step.png" \
  "$evidence_dir/android-home-next-step.txt"

maestro --device "$device" test "$flow"

adb -s "$device" exec-out screencap -p \
  >"$evidence_dir/android-home-next-step.png"

{
  printf 'MB-663 Android authoritative Home re-entry journey passed.\n'
  printf 'Commit: %s\n' "${GITHUB_SHA:-local}"
  printf 'Run: %s/%s/actions/runs/%s\n' \
    "${GITHUB_SERVER_URL:-https://github.com}" \
    "${GITHUB_REPOSITORY:-local}" \
    "${GITHUB_RUN_ID:-local}"
  printf 'Flow: Home decision -> owned plan action -> return -> refreshed Home decision.\n'
  printf 'Evidence excludes credentials, health answers, journal text, and emotion values.\n'
} >"$evidence_dir/android-home-next-step.txt"

printf 'Android Home next-step journey verified for %s.\n' "$device"
