#!/usr/bin/env bash
set -euo pipefail

readonly evidence_dir="${NATIVE_EVIDENCE_DIR:-native-evidence}"
command -v adb >/dev/null
command -v maestro >/dev/null
if [[ -z "${MAESTRO_MB_USER_EMAIL:-}" || -z "${MAESTRO_MB_USER_PASSWORD:-}" ]]; then
  echo 'A dedicated protected USER fixture is required.' >&2; exit 1
fi
device="${ANDROID_DEVICE:-}"
if [[ -z "$device" ]]; then device="$(adb devices | awk 'NR > 1 && $2 == "device" { print $1; exit }')"; fi
if [[ -z "$device" ]]; then echo 'A booted Android device is required.' >&2; exit 1; fi
mkdir -p "$evidence_dir"
# Detailed Maestro reports can contain fixture credentials/text. They are kept
# outside the artifact tree and are never uploaded, even on failure.
report_dir="$(mktemp -d)"
if ! maestro --device "$device" test --debug-output "$report_dir" .maestro/mb-627-journal.yaml; then
  echo 'Journal Android real-contract journey failed; no sensitive UI dump was retained.' >&2
  exit 1
fi
adb -s "$device" exec-out screencap -p >"$evidence_dir/android-journal-status.png"
{
  printf 'MB-627 Android real-contract journey passed.\n'
  printf 'Commit: %s\n' "${EVIDENCE_COMMIT_SHA:-${GITHUB_SHA:-local}}"
  printf 'Provider: %s\n' "${PROVIDER_EVIDENCE:-protected-staging}"
  printf 'Provider commit: %s\n' "${PROVIDER_COMMIT_SHA:-protected-staging}"
  printf 'Run: %s/%s/actions/runs/%s\n' "${GITHUB_SERVER_URL:-https://github.com}" "${GITHUB_REPOSITORY:-local}" "${GITHUB_RUN_ID:-local}"
  printf 'Flow: private Journal save -> explicit consent -> explicit AI request -> authoritative terminal status -> app restart -> persisted Journal and job GET reload.\n'
  if [[ "${PROVIDER_EVIDENCE:-}" == 'protected-controlled-real-contract' ]]; then
    printf 'Controlled dependency fault: Consultation is absent; real Journal worker records ENTITLEMENT_UNAVAILABLE. No fake permission or AI output is supplied.\n'
  fi
  printf 'Artifact excludes tokens, credentials, real private Journal/AI content, and request payloads. Dedicated synthetic fixture only.\n'
} >"$evidence_dir/android-journal-real-contract.txt"
