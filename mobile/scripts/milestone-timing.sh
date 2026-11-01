#!/usr/bin/env bash

run_milestone_phase() {
  local name="$1"
  shift
  local started_at ended_at duration exit_code
  started_at="$(date +%s)"
  printf 'START %s %s\n' "$name" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" | tee -a "$MILESTONE_TIMING_FILE"

  if "$@"; then
    exit_code=0
  else
    exit_code="$?"
  fi

  ended_at="$(date +%s)"
  duration="$((ended_at - started_at))"
  printf 'END %s duration_seconds=%s exit_code=%s %s\n' \
    "$name" \
    "$duration" \
    "$exit_code" \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ)" | tee -a "$MILESTONE_TIMING_FILE"
  return "$exit_code"
}
