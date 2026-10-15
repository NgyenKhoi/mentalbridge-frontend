import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native'
import type { ReactElement } from 'react'

import { ApiError } from '@/api/api-error'
import type { EmotionApi } from '@/emotion/emotion-api'
import type { SupportPlanApi } from './support-plan-api'
import type { SupportPlanActionApi } from './support-plan-action-api'
import type { JournalReconciliation } from './support-plan-action-contract'
import type { JournalOriginInput } from './journal-plan-context'
import {
  NativeProposalEntry,
  NativeSupportPlanScreen,
  SupportPlanActionWorkspace,
} from './SupportPlanActionWorkspace'
import {
  nativeIds,
  nativeOccurrence,
  nativePlan,
  reconciliation,
} from './native-plan-test-fixtures'
import { makeReassessmentSummary } from './support-plan-test-fixtures'

const mockPush = jest.fn()
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: (value: unknown) => mockPush(value) },
  useFocusEffect: (callback: () => void) => {
    jest.requireActual('react').useEffect(callback, [callback])
  },
}))
jest.mock('@/auth/session-context', () => ({
  useSession: () => ({
    session: { subject: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', role: 'USER' },
    signOut: jest.fn(),
  }),
}))
jest.mock('./SupportPlanPersonalizationCard', () => ({
  SupportPlanPersonalizationCard: () => null,
}))
jest.mock('./SupportPlanScheduleEditor', () => ({
  SupportPlanScheduleEditor: () => null,
}))
jest.mock('./SupportPlanScreen', () => ({
  SupportPlanScreen: ({
    nativeProposalEntry,
  }: {
    nativeProposalEntry?: ReactElement
  }) => {
    const { Text, View } = jest.requireActual('react-native')
    return (
      <View>
        <Text>Legacy resource plan retained</Text>
        {nativeProposalEntry}
      </View>
    )
  },
}))

const now = () => new Date('2026-10-13T12:00:00Z')
const origin = {
  state: 'valid' as const,
  value: { occurrenceId: nativeIds.occurrence, actionId: nativeIds.action },
}
function api(): jest.Mocked<SupportPlanActionApi> {
  return {
    getProposalEvaluationId: jest.fn().mockResolvedValue(nativeIds.evaluation),
    getCurrent: jest.fn().mockResolvedValue(nativePlan()),
    getDraft: jest.fn().mockResolvedValue(null),
    getDetail: jest.fn(),
    getHistory: jest
      .fn()
      .mockResolvedValue({ items: [], nextCursor: null, hasMore: false }),
    propose: jest.fn().mockResolvedValue(nativePlan('DRAFT')),
    activate: jest.fn().mockResolvedValue(nativePlan()),
    changeStatus: jest.fn().mockResolvedValue(nativePlan('PAUSED')),
    getReassessmentSummary: jest
      .fn()
      .mockResolvedValue(makeReassessmentSummary()),
    replaceSchedule: jest.fn(),
    reviewReplacement: jest.fn(),
    replace: jest.fn(),
    getOccurrences: jest.fn().mockResolvedValue({
      supportPlanId: nativeIds.plan,
      supportPlanStatus: 'ACTIVE',
      representationMode: 'NATIVE_V3',
      from: '2026-09-29',
      through: '2026-10-29',
      occurrences: [nativeOccurrence()],
      interpretationCode:
        'SELF_REPORTED_WELLBEING_ACTIVITY_NOT_TREATMENT_ADHERENCE',
    }),
    changeOccurrenceState: jest.fn(),
    reconcileEmotion: jest.fn().mockResolvedValue(reconciliation()),
    reconcileJournal: jest.fn(),
  }
}
const legacy = {} as SupportPlanApi
const emotion = {
  getProgress: jest
    .fn()
    .mockResolvedValue({ windows: [{ days: 7, checkedInDays: 2 }] }),
} as unknown as Pick<EmotionApi, 'getProgress'>
async function mount(element: ReactElement) {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: {
            queries: { retry: false, gcTime: Infinity },
            mutations: { retry: false, gcTime: Infinity },
          },
        })
      }
    >
      {element}
    </QueryClientProvider>,
  )
}
function native(owner = api()) {
  return (
    <NativeSupportPlanScreen
      api={owner}
      legacyApi={legacy}
      emotionApi={emotion}
      current={nativePlan()}
      draft={null}
      onChanged={jest.fn().mockResolvedValue(undefined)}
      origin={origin}
      now={now}
    />
  )
}
beforeEach(() => jest.clearAllMocks())

