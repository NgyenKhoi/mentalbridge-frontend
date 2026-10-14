import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  emotionOccurrenceFixture,
  nativeSupportPlanFixture,
} from './testing/native-support-plan-fixture'
const api = vi.hoisted(() => ({ current: vi.fn(), occurrences: vi.fn() }))
vi.mock('./api/browser-support-plan-actions', () => ({
  getCurrentSupportPlanActions: api.current,
  getSupportPlanActionOccurrences: api.occurrences,
}))
import {
  emotionPlanHref,
  parseEmotionPlanOrigin,
  resolveEmotionPlanOrigin,
} from './emotion-plan-origin'

const occurrence = emotionOccurrenceFixture()
const origin = {
  occurrenceId: occurrence.occurrenceId,
  actionId: occurrence.actionId,
  localDate: occurrence.localDate,
}
describe('Emotion plan origin hints', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const plan = nativeSupportPlanFixture()
    api.current.mockResolvedValue(plan)
    api.occurrences.mockResolvedValue({
      supportPlanId: plan.supportPlanId,
      representationMode: 'NATIVE_V3',
      occurrences: [occurrence],
    })
  })
  it('allowlists typed identifiers and date; ignores arbitrary return targets and rejects duplicate/invalid hints', () => {
    const params = new URLSearchParams({
      ...origin,
      returnTo: 'https://evil.invalid',
      timezone: 'UTC',
      note: 'private',
    })
    expect(parseEmotionPlanOrigin(params)).toEqual(origin)
    expect(emotionPlanHref(origin, '/dashboard')).toBe(
      `/dashboard?occurrenceId=${origin.occurrenceId}&actionId=${origin.actionId}&localDate=2026-10-13#emotion-check-in`,
    )
    expect(emotionPlanHref(origin, '/support-plan')).not.toContain('private')
    params.append('actionId', origin.actionId)
    expect(parseEmotionPlanOrigin(params)).toBeNull()
    expect(
      parseEmotionPlanOrigin(
        new URLSearchParams({ ...origin, localDate: '2026-02-30' }),
      ),
    ).toBeNull()
  })
  it('resolves the exact owned action and schedule for frozen timezone, not a nearby activity', async () => {
    const resolved = await resolveEmotionPlanOrigin(origin)
    expect(resolved).toMatchObject({
      ...origin,
      timezone: 'Asia/Ho_Chi_Minh',
      title: 'Check-in cảm xúc',
    })
    expect(api.occurrences).toHaveBeenCalledWith('2026-10-13', '2026-10-13')
    await expect(
      resolveEmotionPlanOrigin({
        ...origin,
        actionId: '20000000-0000-4000-8000-000000000642',
      }),
    ).rejects.toThrow('EMOTION_PLAN_ORIGIN_UNAVAILABLE')
    api.occurrences.mockResolvedValueOnce({
      supportPlanId: '10000000-0000-4000-8000-000000000642',
      representationMode: 'NATIVE_V3',
      occurrences: [occurrence],
    })
    await expect(resolveEmotionPlanOrigin(origin)).rejects.toThrow(
      'EMOTION_PLAN_ORIGIN_UNAVAILABLE',
    )
  })
  it('rejects replaced/cancelled targets, wrong schedule versions and legacy adapters without guessing', async () => {
    const plan = nativeSupportPlanFixture()
    api.current.mockResolvedValueOnce({
      ...plan,
      representationMode: 'V2_RESOURCE_ADAPTER',
    })
    await expect(resolveEmotionPlanOrigin(origin)).rejects.toThrow()
    api.occurrences.mockResolvedValueOnce({
      supportPlanId: plan.supportPlanId,
      representationMode: 'NATIVE_V3',
      occurrences: [{ ...occurrence, state: 'CANCELLED' }],
    })
    await expect(resolveEmotionPlanOrigin(origin)).rejects.toThrow()
    api.occurrences.mockResolvedValueOnce({
      supportPlanId: plan.supportPlanId,
      representationMode: 'NATIVE_V3',
      occurrences: [{ ...occurrence, scheduleVersion: 2 }],
    })
    await expect(resolveEmotionPlanOrigin(origin)).rejects.toThrow()
    api.current.mockResolvedValueOnce({ ...plan, status: 'PAUSED' })
    await expect(resolveEmotionPlanOrigin(origin)).rejects.toThrow()
  })
})
