#!/usr/bin/env bash

set -euo pipefail

readonly evidence_dir="${NATIVE_EVIDENCE_DIR:-native-evidence}"
readonly timing_file="$evidence_dir/android-milestone-timings.txt"
readonly script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

mkdir -p "$evidence_dir"
: >"$timing_file"
export MILESTONE_TIMING_FILE="$timing_file"
source "$script_dir/milestone-timing.sh"

printf 'revision=%s\n' "${EVIDENCE_COMMIT_SHA:-local}" | tee -a "$timing_file"
run_milestone_phase native-build-install-boot npm run native:android:smoke
run_milestone_phase assessment npm run e2e:android:assessment
run_milestone_phase emotion npm run e2e:android:emotion
run_milestone_phase support-plan npm run e2e:android:support-plan
run_milestone_phase resources npm run e2e:android:resources
run_milestone_phase journal npm run e2e:android:journal
run_milestone_phase specialist npm run e2e:android:specialist
