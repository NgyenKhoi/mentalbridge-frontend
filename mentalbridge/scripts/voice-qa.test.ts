// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { gates, plan, report, scenarios } from './voice-qa.mjs'

const sources = {
  frontend: '1'.repeat(40),
  backend: '2'.repeat(40),
  agent: '3'.repeat(40),
}
const pending = () => plan({ ...sources }, '2026-10-28T14:30:00Z')
function observed(
  voice: string | null = '11111111-1111-4111-8111-111111111111',
) {
  return {
    ...pending(),
    mode: 'OPERATOR_LIVE',
    approval: 'APPROVED',
    readiness: Object.fromEntries(gates.map((gate) => [gate, true])),
    providers: {
      stt: 'deepgram/nova-3',
      tts: 'cartesia/sonic-3-2026-01-12',
      voice,
      bedrock: 'global.anthropic.claude-sonnet-4-6',
    },
    budget: {
      approvedMicroUsd: 100000,
      spentMicroUsd: 10000,
      approvedSttMs: 60000,
      usedSttMs: 10000,
      approvedTtsCharacters: 200,
      usedTtsCharacters: 20,
      approvedWallSeconds: 120,
      usedWallSeconds: 30,
    },
    observations: {
      consentingReaders: 1,
      realMicrophoneUsers: 2,
      maxConcurrentUsers: 2,
      spokenReplies: 2,
      devices: ['LAPTOP_BROWSER'],
      dialects: ['SOUTH'],
    },
    results: scenarios.map((scenario) => ({ scenario, status: 'PASS' })),
    quotaSnapshots: ['FREE', 'PLUS', 'PREMIUM'].map((actor) => ({
      actor,
      before: {
        textRemaining: 10,
        consultationCreditsRemaining: 2,
        voiceRemainingSessions: actor === 'FREE' ? 0 : 2,
        voiceRemainingSeconds: actor === 'FREE' ? 0 : 600,
      },
      after: {
        textRemaining: 10,
        consultationCreditsRemaining: 2,
        voiceRemainingSessions: actor === 'FREE' ? 0 : 1,
        voiceRemainingSeconds: actor === 'FREE' ? 0 : 590,
      },
    })),
  }
}

describe('MB-762 content-free operator evidence', () => {
  it('keeps unavailable allowance/provider approval blocked with zero real evidence', () => {
    const result = report(pending())
    expect(result.status).toBe('BLOCKED_PROVIDER')
    expect(result.providerCallsByTool).toBe(0)
    expect(
      result.results.every(
        (row: { status: string }) => row.status === 'NOT_RUN',
      ),
    ).toBe(true)
    expect(result.blockers).toContain('livekitAllowance')
    expect(result.blockers).toContain('bedrockAccessQuota')
    expect(result.observations.dialects).toEqual([])
  })
  it('labels operator reports honestly, without claiming independent verification or three dialects', () => {
    const result = report(observed())
    expect(result.status).toBe('OPERATOR_REPORTED_PASS')
    expect(result.evidenceKind).toBe(
      'OPERATOR_REPORTED_NOT_INDEPENDENTLY_VERIFIED',
    )
    expect(result.observations.dialects).toEqual(['SOUTH'])
  })
  it.each(gates)(
    'rejects success if readiness %s is still unverified',
    (gate) => {
      const input = observed()
      input.readiness[gate] = false
      expect(() => report(input)).toThrow('UNSUPPORTED_VOICE_QA_PASS')
    },
  )
  it.each([
    'approval',
    'budget',
    'provider',
    'sources',
    'duplicate',
    'omitted',
  ])('rejects unsupported %s evidence', (kind) => {
    const input = observed()
    if (kind === 'approval') input.approval = 'NOT_APPROVED'
    if (kind === 'budget') input.budget.spentMicroUsd = 100001
    if (kind === 'provider') input.providers.voice = null
    if (kind === 'sources') input.sources.backend = 'dev'
    if (kind === 'duplicate') input.results[0] = input.results[1]!
    if (kind === 'omitted') input.results.pop()
    expect(() => report(input)).toThrow()
  })
  it.each([
    'one-user',
    'no-audio',
    'credits-charged',
    'text-charged',
    'no-before-after',
    'dialects-overclaimed',
  ])('cannot close the demo gate with %s', (kind) => {
    const input = observed()
    if (kind === 'one-user') input.observations.maxConcurrentUsers = 1
    if (kind === 'no-audio') input.observations.spokenReplies = 0
    if (kind === 'credits-charged')
      input.quotaSnapshots[1]!.after.consultationCreditsRemaining--
    if (kind === 'text-charged') input.quotaSnapshots[1]!.after.textRemaining--
    if (kind === 'no-before-after') input.quotaSnapshots.pop()
    if (kind === 'dialects-overclaimed')
      input.observations.dialects = ['NORTH', 'CENTRAL', 'SOUTH']
    expect(() => report(input)).toThrow('UNSUPPORTED_VOICE_QA_PASS')
  })
  it('rejects content/credentials/private URLs instead of echoing or sanitizing them into evidence', () => {
    for (const input of [
      { ...pending(), transcript: 'private-marker' },
      { ...pending(), token: 'private-marker' },
      {
        ...pending(),
        observations: {
          ...pending().observations,
          url: 'https://private-marker',
        },
      },
      {
        ...pending(),
        results: pending().results.map((row) => ({
          ...row,
          detail: 'private-marker',
        })),
      },
    ])
      expect(() => report(input)).toThrow('INVALID_VOICE_QA_INPUT')
  })
  it('does not let NOT_RUN masquerade as measured, paid or spoken evidence', () => {
    const input = pending()
    input.observations.realMicrophoneUsers = 1
    expect(() => report(input)).toThrow('INVALID_VOICE_QA_INPUT')
    expect(() => report({ ...observed(), mode: 'NOT_RUN' })).toThrow(
      'INVALID_VOICE_QA_INPUT',
    )
  })
  it('keeps observed failures and incomplete results visible', () => {
    const input = observed()
    input.results[0]!.status = 'FAIL'
    expect(report(input).status).toBe('FAIL')
    input.results[0]!.status = 'NOT_RUN'
    expect(report(input).status).toBe('NOT_RUN_OR_INCOMPLETE')
  })
  it('records an observed cap violation as FAIL rather than discarding the measurement', () => {
    const input = observed()
    input.observations.maxConcurrentUsers = 3
    input.results.find((row) => row.scenario === 'third_user_denied')!.status =
      'FAIL'
    const result = report(input)
    expect(result.status).toBe('FAIL')
    expect(result.observations.maxConcurrentUsers).toBe(3)
  })
  it('keeps unmeasured latency null and does not treat provider first frame as browser-audible latency', () => {
    const input = observed()
    const result = report({
      ...input,
      latencySamples: [
        {
          sttFinalMs: 100,
          journalReplyMs: null,
          ttsFirstFrameMs: 150,
          browserAudibleMs: null,
        },
      ],
    })
    expect(result.latencySamples[0].browserAudibleMs).toBeNull()
    expect(result.latencySamples[0].journalReplyMs).toBeNull()
  })
  it('CLI rejects oversized or malformed content without echoing input', () => {
    for (const input of [
      'private-content-marker',
      'private-content-marker'.repeat(2000),
    ]) {
      const result = spawnSync(
        process.execPath,
        ['scripts/voice-qa.mjs', '--report'],
        { input, encoding: 'utf8' },
      )
      expect(result.status).toBe(2)
      expect(result.stdout).toBe('')
      expect(result.stderr).not.toContain('private-content-marker')
    }
  })
})