const journalId = '60000000-0000-4000-8000-000000000642'
const journalOriginValue = {
  source: 'journal' as const,
  occurrenceId: nativeIds.occurrence,
  actionId: nativeIds.action,
  localDate: '2026-10-13',
  journalId,
}
function journalFixture() {
  const owner = api()
  const plan = nativePlan()
  const action = plan.focuses[0]!.actions[0]!
  action.actionType = 'JOURNAL'
  action.presentation.title = 'Viết vài dòng nhật ký'
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
    from: journalOriginValue.localDate,
    through: journalOriginValue.localDate,
    occurrences: [occurrence],
    interpretationCode:
      'SELF_REPORTED_WELLBEING_ACTIVITY_NOT_TREATMENT_ADHERENCE' as const,
  }
  owner.getCurrent.mockResolvedValue(plan)
  owner.getOccurrences.mockResolvedValue(list)
  const response: JournalReconciliation = {
    schemaVersion: 'journal-entry-occurrence-reconciliation-v1',
    occurrenceId: occurrence.occurrenceId,
    actionId: occurrence.actionId,
    localDate: occurrence.localDate,
    journalId,
    sourceState: 'RECORDED',
    occurrenceState: 'COMPLETED',
    version: 1,
    completedAt: '2026-10-13T12:02:00Z',
    completionEvidence: {
      ownerDomain: 'JOURNAL_AI',
      kind: 'JOURNAL_ENTRY',
      factId: journalId,
      factRevision: '1',
      occurredAt: '2026-10-13T12:01:00Z',
      verifiedAt: '2026-10-13T12:02:00Z',
    },
  }
  owner.reconcileJournal.mockResolvedValue(response)
  return { owner, plan, action, occurrence, response }
}
function journalNative(
  f: ReturnType<typeof journalFixture>,
  journalOrigin: JournalOriginInput = {
    state: 'valid',
    value: journalOriginValue,
  },
  clock = now,
) {
  return (
    <NativeSupportPlanScreen
      api={f.owner}
      legacyApi={legacy}
      emotionApi={emotion}
      current={f.plan}
      draft={null}
      onChanged={jest.fn().mockResolvedValue(undefined)}
      origin={{ state: 'none' }}
      journalOrigin={journalOrigin}
      now={clock}
    />
  )
}
it('opens the canonical Journal with closed metadata only, without automatic completion', async () => {
  const f = journalFixture()
  await mount(journalNative(f, { state: 'none' }))
  await fireEvent.press(
    await screen.findByTestId(`journal-write-${nativeIds.occurrence}`),
  )
  expect(mockPush).toHaveBeenCalledWith({
    pathname: '/(user)/journal',
    params: {
      source: 'journal',
      occurrenceId: nativeIds.occurrence,
      actionId: nativeIds.action,
      localDate: '2026-10-13',
    },
  })
  expect(f.owner.reconcileJournal).not.toHaveBeenCalled()
  expect(f.owner.changeOccurrenceState).not.toHaveBeenCalled()
})
it('returns to the exact date without checking on load; an explicit double click sends one ID-only command', async () => {
  const f = journalFixture()
  let finish!: (response: JournalReconciliation) => void
  f.owner.reconcileJournal.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  await mount(journalNative(f))
  await screen.findByText('Bạn vừa quay lại từ nhật ký')
  expect(f.owner.getOccurrences).toHaveBeenCalledWith(
    '2026-10-13',
    '2026-10-13',
  )
  expect(f.owner.reconcileJournal).not.toHaveBeenCalled()
  expect(screen.getByText('Chưa ghi nhận hoàn thành')).toBeTruthy()
  const check = screen.getByTestId(`reconcile-journal-${nativeIds.occurrence}`)
  await fireEvent.press(check)
  await fireEvent.press(check)
  expect(f.owner.reconcileJournal).toHaveBeenCalledTimes(1)
  expect(f.owner.reconcileJournal).toHaveBeenCalledWith(
    nativeIds.occurrence,
    journalId,
  )
  await act(async () => finish(f.response))
  await screen.findByText('Đã ghi nhận hoàn thành')
  expect(f.owner.reconcileEmotion).not.toHaveBeenCalled()
})
it.each(['MISSING', 'DELETED'] as const)(
  'does not complete a %s candidate and permits explicit retry',
  async (sourceState) => {
    const f = journalFixture()
    f.owner.reconcileJournal.mockResolvedValueOnce({
      ...f.response,
      sourceState,
      occurrenceState: 'SCHEDULED',
      version: 0,
      completedAt: null,
      completionEvidence: null,
    })
    await mount(journalNative(f))
    await fireEvent.press(
      await screen.findByTestId(`reconcile-journal-${nativeIds.occurrence}`),
    )
    await screen.findByText(
      sourceState === 'MISSING'
        ? /Chưa tìm thấy bài nhật ký/
        : /Bài nhật ký đã được xóa. Chưa ghi nhận/,
    )
    expect(screen.getByText('Chưa ghi nhận hoàn thành')).toBeTruthy()
    await fireEvent.press(
      screen.getByTestId(`reconcile-journal-${nativeIds.occurrence}`),
    )
    await screen.findByText('Đã ghi nhận hoàn thành')
  },
)
it('retains accepted history after deletion/outage and never replaces it with a different query candidate', async () => {
  const f = journalFixture()
  Object.assign(f.occurrence, {
    state: 'COMPLETED',
    displayState: 'COMPLETED',
    completionEvidence: f.response.completionEvidence,
    outcomeRecordedAt: f.response.completedAt,
  })
  f.owner.reconcileJournal
    .mockResolvedValueOnce({ ...f.response, sourceState: 'DELETED' })
    .mockRejectedValueOnce(
      new ApiError({
        status: 503,
        code: 'JOURNAL_ENTRY_EVIDENCE_UNAVAILABLE',
        message: 'private',
      }),
    )
  await mount(
    journalNative(f, {
      state: 'valid',
      value: {
        ...journalOriginValue,
        journalId: '70000000-0000-4000-8000-000000000642',
      },
    }),
  )
  const check = await screen.findByTestId(
    `reconcile-journal-${nativeIds.occurrence}`,
  )
  await fireEvent.press(check)
  await screen.findByText(
    /Lịch sử hoạt động đã ghi nhận trước khi xóa vẫn giữ nguyên/,
  )
  expect(f.owner.reconcileJournal).toHaveBeenCalledWith(
    nativeIds.occurrence,
    journalId,
  )
  await fireEvent.press(check)
  await screen.findByText(/Chưa thể kiểm tra ghi nhận/)
  expect(screen.getByText('Đã ghi nhận hoàn thành')).toBeTruthy()
})
it('rejects a mismatched entry response, without altering the occurrence', async () => {
  const f = journalFixture()
  f.owner.reconcileJournal.mockResolvedValueOnce({
    ...f.response,
    journalId: '70000000-0000-4000-8000-000000000642',
  })
  await mount(journalNative(f))
  await fireEvent.press(
    await screen.findByTestId(`reconcile-journal-${nativeIds.occurrence}`),
  )
  await screen.findByText(/Chưa thể thực hiện thao tác/)
  expect(screen.getByText('Chưa ghi nhận hoàn thành')).toBeTruthy()
})
it('fails closed for unsupported source/action/schedule while leaving the row visible', async () => {
  const f = journalFixture()
  f.action.source!.sourceId = 'unrecognized'
  await mount(journalNative(f))
  await screen.findByText(/Hoạt động đã thay đổi hoặc chưa hỗ trợ mở nhật ký/)
  expect(
    screen.getByTestId(`reconcile-journal-${nativeIds.occurrence}`),
  ).toBeDisabled()
  expect(
    screen.queryByTestId(`journal-write-${nativeIds.occurrence}`),
  ).toBeNull()
  expect(f.owner.reconcileJournal).not.toHaveBeenCalled()
})
it('a past returned date stays exact and does not offer backdated Journal creation', async () => {
  const f = journalFixture()
  await mount(
    journalNative(
      f,
      {
        state: 'valid',
        value: { ...journalOriginValue, journalId: undefined },
      },
      () => new Date('2026-11-13T12:00:00Z'),
    ),
  )
  await screen.findByText(
    /Không thể viết bài mới để hoàn thành hoạt động ở ngày khác/,
  )
  expect(f.owner.getOccurrences).toHaveBeenCalledWith(
    '2026-10-13',
    '2026-10-13',
  )
  expect(
    screen.queryByTestId(`journal-write-${nativeIds.occurrence}`),
  ).toBeNull()
})

