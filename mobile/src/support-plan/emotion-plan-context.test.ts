import {
  nativeIds,
  nativeOccurrence,
  nativePlan,
} from './native-plan-test-fixtures'
import {
  emotionReconciliationMessage,
  parseEmotionPlanOrigin,
  resolveEmotionPlanOrigin,
} from './emotion-plan-context'

const now = new Date('2026-10-13T12:00:00Z')
const origin = {
  occurrenceId: nativeIds.occurrence,
  actionId: nativeIds.action,
}
function api() {
  return {
    getCurrent: jest.fn().mockResolvedValue(nativePlan()),
    getOccurrences: jest.fn().mockResolvedValue({
      supportPlanId: nativeIds.plan,
      supportPlanStatus: 'ACTIVE',
      representationMode: 'NATIVE_V3',
      from: '2026-09-29',
      through: '2026-10-29',
      occurrences: [nativeOccurrence()],
    }),
  }
}
it('parses only an exact pair of IDs, never a redirect, array, date or timezone', () => {
  expect(parseEmotionPlanOrigin(undefined, undefined)).toEqual({
    state: 'none',
  })
  expect(
    parseEmotionPlanOrigin(nativeIds.occurrence, nativeIds.action),
  ).toEqual({ state: 'valid', value: origin })
  expect(
    parseEmotionPlanOrigin([nativeIds.occurrence], nativeIds.action),
  ).toEqual({ state: 'invalid' })
  expect(parseEmotionPlanOrigin(nativeIds.occurrence, undefined)).toEqual({
    state: 'invalid',
  })
  expect(
    parseEmotionPlanOrigin('https://outside.test', nativeIds.action),
  ).toEqual({ state: 'invalid' })
})
it('resolves frozen local day/zone only from owned current plan and exact occurrence/schedule', async () => {
  const owner = api()
  const result = await resolveEmotionPlanOrigin(owner, origin, now)
  expect(result?.timezone).toBe('Asia/Ho_Chi_Minh')
  expect(result?.isToday).toBe(true)
  expect(owner.getOccurrences).toHaveBeenCalledWith('2026-09-29', '2026-10-29')
})
it.each([
  'wrong-action',
  'wrong-plan',
  'closed',
  'adapter',
  'unknown-schedule',
])('does not return another activity for %s', async (mode) => {
  const owner = api(),
    plan = nativePlan(),
    occurrence = nativeOccurrence()
  if (mode === 'wrong-action')
    occurrence.actionId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  if (mode === 'closed') occurrence.state = 'CANCELLED'
  if (mode === 'unknown-schedule')
    occurrence.scheduleId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  if (mode === 'adapter') plan.representationMode = 'V2_RESOURCE_ADAPTER'
  owner.getCurrent.mockResolvedValue(plan)
  owner.getOccurrences.mockResolvedValue({
    supportPlanId:
      mode === 'wrong-plan'
        ? 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
        : nativeIds.plan,
    supportPlanStatus: 'ACTIVE',
    representationMode: 'NATIVE_V3',
    occurrences: [occurrence],
  })
  expect(await resolveEmotionPlanOrigin(owner, origin, now)).toBeNull()
})
it('rejects future writes through canonical today context without discarding historic identity', async () => {
  const owner = api()
  owner.getOccurrences.mockResolvedValue({
    supportPlanId: nativeIds.plan,
    supportPlanStatus: 'ACTIVE',
    representationMode: 'NATIVE_V3',
    occurrences: [nativeOccurrence({ localDate: '2026-10-14' })],
  })
  expect((await resolveEmotionPlanOrigin(owner, origin, now))?.isToday).toBe(
    false,
  )
})
it('keeps source absence/deletion distinct from accepted history', () => {
  expect(emotionReconciliationMessage('DELETED', true)).toContain(
    'trước khi xóa vẫn giữ nguyên',
  )
  expect(emotionReconciliationMessage('MISSING', false)).toContain(
    'vẫn chưa hoàn thành',
  )
})
