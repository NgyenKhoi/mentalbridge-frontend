#!/usr/bin/env bash

set -euo pipefail

readonly app_id="com.mentalbridge.mobile"
readonly evidence_dir="${NATIVE_EVIDENCE_DIR:-native-evidence}"

command -v adb >/dev/null
mkdir -p "$evidence_dir"

device="${ANDROID_DEVICE:-}"
if [[ -z "$device" ]]; then
  device="$(adb devices | awk 'NR > 1 && $2 == "device" { print $1; exit }')"
fi

if [[ -z "$device" ]]; then
  echo "No booted Android device or emulator is available." >&2
  exit 1
fi

export CI="${CI:-true}"
npx expo run:android \
  --variant release \
  --no-bundler

adb -s "$device" shell am force-stop "$app_id"
adb -s "$device" shell monkey \
  -p "$app_id" \
  -c android.intent.category.LAUNCHER \
  1 >"$evidence_dir/android-launch.txt"
sleep 10

app_pid="$(adb -s "$device" shell pidof "$app_id" | tr -d '\r')"
if [[ -z "$app_pid" ]]; then
  echo "Android app process is not alive after launch." >&2
  exit 1
fi

adb -s "$device" shell dumpsys window windows \
  >"$evidence_dir/android-window.txt"
adb -s "$device" shell dumpsys activity activities \
  >"$evidence_dir/android-activity.txt"
grep -E 'mResumedActivity|topResumedActivity|ResumedActivity' \
  "$evidence_dir/android-activity.txt" \
  >"$evidence_dir/android-focus.txt" || true
adb -s "$device" exec-out screencap -p \
  >"$evidence_dir/android-boot.png"

if ! grep -Fq "$app_id" "$evidence_dir/android-focus.txt"; then
  echo "Android app did not become the resumed foreground activity." >&2
  exit 1
fi

printf 'Android native boot verified for %s with PID %s.\n' "$device" "$app_pid"