it('returns to exact owned activity, never checks automatically, and canonical entry carries only typed origin', async () => {
  const owner = api()
  await mount(native(owner))
  await screen.findByText('Bạn vừa quay lại từ ghi nhận cảm xúc')
  expect(owner.reconcileEmotion).not.toHaveBeenCalled()
  await fireEvent.press(
    screen.getByRole('button', {
      name: 'Ghi nhận cảm xúc: Dành một phút nhìn lại cảm xúc',
    }),
  )
  expect(mockPush).toHaveBeenCalledWith({
    pathname: '/(user)/emotion',
    params: origin.value,
  })
  expect(owner.reconcileEmotion).not.toHaveBeenCalled()
})
it('checks only after explicit click, prevents a double request and retains authoritative completion on retry/outage', async () => {
  const owner = api()
  let resolve!: (value: ReturnType<typeof reconciliation>) => void
  owner.reconcileEmotion.mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done
      }),
  )
  await mount(native(owner))
  const button = await screen.findByTestId(`reconcile-${nativeIds.occurrence}`)
  await fireEvent.press(button)
  await fireEvent.press(button)
  expect(owner.reconcileEmotion).toHaveBeenCalledTimes(1)
  expect(owner.reconcileEmotion).toHaveBeenCalledWith(nativeIds.occurrence)
  await act(async () => resolve(reconciliation()))
  expect(await screen.findByText('Đã ghi nhận hoàn thành')).toBeTruthy()
  owner.reconcileEmotion.mockRejectedValueOnce(
    new ApiError({
      status: 503,
      code: 'EMOTION_CHECK_IN_EVIDENCE_UNAVAILABLE',
      message: 'unavailable',
    }),
  )
  await fireEvent.press(screen.getByTestId(`reconcile-${nativeIds.occurrence}`))
  expect(await screen.findByText(/Chưa thể kiểm tra ghi nhận/)).toBeTruthy()
  expect(screen.getByText('Đã ghi nhận hoàn thành')).toBeTruthy()
  owner.reconcileEmotion.mockResolvedValueOnce(reconciliation('DELETED', true))
  await fireEvent.press(screen.getByTestId(`reconcile-${nativeIds.occurrence}`))
  expect(await screen.findByText(/trước khi xóa vẫn giữ nguyên/)).toBeTruthy()
  expect(screen.getByText('Đã ghi nhận hoàn thành')).toBeTruthy()
})
it.each(['MISSING', 'DELETED'] as const)(
  'does not manufacture completion from %s',
  async (source) => {
    const owner = api()
    owner.reconcileEmotion.mockResolvedValue(reconciliation(source, false))
    await mount(native(owner))
    await fireEvent.press(
      await screen.findByTestId(`reconcile-${nativeIds.occurrence}`),
    )
    await screen.findByText(
      source === 'MISSING'
        ? /Chưa có ghi nhận cảm xúc cho ngày này/
        : /Ghi nhận của ngày này đã được xóa/,
    )
    expect(screen.queryByText('Đã ghi nhận hoàn thành')).toBeNull()
    expect(owner.changeOccurrenceState).not.toHaveBeenCalled()
  },
)
it('rejects mismatched response action and keeps row uncompleted', async () => {
  const owner = api()
  owner.reconcileEmotion.mockResolvedValue({
    ...reconciliation(),
    actionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  })
  await mount(native(owner))
  await fireEvent.press(
    await screen.findByTestId(`reconcile-${nativeIds.occurrence}`),
  )
  await screen.findByText(/Chưa thể thực hiện thao tác/)
  expect(screen.queryByText('Đã ghi nhận hoàn thành')).toBeNull()
})
it('shows persisted completion after reload without a fresh reconcile command', async () => {
  const owner = api(),
    accepted = reconciliation()
  owner.getOccurrences.mockResolvedValue({
    supportPlanId: nativeIds.plan,
    supportPlanStatus: 'ACTIVE',
    representationMode: 'NATIVE_V3',
    from: '2026-09-29',
    through: '2026-10-29',
    occurrences: [
      nativeOccurrence({
        state: 'COMPLETED',
        displayState: 'COMPLETED',
        version: accepted.version,
        completionEvidence: accepted.completionEvidence,
        outcomeRecordedAt: accepted.completedAt,
      }),
    ],
    interpretationCode:
      'SELF_REPORTED_WELLBEING_ACTIVITY_NOT_TREATMENT_ADHERENCE',
  })
  await mount(native(owner))
  await screen.findByText('Đã ghi nhận hoàn thành')
  expect(owner.reconcileEmotion).not.toHaveBeenCalled()
})
it('preserves the resource-plan legacy screen without activation or conversion', async () => {
  const owner = api()
  owner.getCurrent.mockResolvedValue({
    ...nativePlan(),
    representationMode: 'V2_RESOURCE_ADAPTER',
  })
  owner.getDraft.mockRejectedValue(
    new ApiError({
      status: 404,
      code: 'SUPPORT_PLAN_DRAFT_NOT_FOUND',
      message: 'missing',
    }),
  )
  await mount(
    <SupportPlanActionWorkspace
      api={owner}
      legacyApi={legacy}
      emotionApi={emotion}
      origin={{ state: 'none' }}
      now={now}
    />,
  )
  await screen.findByText('Legacy resource plan retained')
  expect(owner.activate).not.toHaveBeenCalled()
  expect(owner.propose).not.toHaveBeenCalled()
})
it('requires review then explicit native activation, without automatic start on load', async () => {
  const owner = api(),
    changed = jest.fn().mockResolvedValue(undefined)
  await mount(
    <NativeSupportPlanScreen
      api={owner}
      legacyApi={legacy}
      emotionApi={emotion}
      current={null}
      draft={nativePlan('DRAFT')}
      onChanged={changed}
      origin={{ state: 'none' }}
      now={now}
    />,
  )
  expect(owner.activate).not.toHaveBeenCalled()
  expect(screen.getByText('Nhận biết điều bạn đang cảm nhận.')).toBeTruthy()
  await fireEvent.press(screen.getByTestId('native-plan-activate'))
  await waitFor(() =>
    expect(owner.activate).toHaveBeenCalledWith(
      nativeIds.plan,
      1,
      expect.any(String),
    ),
  )
  await waitFor(() => expect(changed).toHaveBeenCalled())
})
it('proposes from owner screening context and reuses retry identity after ambiguous failure', async () => {
  const owner = api()
  owner.propose.mockRejectedValueOnce(
    new ApiError({
      status: 503,
      code: 'DEPENDENCY_UNAVAILABLE',
      message: 'unavailable',
    }),
  )
  const changed = jest.fn().mockResolvedValue(undefined)
  await mount(
    <NativeProposalEntry
      api={owner}
      current={null}
      draft={null}
      onChanged={changed}
    />,
  )
  await fireEvent.press(
    screen.getByRole('button', { name: 'Tạo phương án để xem lại' }),
  )
  await screen.findByText(/Chưa thể thực hiện thao tác/)
  await fireEvent.press(
    screen.getByRole('button', { name: 'Tạo phương án để xem lại' }),
  )
  await waitFor(() => expect(owner.propose).toHaveBeenCalledTimes(2))
  expect(owner.propose.mock.calls[0]).toEqual(owner.propose.mock.calls[1])
  expect(owner.propose.mock.calls[0]?.[0]).toBe(nativeIds.evaluation)
})
it('only replaces a current v2 plan after authoritative reassessment comparison and explicit choice', async () => {
  const owner = api(),
    current = {
      ...nativePlan(),
      representationMode: 'V2_RESOURCE_ADAPTER' as const,
    },
    draft = {
      ...nativePlan('DRAFT'),
      supportPlanId: '70000000-0000-4000-8000-000000000641',
    }
  const summary = makeReassessmentSummary()
  owner.reviewReplacement.mockResolvedValue({
    outcome: 'CURRENT_PLAN_VALID_ALTERNATIVES_AVAILABLE',
    rationaleCodes: ['PROPOSED_PLAN_ADMISSIBLE'],
    currentPlan: current,
    proposedPlan: draft,
    reassessmentSummary: summary,
    reviewedAt: '2026-10-13T12:00:00Z',
  })
  await mount(
    <NativeSupportPlanScreen
      api={owner}
      legacyApi={legacy}
      emotionApi={emotion}
      current={current}
      draft={draft}
      onChanged={jest.fn().mockResolvedValue(undefined)}
      origin={{ state: 'none' }}
      now={now}
    />,
  )
  expect(owner.replace).not.toHaveBeenCalled()
  expect(owner.reviewReplacement).not.toHaveBeenCalled()
  await fireEvent.press(
    screen.getByRole('button', { name: 'Kiểm tra và so sánh phương án' }),
  )
  await fireEvent.press(
    await screen.findByRole('button', { name: 'Chọn phương án mới' }),
  )
  await waitFor(() =>
    expect(owner.replace).toHaveBeenCalledWith(
      draft.supportPlanId,
      draft.version,
      {
        currentSupportPlanId: current.supportPlanId,
        currentVersion: current.version,
        reassessmentSummaryId: summary.summaryId,
      },
      expect.any(String),
    ),
  )
})
it('pause is confirmed and can be cancelled without mutating', async () => {
  const owner = api()
  await mount(native(owner))
  await fireEvent.press(
    await screen.findByRole('button', { name: 'Tạm dừng kế hoạch' }),
  )
  await screen.findByText('Tạm dừng kế hoạch?')
  expect(owner.changeStatus).not.toHaveBeenCalled()
  await fireEvent.press(screen.getByRole('button', { name: 'Giữ nguyên' }))
  expect(owner.changeStatus).not.toHaveBeenCalled()
})

