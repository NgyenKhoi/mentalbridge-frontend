import {
  parseJournalPlanOrigin,
  resolveJournalPlanOrigin,
} from './journal-plan-context'
import {
  nativeIds,
  nativeOccurrence,
  nativePlan,
} from './native-plan-test-fixtures'

const origin = {
  source: 'journal' as const,
  occurrenceId: nativeIds.occurrence,
  actionId: nativeIds.action,
  localDate: '2026-10-13',
}
function fixture() {
  const plan = nativePlan()
  const action = plan.focuses[0]!.actions[0]!
  action.actionType = 'JOURNAL'
  action.source = {
    ...action.source!,
    sourceKind: 'JOURNAL_TEMPLATE',
    sourceId: 'short-reflection',
    sourcePolicyVersion: 'journal-writing-intent-v1',
  }
  const occurrence = nativeOccurrence({ actionType: 'JOURNAL' })
  const list = {
    supportPlanId: plan.supportPlanId,
    supportPlanStatus: 'ACTIVE' as const,
    representationMode: 'NATIVE_V3' as const,
    from: origin.localDate,
    through: origin.localDate,
    occurrences: [occurrence],
    interpretationCode:
      'SELF_REPORTED_WELLBEING_ACTIVITY_NOT_TREATMENT_ADHERENCE' as const,
  }
  const api = {
    getCurrent: jest.fn().mockResolvedValue(plan),
    getOccurrences: jest.fn().mockResolvedValue(list),
  }
  return { api, plan, action, occurrence, list }
}

it('parses only closed typed origin and rejects duplicated/private/arbitrary context', () => {
  expect(parseJournalPlanOrigin({})).toEqual({ state: 'none' })
  expect(parseJournalPlanOrigin(origin)).toEqual({
    state: 'valid',
    value: origin,
  })
  for (const params of [
    { ...origin, source: ['journal', 'journal'] },
    { ...origin, occurrenceId: [nativeIds.occurrence] },
    { ...origin, localDate: '2026-02-30' },
    { ...origin, journalId: 'bad' },
    { ...origin, timezone: 'UTC' },
    { ...origin, returnUrl: 'https://other.test' },
    { ...origin, text: 'private' },
  ])
    expect(parseJournalPlanOrigin(params)).toEqual({ state: 'invalid' })
})
it('resolves exact owner plan/action/schedule/day without reading private Journal', async () => {
  const { api } = fixture()
  const result = await resolveJournalPlanOrigin(
    api,
    origin,
    new Date('2026-10-13T12:00:00Z'),
  )
  expect(result?.canWrite).toBe(true)
  expect(result?.timezone).toBe('Asia/Ho_Chi_Minh')
  expect(api.getOccurrences).toHaveBeenCalledWith(
    origin.localDate,
    origin.localDate,
  )
})
it('does not backdate or open a future-day writing intent', async () => {
  const { api } = fixture()
  for (const now of ['2026-10-12T12:00:00Z', '2026-10-14T12:00:00Z'])
    expect(
      (await resolveJournalPlanOrigin(api, origin, new Date(now)))?.canWrite,
    ).toBe(false)
})
it('rejects wrong source, occurrence and schedule attribution and inactive writes', async () => {
  for (const change of [
    (f: ReturnType<typeof fixture>) => {
      f.occurrence.actionId = '11111111-1111-4111-8111-111111111111'
    },
    (f: ReturnType<typeof fixture>) => {
      f.occurrence.scheduleVersion = 99
    },
    (f: ReturnType<typeof fixture>) => {
      f.action.source!.sourceId = 'other-template'
    },
    (f: ReturnType<typeof fixture>) => {
      f.occurrence.localDate = '2026-10-12'
    },
    (f: ReturnType<typeof fixture>) => {
      f.plan.status = 'PAUSED'
      f.list.supportPlanStatus = 'PAUSED' as 'ACTIVE'
    },
    (f: ReturnType<typeof fixture>) => {
      f.action.status = 'ENDED'
    },
    (f: ReturnType<typeof fixture>) => {
      f.occurrence.actionVersion = 99
    },
  ]) {
    const f = fixture()
    change(f)
    expect(
      await resolveJournalPlanOrigin(
        f.api,
        origin,
        new Date('2026-10-13T12:00:00Z'),
      ),
    ).toBeNull()
  }
})
it('retains ended/paused accepted history without enabling a new writing session', async () => {
  const f = fixture()
  f.occurrence.state = 'COMPLETED'
  f.action.status = 'ENDED'
  f.plan.status = 'PAUSED'
  f.list.supportPlanStatus = 'PAUSED' as 'ACTIVE'
  expect(
    (
      await resolveJournalPlanOrigin(
        f.api,
        origin,
        new Date('2026-10-14T12:00:00Z'),
      )
    )?.canWrite,
  ).toBe(false)
})
