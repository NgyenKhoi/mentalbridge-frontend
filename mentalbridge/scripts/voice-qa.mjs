import Ajv from 'ajv'
import addFormats from 'ajv-formats'
import { pathToFileURL } from 'node:url'

export const scenarios = Object.freeze([
  'free_ui_api_text',
  'plus_spoken_reply',
  'premium_spoken_reply',
  'independent_quotas',
  'two_users_concurrent',
  'third_user_denied',
  'same_user_denied',
  'expired_entitlement',
  'both_consents_revoked',
  'end_idle_deadline',
  'provider_429_offline',
  'crash_reconnect_stale_token',
  'foreign_user_role',
  'consultation_isolation',
  'vietnamese_pause_noise_interrupt',
  'text_fallback_no_captions',
  'privacy_cleanup',
])
export const gates = Object.freeze([
  'livekitAllowance',
  'bedrockAccessQuota',
  'hostedAgent',
  'recordingEgressExportOff',
  'observabilityContentLoggingOff',
  'speechModelVoiceApproved',
  'consentingScriptedReaders',
  'isolatedDemoEnvironment',
  'ownerProviderApproval',
])
const closed = (properties) => ({
  type: 'object',
  additionalProperties: false,
  required: Object.keys(properties),
  properties,
})
const count = { type: 'integer', minimum: 0, maximum: 1_000_000_000 }
const nullableCount = { anyOf: [count, { type: 'null' }] }
const sha = { type: 'string', pattern: '^[a-f0-9]{40}$' }
const nullableModel = (values) => ({ enum: [null, ...values] })
const schema = closed({
  schemaVersion: { const: 1 },
  mode: { enum: ['NOT_RUN', 'OPERATOR_LIVE'] },
  checkedAt: { type: 'string', format: 'date-time' },
  sources: closed({ frontend: sha, backend: sha, agent: sha }),
  approval: { enum: ['NOT_APPROVED', 'APPROVED'] },
  readiness: closed(
    Object.fromEntries(gates.map((key) => [key, { type: 'boolean' }])),
  ),
  providers: closed({
    stt: nullableModel(['deepgram/nova-3', 'deepgram/nova-2']),
    tts: nullableModel(['cartesia/sonic-3-2026-01-12']),
    voice: {
      anyOf: [{ type: 'string', format: 'uuid' }, { type: 'null' }],
    },
    bedrock: nullableModel([
      'anthropic.claude-sonnet-4-6',
      'global.anthropic.claude-sonnet-4-6',
      'anthropic.claude-opus-4-6-v1',
      'global.anthropic.claude-opus-4-6-v1',
    ]),
  }),
  budget: closed({
    approvedMicroUsd: nullableCount,
    spentMicroUsd: nullableCount,
    approvedSttMs: nullableCount,
    usedSttMs: count,
    approvedTtsCharacters: nullableCount,
    usedTtsCharacters: count,
    approvedWallSeconds: nullableCount,
    usedWallSeconds: count,
  }),
  observations: closed({
    consentingReaders: count,
    realMicrophoneUsers: count,
    maxConcurrentUsers: { type: 'integer', minimum: 0, maximum: 10 },
    spokenReplies: count,
    devices: {
      type: 'array',
      uniqueItems: true,
      items: { enum: ['LAPTOP_BROWSER', 'DESKTOP_BROWSER'] },
    },
    dialects: {
      type: 'array',
      uniqueItems: true,
      items: { enum: ['NORTH', 'CENTRAL', 'SOUTH'] },
    },
  }),
  latencySamples: {
    type: 'array',
    maxItems: 20,
    items: closed({
      sttFinalMs: nullableCount,
      journalReplyMs: nullableCount,
      ttsFirstFrameMs: nullableCount,
      browserAudibleMs: nullableCount,
    }),
  },
  quotaSnapshots: {
    type: 'array',
    maxItems: 3,
    items: closed({
      actor: { enum: ['FREE', 'PLUS', 'PREMIUM'] },
      before: closed({
        textRemaining: count,
        consultationCreditsRemaining: count,
        voiceRemainingSessions: count,
        voiceRemainingSeconds: count,
      }),
      after: closed({
        textRemaining: count,
        consultationCreditsRemaining: count,
        voiceRemainingSessions: count,
        voiceRemainingSeconds: count,
      }),
    }),
  },
  results: {
    type: 'array',
    minItems: scenarios.length,
    maxItems: scenarios.length,
    items: closed({
      scenario: { enum: scenarios },
      status: { enum: ['PASS', 'FAIL', 'NOT_RUN', 'BLOCKED_PROVIDER'] },
    }),
  },
})
const ajv = new Ajv({ strict: true })
addFormats(ajv)
const valid = ajv.compile(schema)

