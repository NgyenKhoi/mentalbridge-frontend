#!/usr/bin/env bash

set -euo pipefail

readonly evidence_dir="${NATIVE_EVIDENCE_DIR:-native-evidence}"
readonly flow=".maestro/mb-634-specialist-appointment-continuity.yaml"

command -v adb >/dev/null
command -v maestro >/dev/null

if [[ -z "${MAESTRO_MB_SPECIALIST_EMAIL:-}" || -z "${MAESTRO_MB_SPECIALIST_PASSWORD:-}" ]]; then
  echo "The protected resettable MB-634 SPECIALIST fixture credentials are required." >&2
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
rm -f "$evidence_dir/android-mb-634-result.png" \
  "$evidence_dir/android-mb-634-real-contract.txt"

npm run native:android:smoke
maestro --device "$device" test "$flow"

# The flow returns to the SPECIALIST home before capture so the artifact does
# not contain ConsultationBrief or SessionSummary content.
adb -s "$device" exec-out screencap -p \
  >"$evidence_dir/android-mb-634-result.png"

{
  printf 'MB-634 Android real-contract SPECIALIST continuity journey passed.\n'
  printf 'Exact head: %s\n' "${EVIDENCE_COMMIT_SHA:-${GITHUB_SHA:-local}}"
  printf 'Run: %s/%s/actions/runs/%s\n' \
    "${GITHUB_SERVER_URL:-https://github.com}" \
    "${GITHUB_REPOSITORY:-local}" \
    "${GITHUB_RUN_ID:-local}"
  printf 'Provider: protected resettable staging SPECIALIST fixture.\n'
  printf 'Flow: assigned REQUESTED decision -> authorized Care brief -> authoritative COMPLETED SessionSummary publication.\n'
  printf 'Evidence excludes credentials, ConsultationBrief content, SessionSummary content, and chat messages.\n'
} >"$evidence_dir/android-mb-634-real-contract.txt"

printf 'Android MB-634 real-contract journey verified for %s.\n' "$device"
