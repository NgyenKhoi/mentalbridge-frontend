#!/usr/bin/env bash
set -euo pipefail
test "${CI:-}" = 'true'
test "${PROVIDER_EVIDENCE:-}" = 'protected-controlled-real-contract'
test "${MOBILE_EVIDENCE_FEATURE:-}" = 'chat'
test -n "${MAESTRO_MB_CHAT_APPOINTMENT_ID:-}"
readonly evidence_dir="${NATIVE_EVIDENCE_DIR:-native-evidence}"
device="${ANDROID_DEVICE:-emulator-5554}"
mkdir -p "$evidence_dir"
edge_pid=''; peer_pid=''
cleanup() { if [[ -n "$peer_pid" ]]; then kill "$peer_pid" 2>/dev/null || true; fi; if [[ -n "$edge_pid" ]]; then kill "$edge_pid" 2>/dev/null || true; fi; }
trap cleanup EXIT
node scripts/controlled-chat-edge.mjs >"$evidence_dir/android-chat-edge.log" 2>&1 &
edge_pid="$!"
for attempt in {1..20}; do
  if curl -fsS http://127.0.0.1:8088/health/ready >/dev/null; then break; fi
  if [[ "$attempt" == 20 ]]; then echo 'Controlled chat edge unavailable.' >&2; exit 1; fi
  sleep 1
done
npm run native:android:smoke
adb -s "$device" reverse tcp:8088 tcp:8088
adb -s "$device" shell wm size 750x1600
adb -s "$device" shell wm density 320
node scripts/chat-e2e-fixture.mjs activate
node scripts/chat-e2e-fixture.mjs peer >"$evidence_dir/android-chat-peer.txt" 2>&1 &
peer_pid="$!"
for attempt in {1..20}; do
  if grep -Fq 'durable message accepted' "$evidence_dir/android-chat-peer.txt"; then break; fi
  if ! kill -0 "$peer_pid" 2>/dev/null || [[ "$attempt" == 20 ]]; then echo 'Protected chat peer unavailable.' >&2; exit 1; fi
  sleep 1
done
report_dir="$(mktemp -d)"
run_flow() {
  if ! maestro --device "$device" test --debug-output "$report_dir" ".maestro/$1.yaml"; then
    echo 'Chat journey failed; raw login/UI dumps not retained.' >&2; exit 1
  fi
}
run_flow mb-631-chat
adb -s "$device" exec-out screencap -p >"$evidence_dir/android-chat-active.png"
# Same mounted component backgrounds/foregrounds; not a force-stop restart.
adb -s "$device" shell input keyevent KEYCODE_HOME
sleep 3
adb -s "$device" shell monkey -p com.mentalbridge.mobile -c android.intent.category.LAUNCHER 1 >/dev/null
run_flow mb-631-reconnected
adb -s "$device" exec-out screencap -p >"$evidence_dir/android-chat-reconnected.png"
run_flow mb-631-persisted
node scripts/chat-e2e-fixture.mjs close
run_flow mb-631-closed
node scripts/chat-e2e-fixture.mjs verify
adb -s "$device" exec-out screencap -p >"$evidence_dir/android-chat-closed.png"
for viewport in '768 1024' '1280 800' '1440 900'; do
  read -r width height <<<"$viewport"
  adb -s "$device" shell wm size "$((width * 2))x$((height * 2))"
  sleep 2
  adb -s "$device" exec-out screencap -p >"$evidence_dir/android-chat-layout-${width}.png"
done
adb -s "$device" shell wm size reset
adb -s "$device" shell wm density reset
{
  printf 'MB-631 protected Android real-contract journey passed.\nCommit: %s\nProvider commit: %s\nProvider: %s\n' "$EVIDENCE_COMMIT_SHA" "$PROVIDER_COMMIT_SHA" "$PROVIDER_EVIDENCE"
  printf 'Run: %s/%s/actions/runs/%s\n' "$GITHUB_SERVER_URL" "$GITHUB_REPOSITORY" "$GITHUB_RUN_ID"
  printf 'Real Identity USER/SPECIALIST -> public request/accept -> authoritative ACTIVE eligibility -> one-use Socket.IO v1 credentials -> explicit check-in -> send/receive -> mounted background/foreground reconnect -> app restart/history -> authoritative closed/history-only.\n'
  printf 'Exactly two distinct durable messages verified through real REST history. No automatic replay or invented receipts/completion/settlement.\n'
  printf 'Test-only disposable interval/booking-timestamp compression preserves 60-minute constraints; no status/outcome/evidence/ledger/payout seeded. Real Consultation clock and scheduler own closure.\n'
  printf 'Synthetic accounts/messages only. 375x800dp active/reconnected/closed; 768x1024dp,1280x800dp,1440x900dp closed layout. No tokens/passwords/raw real chat/provider payloads retained.\n'
} >"$evidence_dir/android-chat-real-contract.txt"
