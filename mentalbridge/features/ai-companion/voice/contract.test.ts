import { describe, expect, it } from 'vitest'
import {
  connection,
  disclosure,
  eligibility,
  session,
} from '@/tests/fixtures/voice'
import { decode, validators } from './contract'

describe('published Voice contracts', () => {
  it('reads finite server caps and a partial unreserved allowance, without text premium semantics', () => {
    for (const plan of ['FREE', 'PLUS', 'PREMIUM'] as const)
      expect(decode('eligibility', eligibility(plan)).packageCode).toBe(plan)
    expect(
      decode(
        'eligibility',
        eligibility('PLUS', { availableSessionSeconds: 120 }),
      ).availableSessionSeconds,
    ).toBe(120)
    for (const state of [
      'CONSENT_REQUIRED',
      'VOICE_CONSENT_REQUIRED',
      'QUOTA_EXHAUSTED',
      'PROVIDER_UNAVAILABLE',
      'ENTITLEMENT_UNAVAILABLE',
    ] as const) {
      expect(
        validators.eligibility(
          eligibility('PLUS', {
            state,
            eligible: false,
            availableSessionSeconds: 0,
          }),
        ),
      ).toBe(true)
      expect(
        validators.eligibility(eligibility('PLUS', { state, eligible: false })),
      ).toBe(false)
    }
    expect(
      validators.eligibility({
        ...eligibility('PREMIUM'),
        availableSessionSeconds: null,
      }),
    ).toBe(false)
    expect(
      validators.eligibility({
        ...eligibility(),
        availableSessionSeconds: 301,
      }),
    ).toBe(false)
  })
  it.each([
    ['PLUS', 90],
    ['PREMIUM', 90],
    ['PLUS', 1],
  ] as const)(
    'accepts a server operational cap for %s at %i seconds',
    (plan, seconds) => {
      const value = eligibility(plan)
      value.quota.remainingSeconds = plan === 'PREMIUM' ? 1800 : 600
      value.availableSessionSeconds = seconds
      expect(decode('eligibility', value).availableSessionSeconds).toBe(seconds)
    },
  )
  it('still rejects availability outside positive package and daily bounds', () => {
    for (const seconds of [-1, 0, 90.5, 301])
      expect(() =>
        decode('eligibility', {
          ...eligibility(),
          availableSessionSeconds: seconds,
        }),
      ).toThrow()
    const value = eligibility('PLUS', { availableSessionSeconds: 120 })
    expect(() =>
      decode('eligibility', { ...value, availableSessionSeconds: 121 }),
    ).toThrow()
    expect(() =>
      decode('eligibility', {
        ...eligibility(),
        eligible: false,
        state: 'PROVIDER_UNAVAILABLE',
        availableSessionSeconds: 90,
      }),
    ).toThrow()
  })
  it('rejects private content, malformed media bindings and missing fields', () => {
    expect(decode('connection', connection()).audioOnly).toBe(true)
    expect(
      validators.connection({ ...connection(), agentIdentity: 'vu-owner' }),
    ).toBe(false)
    expect(
      validators.connection({
        ...connection(),
        roomName: 'consultation-other',
      }),
    ).toBe(false)
    expect(validators.session({ ...session(), transcript: 'private' })).toBe(
      false,
    )
    expect(
      validators.connection({ ...connection(), apiSecret: 'private' }),
    ).toBe(false)
    expect(
      validators.eligibility({
        ...eligibility(),
        maxSessionSeconds: undefined,
      }),
    ).toBe(false)
    expect(decode('disclosure', disclosure).consentType).toBe(
      'AI_VOICE_PROCESSING',
    )
  })
})
