#!/usr/bin/env bash

set -euo pipefail

readonly script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly test_dir="$(mktemp -d)"
trap 'rm -rf "$test_dir"' EXIT

export MILESTONE_TIMING_FILE="$test_dir/timings.txt"
source "$script_dir/milestone-timing.sh"

set +e
run_milestone_phase expected-failure bash -c 'exit 23'
readonly phase_status="$?"
set -e

test "$phase_status" -eq 23
grep -Eq '^START expected-failure ' "$MILESTONE_TIMING_FILE"
grep -Eq '^END expected-failure duration_seconds=[0-9]+ exit_code=23 ' "$MILESTONE_TIMING_FILE"

printf 'Milestone failure timing verified.\n'
