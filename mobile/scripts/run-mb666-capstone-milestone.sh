#!/usr/bin/env bash

set -euo pipefail

readonly evidence_root="${NATIVE_EVIDENCE_DIR:-native-evidence}"
readonly evidence_run_id="${MB666_EVIDENCE_RUN_ID:-${GITHUB_RUN_ID:-}-${GITHUB_RUN_ATTEMPT:-}}"
readonly evidence_mode="${MB666_EVIDENCE_MODE:-}"
readonly run_parent="$evidence_root/mb-666-runs"
readonly run_dir="$run_parent/$evidence_run_id"
readonly status_file="$run_dir/mb-666-journey-status.tsv"
readonly persona_a_email="${MAESTRO_MB666_PERSONA_A_EMAIL:-}"
readonly persona_a_password="${MAESTRO_MB666_PERSONA_A_PASSWORD:-}"
readonly persona_b_email="${MAESTRO_MB666_PERSONA_B_EMAIL:-}"
readonly persona_b_password="${MAESTRO_MB666_PERSONA_B_PASSWORD:-}"

command -v adb >/dev/null
command -v maestro >/dev/null
node scripts/validate-mb666-fixture-manifest.mjs

if [[ ! "$evidence_run_id" =~ ^[A-Za-z0-9][A-Za-z0-9._:@-]{0,127}$ ]]; then
  echo 'MB666_EVIDENCE_RUN_ID must be a safe unique immutable identifier.' >&2
  exit 1
fi
if [[ "$evidence_mode" != 'automated-emulator' && "$evidence_mode" != 'physical-acceptance' ]]; then
  echo 'MB666_EVIDENCE_MODE must be automated-emulator or physical-acceptance.' >&2
  exit 1
fi
if [[ ! -f "$evidence_root/milestone-provenance.json" ]]; then
  echo 'Validated milestone-provenance.json is required before MB-666.' >&2
  exit 1
fi

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
  BACKEND_CONTRACT_TREE
  STAGING_DEPLOYMENT_ID
  GITHUB_RUN_ID
  GITHUB_RUN_ATTEMPT
  MAESTRO_MB666_PERSONA_A_EMAIL
  MAESTRO_MB666_PERSONA_A_PASSWORD
  MAESTRO_MB666_PERSONA_B_EMAIL
  MAESTRO_MB666_PERSONA_B_PASSWORD
  MAESTRO_MB_HOME_NEXT_STEP_TITLE
  MAESTRO_MB_HOME_AFTER_TITLE
  MAESTRO_MB664_CHANGE_OPTION
  MAESTRO_MB664_CHANGE_RESULT
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

# Never reuse, clean or overwrite an earlier run. A collision fails closed.
mkdir -p "$run_parent"
if ! mkdir "$run_dir"; then
  echo "Evidence run directory already exists: $run_dir" >&2
  exit 1
fi
export ANDROID_DEVICE="$device"
export MB666_EVIDENCE_RUN_ID="$evidence_run_id"
export MB666_EVIDENCE_RUN_DIR="$run_dir"
export MB666_MILESTONE_PROVENANCE_PATH="$evidence_root/milestone-provenance.json"
node scripts/classify-mb666-device.mjs
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
  local evidence_files="$4"
  printf '%s\t%s\t%s\t%s\n' \
    "$scene_id" "$status" "$duration" "$evidence_files" >>"$status_file"
}

capture_evidence() {
  local evidence_files="$1"
  local file
  IFS=',' read -ra files <<<"$evidence_files"
  for file in "${files[@]}"; do
    node scripts/capture-mb666-screenshot.mjs \
      "$device" \
      "$run_dir/$file"
  done
}

run_scene() {
  local scene_id="$1"
  local flow="$2"
  local evidence_files="$3"
  local continuous="${4:-false}"
  local started_at ended_at duration
  started_at="$(date +%s)"
  printf 'MB-666 scene %s: protected reset -> %s\n' "$scene_id" "$flow"
  if node scripts/prepare-mb666-fixture.mjs "$scene_id" && \
    maestro --device "$device" test "$flow" && \
    { [[ "$continuous" != 'true' ]] || node scripts/verify-mb666-continuous-persona.mjs; } && \
    capture_evidence "$evidence_files"; then
    ended_at="$(date +%s)"
    duration="$((ended_at - started_at))"
    record_status "$scene_id" PASS "$duration" "$evidence_files"
    return 0
  fi
  ended_at="$(date +%s)"
  duration="$((ended_at - started_at))"
  record_status "$scene_id" FAIL "$duration" "$evidence_files"
  return 1
}

overall=0
use_persona_a
run_scene persona-a-continuous-core-loop .maestro/mb-666-persona-a-continuous.yaml mb-666-persona-a-continuous-core-loop.png true || overall=1
run_scene persona-a-screening-guide .maestro/mb-668-guided-journey.yaml mb-666-persona-a-screening-guide.png || overall=1
run_scene persona-a-home-plan .maestro/mb-663-home-next-step.yaml mb-666-persona-a-home-plan.png || overall=1
run_scene persona-a-plan-personalization .maestro/mb-638-support-plan-personalization.yaml mb-666-persona-a-plan-personalization.png || overall=1
run_scene persona-a-emotion-plan .maestro/mb-641-emotion-plan.yaml mb-666-persona-a-emotion.png || overall=1
run_scene persona-a-journal-plan .maestro/mb-642-journal-plan.yaml mb-666-persona-a-journal.png || overall=1
run_scene persona-a-resource-progress .maestro/mb-626-resources.yaml mb-666-persona-a-resource.png || overall=1
run_scene persona-a-reassessment-resume .maestro/mb-664-reassessment-screening-resume.yaml mb-666-persona-a-reassessment-resume.png || overall=1
run_scene persona-a-reassessment-keep .maestro/mb-664-reassessment-keep.yaml mb-666-persona-a-reassessment-keep.png || overall=1
run_scene persona-a-reassessment-change .maestro/mb-664-reassessment-change.yaml mb-666-persona-a-reassessment-change.png || overall=1
run_scene persona-a-bingo-progress .maestro/mb-666-bingo-core.yaml mb-666-persona-a-bingo-progress.png || overall=1

if [[ "${MB666_ENABLE_OPTIONAL_REWARDS:-false}" == 'true' ]]; then
  run_scene persona-a-owner-rewards .maestro/mb-665-owner-rewards.yaml mb-666-persona-a-owner-rewards.png || overall=1
else
  record_status persona-a-owner-rewards DEFERRED 0 mb-666-persona-a-owner-rewards.png
fi

use_persona_b
run_scene persona-b-professional-support .maestro/mb-643-professional-support.yaml mb-666-persona-b-professional-support.png || overall=1
if [[ "${MB666_ENABLE_OPTIONAL_CHAT:-false}" == 'true' ]]; then
  run_scene persona-b-authorized-chat .maestro/mb-631-chat.yaml mb-666-persona-b-chat.png || overall=1
else
  record_status persona-b-authorized-chat DEFERRED 0 mb-666-persona-b-chat.png
fi

node scripts/write-mb666-evidence-index.mjs || overall=1
exit "$overall"
