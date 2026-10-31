# MB-762 opt-in Web Voice demo runbook

This is an operator checklist for an isolated, approved demo deployment.
It is not an enablement approval or an automatic paid test. Use synthetic
accounts and harmless scripted speech. Keep credentials in the operator's
secret store; never paste them into chat, Jira, Git, reports or command arguments.
No new provider registration is needed: MentalBridge already has LiveKit Cloud
and the Journal/AI Bedrock integration. Missing access requires verification
in those existing accounts, not a new account or plan upgrade.

## Before any live call

1. Record exact deployed frontend/backend source SHAs and the deployed worker
   SHA. For this release the worker is part of the backend repository. Ensure
   owner migrations and the reviewed provider contracts are deployed. Reuse
   the backend [controlled-demo runbook](https://github.com/NgyenKhoi/mentalbridge-backend/blob/497b4889297ae5bd31b799c15d9005e928d163c6/docs/ai-voice-demo-runbook.md)
   for operator-managed deployment, named dispatch, flag enablement and rollback.
   This PR adds no test webhook, privileged endpoint or environment secret.
2. Obtain explicit MB-762 campaign approval: cumulative USD ceiling including
   LiveKit media/agent/Inference and Bedrock, total STT milliseconds, TTS input
   characters and wall-clock seconds across every user, failed call and rerun.
   Reuse the owner's approved Journal route, not PLUS/Sonnet or PREMIUM/Opus
   mappings invented by QA. Verify actual remaining free allowance, AWS model
   access/quota and Hosted Agent capacity. Unverified means blocked. Never
   infer unused credit from a $0 invoice or an empty usage chart.
3. Verify `record: false`, project Agent observability off, no recording/egress,
   custom content hooks, log drains or external content export. Check Bedrock
   model-invocation logging, application/provider logs and storage policies.
   See [LiveKit recording controls](https://docs.livekit.io/reference/agents/session-recording-options/)
   and [AWS invocation logging](https://docs.aws.amazon.com/bedrock/latest/userguide/model-invocation-logging.html).
   A project setting does not cover custom export code. Global inference can
   process outside Singapore; retain the current cross-region disclosure.
   [AWS global routing](https://docs.aws.amazon.com/bedrock/latest/userguide/global-cross-region-inference.html)
   documents that boundary.
4. Approve the actual STT model, TTS model and voice using MB-760 speech evidence.
   Arrange consenting scripted readers and two distinct USER contexts with real
   microphone audio for concurrency. Report actual reader count separately from
   USER contexts: one reader operating two accounts is still one reader. Record
   only actual browser device classes/dialects; one reader cannot establish all
   three regions. No human recording or transcript is saved.
5. Prepare three distinct USERs with genuine FREE, PLUS and PREMIUM DEMO/PAID
   entitlements and a separately authenticated wrong-role account. Never edit
   token payloads or database financial rows to grant access. Read both current
   consent versions from Care, show the actual notice and collect explicit
   consent. Consent grant/revoke must use normal authorized application flows.
6. Preserve one cumulative operator ledger. Verify usage before each call and
   stop before any ceiling can be exceeded. Reserve worst-case remaining cost
   and duration for both concurrent calls, including delayed metering. If costs
   cannot be bounded, do not start. This report validator is not a spend limiter.

## Run the matrix

Use the scenario identifiers from `npm run voice:qa -- --plan <frontend-sha>
<backend-sha> <agent-sha>`. Each grouped row requires every listed subcase before PASS.
Do not save browser traces, HAR, screenshots of session/token responses, media
files or storageState. Use manual browser sessions with in-memory credentials;
do not run the general fixture Playwright command against a live deployment.

| Scenario                                    | Action and expected observation                                                                                                                                                                                               |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `free_ui_api_text`                          | FREE retains AI Text, sees the server-backed locked Voice preview, and receives server denial on direct start; no microphone or provider work                                                                                 |
| `plus_spoken_reply`, `premium_spoken_reply` | Each genuine plan with both consents: explicit start and microphone permission, real vi-VN final turn, Journal-authorized Claude reply, actual audible TTS; fixed admitted deadline                                           |
| `independent_quotas`                        | Read text/Consultation/Voice balances immediately before and after Voice-only calls for all three tiers; no text or Consultation credit change, Voice accounted by trusted delivery and ACTIVE time                           |
| `two_users_concurrent`                      | PLUS and PREMIUM stay connected simultaneously and each obtains a real spoken reply; record observed maximum 2 and timestamps privately without retaining participant identities                                              |
| `third_user_denied`, `same_user_denied`     | While both calls occupy capacity, direct API/UI third user is denied; same owner on second context/device is denied even with an available global slot. No extra agent or reservation                                         |
| `expired_entitlement`                       | Already-expired entitlement cannot start; loss during call stops further inference/audio through the owner lease                                                                                                              |
| `both_consents_revoked`                     | Revoke AI_PROCESSING and AI_VOICE_PROCESSING in separate trials. Observe local stop/context purge and no new model turn after owner authority expires. Do not claim instantaneous partition cutoff; lease is at most 10s      |
| `end_idle_deadline`                         | End button stops capture; 60s conversational silence ends; admitted hard deadline remains fixed through pauses/reconnect. Server confirms teardown before slot reuse                                                          |
| `provider_429_offline`                      | Authorized operator faults speech provider/Journal transport separately; no silent model switch, unbounded retry, raw provider error or continued capture. Restore original configuration after each fault                    |
| `crash_reconnect_stale_token`               | Close browser/crash, reconnect within grace, then retry after expiry/revocation. Reconnect cannot move hard stop or revive authority; old token cannot trigger inference. Inspect token claims only in operator RAM           |
| `foreign_user_role`                         | Another USER and wrong role cannot read session/status/connection or any transcript; internal worker paths remain inaccessible                                                                                                |
| `consultation_isolation`                    | AI participant only joins its own named AI room/dispatch. Existing Consultation rooms, appointment completion and financial counters stay unchanged; no appointment token reused                                              |
| `vietnamese_pause_noise_interrupt`          | Use MB-760 harmless scripts: long pause, noise suppression off/on, barge-in. No eager reply to partial STT; interrupt clears queued playback. Record only numeric component/audible timings actually measured, otherwise null |
| `text_fallback_no_captions`                 | End safely and manually return to text with help entry available. No captions/transcript stream exists in V1; do not count unimplemented optional captions as delivered                                                       |
| `privacy_cleanup`                           | Stop all calls, verify provider room/agent teardown, no content in logs/storage/metadata, no lingering capture; content-free records obey 30-day creation-bound retention                                                     |

## Record and publish sanitized results

The reporter accepts at most 32 KiB of closed JSON from stdin. It accepts only
public source/model/voice IDs, fixed scenario/status enums, readiness flags,
bounded numeric counters, device/dialect enums and timestamps. No names, user or
room IDs, auth data, URLs, free-form notes, transcripts or audio are accepted.
Readiness and measurements are operator-reported; the tool cannot authenticate
the account state or verify an audible call independently.

```sh
npm run voice:qa -- --plan <frontend-40-char-sha> <backend-40-char-sha> <agent-40-char-sha>
node scripts/voice-qa.mjs --report < /secure/mb762-operator-input.json
```

Use direct `node` when emitting a JSON artifact so npm's command banner does
not contaminate it. The plan starts NOT_RUN with no budget approval. Fill
approved limits and verified provider readiness only from actual evidence.
`spentMicroUsd` is the cumulative campaign cost across LiveKit and Bedrock,
not a per-call allowance. A missing field/usage measurement remains unknown.
The four component/browser timing fields are separate; TTS first-frame is not
browser-audible or Claude end-to-end latency. Never replace null with zero.

Only a complete, ready input can emit `OPERATOR_REPORTED_PASS`; incomplete and
failed rows stay visible. This consistency check neither approves providers nor
turns an operator assertion into machine-measured proof. Archive the reviewed
aggregate output with actual timestamps/source heads; keep the operator ledger
outside Git. Discard temporary operator inputs after review under the existing
data handling policy. Deterministic fixtures do not count as live evidence.

## Cleanup and rollback

End every test session and independently confirm provider cleanup; keep unknown
media quarantined and never free a slot by deleting data. Disable new admission
first on rollback, retain cleanup credentials until teardown is confirmed, then
stop the worker using the existing backend runbook. Restore every temporary
transport/provider fault setting, remove any operator-only test wiring and
verify normal AI Text still works. Record only outcome codes and final counters.
If a gate cannot be verified, record `BLOCKED_PROVIDER`/`NOT_RUN` and leave Voice
disabled. No live result or Android proof follows from this PR's green CI.
