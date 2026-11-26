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
import { planDayLabel } from './SupportPlanHeader'
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
jest.mock('@/theme/useDashboardFonts', () => ({
  useDashboardFonts: () => false,
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
    getAdaptiveReview: jest.fn(),
    confirmAdaptiveReview: jest.fn(),
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
    requestCompanionExplanation: jest.fn(),
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

function homeEntryFixture(
  actionType: 'RESOURCE' | 'ROUTINE_SELF_MANAGEMENT' | 'SELF_REPORT_REVIEW',
) {
  const owner = api()
  const plan = nativePlan()
  const action = plan.focuses[0]!.actions[0]!
  action.actionType = actionType
  action.presentation.title = `Home ${actionType}`
  action.source =
    actionType === 'RESOURCE'
      ? {
          ownerDomain: 'CONTENT',
          sourceKind: 'RESOURCE_VERSION',
          sourceId: '70000000-0000-4000-8000-000000000641',
          sourceRevision: '1',
          sourcePolicyVersion: 'content-publication-v1',
          publicationId: '80000000-0000-4000-8000-000000000641',
          eligibilityPolicyVersion: 'content-eligibility-v1',
          verifiedAt: '2026-10-13T01:00:00Z',
        }
      : null
  const occurrence = nativeOccurrence({ actionType })
  owner.getCurrent.mockResolvedValue(plan)
  owner.getOccurrences.mockResolvedValue({
    supportPlanId: plan.supportPlanId,
    supportPlanStatus: 'ACTIVE',
    representationMode: 'NATIVE_V3',
    from: occurrence.localDate,
    through: occurrence.localDate,
    occurrences: [occurrence],
    interpretationCode:
      'SELF_REPORTED_WELLBEING_ACTIVITY_NOT_TREATMENT_ADHERENCE',
  })
  return { owner, plan, action, occurrence }
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

it.each(['RESOURCE', 'ROUTINE_SELF_MANAGEMENT', 'SELF_REPORT_REVIEW'] as const)(
  'focuses the exact Home %s owner occurrence without treating it as Emotion',
  async (actionType) => {
    const f = homeEntryFixture(actionType)
    await mount(
      <NativeSupportPlanScreen
        api={f.owner}
        legacyApi={legacy}
        emotionApi={emotion}
        current={f.plan}
        draft={null}
        onChanged={jest.fn().mockResolvedValue(undefined)}
        origin={{ state: 'none' }}
        homeOrigin={{
          state: 'valid',
          value: {
            source: 'home',
            occurrenceId: f.occurrence.occurrenceId,
            actionId: f.occurrence.actionId,
            actionType,
            localDate: f.occurrence.localDate,
          },
        }}
        now={now}
      />,
    )

    await screen.findByText('Hoạt động bạn vừa mở từ Trang chủ')
    expect(
      screen.getByTestId(`plan-activity-${f.occurrence.occurrenceId}`),
    ).toBeTruthy()
    expect(f.owner.getOccurrences).toHaveBeenCalledWith(
      f.occurrence.localDate,
      f.occurrence.localDate,
    )
    expect(
      screen.queryByText('Bạn vừa quay lại từ ghi nhận cảm xúc'),
    ).toBeNull()

    if (actionType === 'RESOURCE') {
      await fireEvent.press(
        screen.getByRole('button', {
          name: `Mở ${f.action.presentation.title}`,
        }),
      )
      expect(mockPush).toHaveBeenCalledWith({
        pathname: '/(user)/resources/[resourceId]',
        params: {
          resourceId: f.action.source!.sourceId,
          date: f.occurrence.localDate,
        },
      })
    }
  },
)

it('keeps a recoverable neutral plan state when a Home occurrence changed', async () => {
  const f = homeEntryFixture('RESOURCE')
  await mount(
    <NativeSupportPlanScreen
      api={f.owner}
      legacyApi={legacy}
      emotionApi={emotion}
      current={f.plan}
      draft={null}
      onChanged={jest.fn().mockResolvedValue(undefined)}
      origin={{ state: 'none' }}
      homeOrigin={{
        state: 'valid',
        value: {
          source: 'home',
          occurrenceId: f.occurrence.occurrenceId,
          actionId: 'changed-action',
          actionType: 'RESOURCE',
          localDate: f.occurrence.localDate,
        },
      }}
      now={now}
    />,
  )

  await screen.findByText(/Hoạt động đã thay đổi/)
  await fireEvent.press(
    screen.getByRole('button', { name: 'Tải lại hoạt động' }),
  )
  await waitFor(() => expect(f.owner.getOccurrences).toHaveBeenCalledTimes(2))
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
it('opens adjustment review after reassessment without proposing or applying a plan automatically', async () => {
  const owner = api()
  owner.getAdaptiveReview.mockRejectedValue(
    new ApiError({ code: 'UNAVAILABLE', status: 503, message: 'Unavailable' }),
  )
  await mount(
    <NativeSupportPlanScreen
      api={owner}
      legacyApi={legacy}
      emotionApi={emotion}
      current={nativePlan()}
      draft={null}
      origin={{ state: 'none' }}
      onChanged={jest.fn()}
      now={now}
      openReview
    />,
  )
  expect(
    screen.getByRole('tab', { name: 'Điều chỉnh' }).props.accessibilityState
      .selected,
  ).toBe(true)
  await waitFor(() =>
    expect(owner.getAdaptiveReview).toHaveBeenCalledWith(nativeIds.plan, 1),
  )
  expect(owner.propose).not.toHaveBeenCalled()
  expect(owner.activate).not.toHaveBeenCalled()
  expect(owner.replace).not.toHaveBeenCalled()
  expect(owner.confirmAdaptiveReview).not.toHaveBeenCalled()
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
  expect(screen.getByText('Phương án để bạn xem lại')).toBeTruthy()
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
  await screen.findByText(/Chưa thể tạo phương án lúc này/)
  await fireEvent.press(
    screen.getByRole('button', { name: 'Tạo phương án để xem lại' }),
  )
  await waitFor(() => expect(owner.propose).toHaveBeenCalledTimes(2))
  expect(owner.propose.mock.calls[0]).toEqual(owner.propose.mock.calls[1])
  expect(owner.propose.mock.calls[0]?.[0]).toBe(nativeIds.evaluation)
})
it.each([
  [
    'HTTP_500',
    500,
    'Chưa thể tạo phương án lúc này. Kết quả sàng lọc và lựa chọn của bạn vẫn được lưu; hãy thử lại.',
  ],
  [
    'RESOURCE_VERSION_STALE',
    409,
    'Danh sách tài nguyên cần cập nhật trước khi tạo phương án. Kết quả sàng lọc của bạn đã hoàn tất và vẫn được lưu; hãy thử lại sau.',
  ],
])(
  'keeps completed screening available after %s and reuses the proposal key',
  async (code, status, notice) => {
    const owner = api()
    owner.propose.mockRejectedValueOnce(
      new ApiError({
        code: String(code),
        status: Number(status),
        message: 'Unavailable',
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
    expect(await screen.findByText(String(notice))).toBeOnTheScreen()
    expect(
      screen.queryByRole('button', { name: 'Tiếp tục bài sàng lọc' }),
    ).toBeNull()
    await fireEvent.press(
      screen.getByRole('button', { name: 'Tạo phương án để xem lại' }),
    )
    await waitFor(() => expect(changed).toHaveBeenCalledTimes(1))
    expect(owner.propose.mock.calls[0]).toEqual(owner.propose.mock.calls[1])
  },
)

it.each([
  [
    false,
    'INITIAL_CHECK_INCOMPLETE',
    'Tiếp tục bài sàng lọc',
    '/(user)/assessment',
  ],
  [
    true,
    'REASSESSMENT_INCOMPLETE',
    'Tiếp tục đánh giá lại',
    '/(user)/reassessment',
  ],
] as const)(
  'returns to the correct screening before proposing, current=%s',
  async (hasCurrent, code, label, href) => {
    const owner = api()
    owner.getProposalEvaluationId.mockRejectedValueOnce(
      new ApiError({ code, status: 409, message: 'Incomplete' }),
    )
    const changed = jest.fn()
    await mount(
      <NativeProposalEntry
        api={owner}
        current={hasCurrent ? nativePlan() : null}
        draft={null}
        onChanged={changed}
      />,
    )
    await fireEvent.press(
      screen.getByRole('button', { name: 'Tạo phương án để xem lại' }),
    )
    await fireEvent.press(await screen.findByRole('button', { name: label }))
    expect(mockPush).toHaveBeenCalledWith(href)
    expect(owner.propose).not.toHaveBeenCalled()
    expect(changed).not.toHaveBeenCalled()
    owner.getProposalEvaluationId.mockResolvedValue(nativeIds.evaluation)
    await fireEvent.press(
      screen.getByRole('button', { name: 'Tạo phương án để xem lại' }),
    )
    await waitFor(() => expect(owner.propose).toHaveBeenCalledTimes(1))
  },
)
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
  await fireEvent.press(screen.getByRole('tab', { name: 'Điều chỉnh' }))
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
  await fireEvent.press(screen.getByRole('tab', { name: 'Kế hoạch' }))
  await fireEvent.press(
    await screen.findByRole('button', { name: 'Tạm dừng kế hoạch' }),
  )
  await screen.findByText('Tạm dừng kế hoạch?')
  expect(owner.changeStatus).not.toHaveBeenCalled()
  await fireEvent.press(screen.getByRole('button', { name: 'Giữ nguyên' }))
  expect(owner.changeStatus).not.toHaveBeenCalled()
})

it('shows a due cycle and only pending earlier work from the owner response', async () => {
  const f = homeEntryFixture('RESOURCE')
  f.plan.cycle = {
    cycleNumber: 2,
    state: 'REVIEW_DUE',
    currentDay: 14,
    lengthDays: 14,
    startedOn: '2026-09-30',
    reviewDueOn: '2026-10-13',
    timezone: 'Asia/Ho_Chi_Minh',
  }
  const earlier = {
    ...f.occurrence,
    localDate: '2026-10-12',
    scheduledAt: '2026-10-12T04:00:00Z',
    state: 'SCHEDULED' as const,
    displayState: 'OVERDUE' as const,
  }
  const response = await f.owner.getOccurrences('2026-09-29', '2026-10-29')
  f.owner.getOccurrences.mockResolvedValue({
    ...response,
    occurrences: [
      earlier,
      {
        ...earlier,
        occurrenceId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        hidden: true,
      },
    ],
  })
  f.owner.getAdaptiveReview.mockRejectedValue(new Error('Unavailable'))
  await mount(
    <NativeSupportPlanScreen
      api={f.owner}
      legacyApi={legacy}
      emotionApi={emotion}
      current={f.plan}
      draft={null}
      onChanged={jest.fn()}
      origin={{ state: 'none' }}
      now={now}
    />,
  )

  expect(await screen.findByText('1 hoạt động')).toBeTruthy()
  expect(
    screen.getByLabelText('Ngày 14 trên 14 ngày trong chu kỳ'),
  ).toBeTruthy()
  expect(screen.getByText(f.action.presentation.title)).toBeTruthy()
  await fireEvent.press(
    screen.getByRole('button', { name: 'Xem lại kế hoạch' }),
  )
  expect(
    screen.getByRole('tab', { name: 'Điều chỉnh', selected: true }),
  ).toBeTruthy()
  expect(f.owner.getAdaptiveReview).toHaveBeenCalledWith(
    f.plan.supportPlanId,
    f.plan.version,
  )
  expect(f.owner.getOccurrences).toHaveBeenCalledWith(
    '2026-09-30',
    '2026-10-20',
  )
  await fireEvent.press(screen.getByRole('tab', { name: 'Tiến triển' }))
  await fireEvent.press(
    await screen.findByRole('button', { name: planDayLabel('2026-10-12') }),
  )
  expect(
    screen.getByText('0 đã làm · 0 để hôm khác · 1 chưa làm'),
  ).toBeOnTheScreen()
})

it('waits for owned terminal history and fails closed before choosing a representation', async () => {
  const owner = api()
  owner.getCurrent.mockRejectedValue(
    new ApiError({
      status: 404,
      code: 'SUPPORT_PLAN_CURRENT_NOT_FOUND',
      message: 'missing',
    }),
  )
  owner.getDraft.mockRejectedValue(
    new ApiError({
      status: 404,
      code: 'SUPPORT_PLAN_DRAFT_NOT_FOUND',
      message: 'missing',
    }),
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
  expect(screen.getByRole('header', { name: 'Kế hoạch của bạn' })).toBeTruthy()
  expect(
    screen.getByRole('tab', { name: 'Hôm nay', selected: true }),
  ).toBeTruthy()
  expect(screen.queryByText('Legacy resource plan retained')).toBeNull()
  await act(async () => reject(new Error('Unavailable')))
  await screen.findByText(/Chưa thể tải lịch sử kế hoạch/)
  await fireEvent.press(screen.getByRole('tab', { name: 'Điều chỉnh' }))
  expect(
    screen.queryByRole('button', { name: 'Tạo phương án để xem lại' }),
  ).toBeNull()
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

it('treats an unclassified proxy 404 as an API failure, with the plan heading still visible', async () => {
  const owner = api()
  owner.getCurrent.mockRejectedValue(
    new ApiError({ status: 404, code: 'HTTP_404', message: 'Not found' }),
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
  await screen.findByText(/Chưa thể tải kế hoạch hỗ trợ/)
  expect(screen.getByRole('header', { name: 'Kế hoạch của bạn' })).toBeTruthy()
  expect(owner.getHistory).not.toHaveBeenCalled()
  expect(owner.propose).not.toHaveBeenCalled()
})

it('chooses latest terminal representation rather than an older native entry', async () => {
  const owner = api()
  owner.getCurrent.mockRejectedValue(
    new ApiError({
      status: 404,
      code: 'SUPPORT_PLAN_CURRENT_NOT_FOUND',
      message: 'missing',
    }),
  )
  owner.getDraft.mockRejectedValue(
    new ApiError({
      status: 404,
      code: 'SUPPORT_PLAN_DRAFT_NOT_FOUND',
      message: 'missing',
    }),
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
  await fireEvent.press(screen.getByRole('tab', { name: 'Tiến triển' }))
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
