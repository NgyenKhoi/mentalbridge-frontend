#!/usr/bin/env bash

set -euo pipefail

readonly evidence_dir="${NATIVE_EVIDENCE_DIR:-native-evidence}"
readonly status_file="$evidence_dir/mb-666-journey-status.tsv"
readonly persona_a_email="${MAESTRO_MB666_PERSONA_A_EMAIL:-}"
readonly persona_a_password="${MAESTRO_MB666_PERSONA_A_PASSWORD:-}"
readonly persona_b_email="${MAESTRO_MB666_PERSONA_B_EMAIL:-}"
readonly persona_b_password="${MAESTRO_MB666_PERSONA_B_PASSWORD:-}"

command -v adb >/dev/null
command -v maestro >/dev/null
node scripts/validate-mb666-fixture-manifest.mjs

device="${ANDROID_DEVICE:-}"
if [[ -z "$device" ]]; then
  device="$(adb devices | awk 'NR > 1 && $2 == "device" { print $1; exit }')"
fi
if [[ -z "$device" ]]; then
  echo 'No booted Android device or emulator is available.' >&2
  exit 1
fi

required_environment=(
  MB666_FIXTURE_CONTROL_URL
  MB666_FIXTURE_CONTROL_TOKEN
  FIXTURE_DATASET_VERSION
  EVIDENCE_COMMIT_SHA
  BACKEND_COMMIT_SHA
  MAESTRO_MB666_PERSONA_A_EMAIL
  MAESTRO_MB666_PERSONA_A_PASSWORD
  MAESTRO_MB666_PERSONA_B_EMAIL
  MAESTRO_MB666_PERSONA_B_PASSWORD
  MAESTRO_MB_HOME_NEXT_STEP_TITLE
  MAESTRO_MB_HOME_AFTER_TITLE
  MAESTRO_MB664_CHANGE_OPTION
  MAESTRO_MB664_CHANGE_RESULT
  MAESTRO_MB_ACHIEVEMENT_TITLE
  MAESTRO_MB_REWARD_POLICY_VERSION
  MAESTRO_MB_BINGO_VERIFIED_LABEL
  MAESTRO_MB_BINGO_SELF_POSITION
  MAESTRO_MB_DISCOVERY_SPECIALIST_ID
  MAESTRO_MB_DISCOVERY_SLOT_ID
)
for name in "${required_environment[@]}"; do
  if [[ -z "${!name:-}" ]]; then
    echo "$name is required by the protected MB-666 milestone." >&2
    exit 1
  fi
done

mkdir -p "$evidence_dir"
: >"$status_file"

use_persona_a() {
  export MAESTRO_MB_USER_EMAIL="$persona_a_email"
  export MAESTRO_MB_USER_PASSWORD="$persona_a_password"
  export MAESTRO_MB_SUPPORT_PLAN_USER_EMAIL="$persona_a_email"
  export MAESTRO_MB_SUPPORT_PLAN_USER_PASSWORD="$persona_a_password"
  export MAESTRO_MB_HOME_USER_EMAIL="$persona_a_email"
  export MAESTRO_MB_HOME_USER_PASSWORD="$persona_a_password"
  export MAESTRO_MB664_SCREENING_EMAIL="$persona_a_email"
  export MAESTRO_MB664_SCREENING_PASSWORD="$persona_a_password"
  export MAESTRO_MB664_KEEP_EMAIL="$persona_a_email"
  export MAESTRO_MB664_KEEP_PASSWORD="$persona_a_password"
  export MAESTRO_MB664_CHANGE_EMAIL="$persona_a_email"
  export MAESTRO_MB664_CHANGE_PASSWORD="$persona_a_password"
  export MAESTRO_MB642_DISPOSABLE_FIXTURE='true'
}

use_persona_b() {
  export MAESTRO_MB_USER_EMAIL="$persona_b_email"
  export MAESTRO_MB_USER_PASSWORD="$persona_b_password"
  export MAESTRO_MB_SUPPORT_PLAN_USER_EMAIL="$persona_b_email"
  export MAESTRO_MB_SUPPORT_PLAN_USER_PASSWORD="$persona_b_password"
}

record_status() {
  local scene_id="$1"
  local status="$2"
  local duration="$3"
  local evidence_file="$4"
  printf '%s\t%s\t%s\t%s\n' "$scene_id" "$status" "$duration" "$evidence_file" >>"$status_file"
}

run_scene() {
  local scene_id="$1"
  local flow="$2"
  local evidence_file="$3"
  local started_at ended_at duration
  started_at="$(date +%s)"
  printf 'MB-666 scene %s: reset -> %s\n' "$scene_id" "$flow"
  if node scripts/prepare-mb666-fixture.mjs "$scene_id" && \
    maestro --device "$device" test "$flow"; then
    adb -s "$device" exec-out screencap -p >"$evidence_dir/$evidence_file"
    ended_at="$(date +%s)"
    duration="$((ended_at - started_at))"
    record_status "$scene_id" STAGING_PASS "$duration" "$evidence_file"
    return 0
  fi
  adb -s "$device" exec-out screencap -p \
    >"$evidence_dir/${evidence_file%.png}-failure.png" || true
  ended_at="$(date +%s)"
  duration="$((ended_at - started_at))"
  record_status "$scene_id" STAGING_FAIL "$duration" "$evidence_file"
  return 1
}

overall=0
use_persona_a
run_scene persona-a-screening-guide .maestro/mb-668-guided-journey.yaml mb-666-persona-a-screening-guide.png || overall=1
run_scene persona-a-home-plan .maestro/mb-663-home-next-step.yaml mb-666-persona-a-home-plan.png || overall=1
run_scene persona-a-plan-personalization .maestro/mb-638-support-plan-personalization.yaml mb-666-persona-a-plan-personalization.png || overall=1
run_scene persona-a-emotion-plan .maestro/mb-641-emotion-plan.yaml mb-666-persona-a-emotion.png || overall=1
run_scene persona-a-journal-plan .maestro/mb-642-journal-plan.yaml mb-666-persona-a-journal.png || overall=1
run_scene persona-a-resource-progress .maestro/mb-626-resources.yaml mb-666-persona-a-resource.png || overall=1
run_scene persona-a-reassessment-resume .maestro/mb-664-reassessment-screening-resume.yaml mb-666-persona-a-reassessment-resume.png || overall=1
run_scene persona-a-reassessment-keep .maestro/mb-664-reassessment-keep.yaml mb-666-persona-a-reassessment-keep.png || overall=1
run_scene persona-a-reassessment-change .maestro/mb-664-reassessment-change.yaml mb-666-persona-a-reassessment-change.png || overall=1
run_scene persona-a-owner-rewards .maestro/mb-665-owner-rewards.yaml mb-666-persona-a-owner-rewards.png || overall=1

use_persona_b
run_scene persona-b-professional-support .maestro/mb-643-professional-support.yaml mb-666-persona-b-professional-support.png || overall=1
if [[ "${MB666_ENABLE_OPTIONAL_CHAT:-false}" == 'true' ]]; then
  run_scene persona-b-authorized-chat .maestro/mb-631-chat.yaml mb-666-persona-b-chat.png || overall=1
else
  record_status persona-b-authorized-chat DEFERRED 0 mb-666-persona-b-chat.png
fi

node scripts/write-mb666-evidence-index.mjs || overall=1
exit "$overall"