it('waits for owned terminal history and fails closed before choosing a representation', async () => {
  const owner = api()
  owner.getCurrent.mockRejectedValue(
    new ApiError({ status: 404, code: 'NOT_FOUND', message: 'missing' }),
  )
  owner.getDraft.mockRejectedValue(
    new ApiError({ status: 404, code: 'NOT_FOUND', message: 'missing' }),
  )
  let reject!: (error: Error) => void
  owner.getHistory.mockImplementationOnce(
    () =>
      new Promise((_done, fail) => {
        reject = fail
      }),
  )
  await mount(
    <SupportPlanActionWorkspace
      api={owner}
      legacyApi={legacy}
      emotionApi={emotion}
      origin={{ state: 'none' }}
      now={now}
    />,
  )
  await screen.findByLabelText('Đang xác định lịch sử kế hoạch')
  expect(screen.queryByText('Legacy resource plan retained')).toBeNull()
  await act(async () => reject(new Error('Unavailable')))
  await screen.findByText(/Chưa thể xác định lịch sử kế hoạch/)
  expect(screen.queryByText('Legacy resource plan retained')).toBeNull()
  expect(owner.propose).not.toHaveBeenCalled()
  owner.getHistory.mockResolvedValue({
    items: [],
    hasMore: false,
    nextCursor: null,
  })
  await fireEvent.press(
    screen.getByRole('button', { name: 'Thử tải lại lịch sử' }),
  )
  await screen.findByRole('button', { name: 'Tạo phương án để xem lại' })
  expect(screen.queryByText('Legacy resource plan retained')).toBeNull()
  expect(owner.propose).not.toHaveBeenCalled()
})

