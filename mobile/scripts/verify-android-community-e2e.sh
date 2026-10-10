#!/usr/bin/env bash
set -euo pipefail
readonly evidence_dir="${NATIVE_EVIDENCE_DIR:-native-evidence}"
command -v adb >/dev/null
command -v maestro >/dev/null
if [[ -z "${MAESTRO_MB_USER_EMAIL:-}" || -z "${MAESTRO_MB_USER_PASSWORD:-}" || -z "${MAESTRO_MB_COMMUNITY_PEER_POST_ID:-}" ]]; then
  echo 'A dedicated protected USER and a visible dedicated peer post are required.' >&2; exit 1
fi
device="${ANDROID_DEVICE:-}"
if [[ -z "$device" ]]; then device="$(adb devices | awk 'NR > 1 && $2 == "device" { print $1; exit }')"; fi
if [[ -z "$device" ]]; then echo 'A booted Android device is required.' >&2; exit 1; fi
mkdir -p "$evidence_dir"
report_dir="$(mktemp -d)"
if ! maestro --device "$device" test --debug-output "$report_dir" .maestro/mb-628-community.yaml; then
  echo 'Community Android journey failed; sensitive UI dumps are not retained in artifacts.' >&2; exit 1
fi
adb -s "$device" exec-out screencap -p >"$evidence_dir/android-community-status.png"
{
  printf 'MB-628 Android real-contract journey passed.\n'
  printf 'Commit: %s\n' "${EVIDENCE_COMMIT_SHA:-${GITHUB_SHA:-local}}"
  printf 'Provider: %s\n' "${PROVIDER_EVIDENCE:-protected-staging}"
  printf 'Provider commit: %s\n' "${PROVIDER_COMMIT_SHA:-protected-staging}"
  printf 'Community public contract: v1.10.0\n'
  printf 'Run: %s/%s/actions/runs/%s\n' "${GITHUB_SERVER_URL:-https://github.com}" "${GITHUB_REPOSITORY:-local}" "${GITHUB_RUN_ID:-local}"
  printf 'Flow: display profile -> anonymous create -> supportive reaction -> private bookmark -> comment -> explicit report intake -> bilateral peer block -> app restart -> owner saved-post persistence.\n'
  printf 'No real users, health ranking, clinical decisions, paid media provider requests, credentials, tokens, payloads or signed URLs are retained.\n'
} >"$evidence_dir/android-community-real-contract.txt"
