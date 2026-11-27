#!/usr/bin/env bash

set -euo pipefail

readonly app_id="com.mentalbridge.mobile"
readonly evidence_dir="${NATIVE_EVIDENCE_DIR:-native-evidence}"

command -v xcrun >/dev/null
command -v jq >/dev/null
mkdir -p "$evidence_dir" "${HOME}/.expo"

readonly expected_xcode_version="${XCODE_VERSION:-26.4.1}"
readonly expected_xcode_build="${XCODE_BUILD:-17E202}"
actual_xcode_version="$(xcodebuild -version | awk 'NR == 1 { print $2 }')"
actual_xcode_build="$(xcodebuild -version | awk 'NR == 2 { print $3 }')"
if [[ "$actual_xcode_version" != "$expected_xcode_version" || "$actual_xcode_build" != "$expected_xcode_build" ]]; then
  echo "Expected Xcode $expected_xcode_version ($expected_xcode_build); found $actual_xcode_version ($actual_xcode_build)." >&2
  exit 1
fi

device="${IOS_DEVICE:-}"
if [[ -z "$device" ]]; then
  readonly runtime_id="${IOS_RUNTIME_ID:-com.apple.CoreSimulator.SimRuntime.iOS-26-4}"
  readonly device_name="${IOS_DEVICE_NAME:-iPhone 17}"
  device="$(
    xcrun simctl list devices available --json |
      jq -r --arg runtime "$runtime_id" --arg name "$device_name" \
        '(.devices[$runtime] // []) | map(select(.name == $name))[0].udid // empty'
  )"
fi

if [[ -z "$device" ]]; then
  echo "The pinned iPhone simulator is not available." >&2
  exit 1
fi

xcrun simctl boot "$device" 2>/dev/null || true
xcrun simctl bootstatus "$device" -b

export CI="${CI:-true}"
npx expo run:ios \
  --configuration Release \
  --no-bundler \
  --device "$device"

xcrun simctl get_app_container "$device" "$app_id" app \
  >"$evidence_dir/ios-app-container.txt"
xcrun simctl terminate "$device" "$app_id" 2>/dev/null || true
launch_output="$(xcrun simctl launch "$device" "$app_id")"
printf '%s\n' "$launch_output" >"$evidence_dir/ios-launch.txt"

app_pid="${launch_output##*: }"
if [[ ! "$app_pid" =~ ^[0-9]+$ ]]; then
  echo "iOS simulator did not return an application PID." >&2
  exit 1
fi

sleep 10
xcrun simctl io "$device" screenshot "$evidence_dir/ios-boot.png"
if ! kill -0 "$app_pid"; then
  echo "iOS app process is not alive after launch." >&2
  exit 1
fi
ps -p "$app_pid" -o pid=,etime=,command= \
  >"$evidence_dir/ios-process.txt"

printf 'iOS native boot verified for %s with PID %s.\n' "$device" "$app_pid"