it('chooses latest terminal representation rather than an older native entry', async () => {
  const owner = api()
  owner.getCurrent.mockRejectedValue(
    new ApiError({ status: 404, code: 'NOT_FOUND', message: 'missing' }),
  )
  owner.getDraft.mockRejectedValue(
    new ApiError({ status: 404, code: 'NOT_FOUND', message: 'missing' }),
  )
  owner.getHistory.mockResolvedValue({
    items: [
      { ...nativePlan('COMPLETED'), representationMode: 'V2_RESOURCE_ADAPTER' },
      {
        ...nativePlan('SUPERSEDED'),
        supportPlanId: '70000000-0000-4000-8000-000000000641',
      },
    ],
    hasMore: false,
    nextCursor: null,
  })
  await mount(
    <SupportPlanActionWorkspace
      api={owner}
      legacyApi={legacy}
      emotionApi={emotion}
      origin={{ state: 'none' }}
      now={now}
    />,
  )
  await screen.findByText('Legacy resource plan retained')
  expect(owner.activate).not.toHaveBeenCalled()
})

it('loads further owner history pages without replacing already visible entries', async () => {
  const owner = api()
  owner.getHistory
    .mockResolvedValueOnce({
      items: [nativePlan('COMPLETED')],
      hasMore: true,
      nextCursor: 'next-page',
    })
    .mockResolvedValue({
      items: [
        {
          ...nativePlan('DISCARDED'),
          supportPlanId: '70000000-0000-4000-8000-000000000641',
        },
      ],
      hasMore: false,
      nextCursor: null,
    })
  await mount(native(owner))
  await screen.findByText('Đã kết thúc')
  await fireEvent.press(
    screen.getByRole('button', { name: 'Xem thêm kế hoạch trước đây' }),
  )
  await screen.findByText('Đã bỏ')
  expect(owner.getHistory).toHaveBeenCalledWith('next-page')
  expect(screen.getByText('Đã kết thúc')).toBeTruthy()
  expect(
    screen.queryByRole('button', { name: 'Xem thêm kế hoạch trước đây' }),
  ).toBeNull()
})