export function plan(sources, checkedAt = new Date().toISOString()) {
  return {
    schemaVersion: 1,
    mode: 'NOT_RUN',
    checkedAt,
    sources,
    approval: 'NOT_APPROVED',
    readiness: Object.fromEntries(gates.map((gate) => [gate, false])),
    providers: { stt: null, tts: null, voice: null, bedrock: null },
    budget: {
      approvedMicroUsd: null,
      spentMicroUsd: null,
      approvedSttMs: null,
      usedSttMs: 0,
      approvedTtsCharacters: null,
      usedTtsCharacters: 0,
      approvedWallSeconds: null,
      usedWallSeconds: 0,
    },
    observations: {
      consentingReaders: 0,
      realMicrophoneUsers: 0,
      maxConcurrentUsers: 0,
      spokenReplies: 0,
      devices: [],
      dialects: [],
    },
    quotaSnapshots: [],
    latencySamples: [],
    results: scenarios.map((scenario) => ({ scenario, status: 'NOT_RUN' })),
  }
}

/**
 * @template T
 * @param {T} input
 * @returns {T & {evidenceKind: string, status: string, blockers: string[], providerCallsByTool: number}}
 */
export function report(input) {
  if (
    !valid(input) ||
    new Set(input.results.map((row) => row.scenario)).size !==
      scenarios.length ||
    new Set(input.quotaSnapshots.map((row) => row.actor)).size !==
      input.quotaSnapshots.length
  )
    throw new Error('INVALID_VOICE_QA_INPUT')
  const blockers = gates.filter((gate) => !input.readiness[gate])
  if (input.approval !== 'APPROVED') blockers.push('approval')
  if (Object.values(input.providers).some((value) => value === null))
    blockers.push('providerSelection')
  const budget = input.budget
  for (const [limit, used] of [
    ['approvedMicroUsd', 'spentMicroUsd'],
    ['approvedSttMs', 'usedSttMs'],
    ['approvedTtsCharacters', 'usedTtsCharacters'],
    ['approvedWallSeconds', 'usedWallSeconds'],
  ]) {
    if (budget[limit] === null || budget[limit] === 0 || budget[used] === null)
      blockers.push(limit)
    else if (budget[used] > budget[limit]) blockers.push('budgetExceeded')
  }
  const passed = input.results.filter((row) => row.status === 'PASS')
  if (
    input.mode === 'NOT_RUN' &&
    (input.results.some(
      (row) => !['NOT_RUN', 'BLOCKED_PROVIDER'].includes(row.status),
    ) ||
      Object.values(input.observations).some((value) =>
        Array.isArray(value) ? value.length > 0 : value > 0,
      ) ||
      input.quotaSnapshots.length > 0 ||
      input.latencySamples.length > 0 ||
      budget.usedSttMs > 0 ||
      budget.usedTtsCharacters > 0 ||
      budget.usedWallSeconds > 0 ||
      (budget.spentMicroUsd ?? 0) > 0)
  )
    throw new Error('INVALID_VOICE_QA_INPUT')
  if (
    passed.length > 0 &&
    (input.mode !== 'OPERATOR_LIVE' || blockers.length > 0)
  )
    throw new Error('UNSUPPORTED_VOICE_QA_PASS')
  if (passed.length === scenarios.length) {
    if (
      input.observations.realMicrophoneUsers < 2 ||
      input.observations.consentingReaders <
        input.observations.dialects.length ||
      input.observations.maxConcurrentUsers !== 2 ||
      input.observations.spokenReplies < 2 ||
      input.observations.devices.length === 0 ||
      input.observations.dialects.length === 0 ||
      input.quotaSnapshots.length !== 3 ||
      input.quotaSnapshots.some(
        ({ before, after }) =>
          before.textRemaining !== after.textRemaining ||
          before.consultationCreditsRemaining !==
            after.consultationCreditsRemaining,
      )
    )
      throw new Error('UNSUPPORTED_VOICE_QA_PASS')
  }
  return {
    ...input,
    evidenceKind: 'OPERATOR_REPORTED_NOT_INDEPENDENTLY_VERIFIED',
    status: input.results.some((row) => row.status === 'FAIL')
      ? 'FAIL'
      : blockers.length > 0
        ? 'BLOCKED_PROVIDER'
        : passed.length === scenarios.length
          ? 'OPERATOR_REPORTED_PASS'
          : 'NOT_RUN_OR_INCOMPLETE',
    blockers: [...new Set(blockers)],
    providerCallsByTool: 0,
  }
}

async function main() {
  if (process.argv[2] === '--plan' && process.argv.length === 6) {
    const input = plan({
      frontend: process.argv[3],
      backend: process.argv[4],
      agent: process.argv[5],
    })
    report(input)
    process.stdout.write(JSON.stringify(input, null, 2) + '\n')
    return
  }
  if (process.argv[2] !== '--report' || process.argv.length !== 3)
    throw new Error('INVALID_VOICE_QA_INPUT')
  const chunks = []
  let size = 0
  for await (const chunk of process.stdin) {
    size += chunk.length
    if (size > 32_768) throw new Error('INVALID_VOICE_QA_INPUT')
    chunks.push(chunk)
  }
  const output = report(JSON.parse(Buffer.concat(chunks).toString('utf8')))
  process.stdout.write(JSON.stringify(output, null, 2) + '\n')
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch(() => {
    process.stderr.write(
      'Voice QA report rejected; no input or provider data emitted.\n',
    )
    process.exitCode = 2
  })
