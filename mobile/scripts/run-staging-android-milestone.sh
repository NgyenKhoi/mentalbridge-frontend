#!/usr/bin/env bash

set -euo pipefail

readonly evidence_dir="${NATIVE_EVIDENCE_DIR:-native-evidence}"
readonly timing_file="$evidence_dir/android-milestone-timings.txt"

mkdir -p "$evidence_dir"
: >"$timing_file"

run_phase() {
  local name="$1"
  shift
  local started_at ended_at duration
  started_at="$(date +%s)"
  printf 'START %s %s\n' "$name" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" | tee -a "$timing_file"
  "$@"
  ended_at="$(date +%s)"
  duration="$((ended_at - started_at))"
  printf 'END %s duration_seconds=%s %s\n' "$name" "$duration" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" | tee -a "$timing_file"
}

printf 'revision=%s\n' "${EVIDENCE_COMMIT_SHA:-local}" | tee -a "$timing_file"
run_phase native-build-install-boot npm run native:android:smoke
run_phase assessment npm run e2e:android:assessment
run_phase emotion npm run e2e:android:emotion
run_phase support-plan npm run e2e:android:support-plan
run_phase resources npm run e2e:android:resources
run_phase journal npm run e2e:android:journal
run_phase specialist npm run e2e:android:specialist
