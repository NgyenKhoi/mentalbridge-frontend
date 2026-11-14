import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native'
import type { ReactElement } from 'react'
import * as SecureStore from 'expo-secure-store'

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
const mockSecureValues = new Map<string, string>()
const mockFocusCallbacks = new Set<() => void | (() => void)>()
jest.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 1,
  getItemAsync: jest.fn(
    async (key: string) => mockSecureValues.get(key) ?? null,
  ),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    mockSecureValues.set(key, value)
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    mockSecureValues.delete(key)
  }),
}))
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: (value: unknown) => mockPush(value) },
  useFocusEffect: (callback: () => void | (() => void)) => {
    jest.requireActual('react').useEffect(() => {
      mockFocusCallbacks.add(callback)
      const cleanup = callback()
      return () => {
        mockFocusCallbacks.delete(callback)
        cleanup?.()
      }
    }, [callback])
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
    getGuidedJourney: jest.fn().mockResolvedValue({
      journeyPolicyVersion: 'mb-guided-journey-v1',
      stage: 'GUIDE_READY',
      assessmentInProgress: false,
      episodeId: nativeIds.evaluation,
      episodeCompletedAt: '2026-10-13T01:00:00Z',
      presentationEvaluationId: nativeIds.evaluation,
      supportGuideId: nativeIds.plan,
      nextAction: 'EXPLORE_GUIDE_RESOURCES',
      currentSupportPlanId: null,
      entitlementStatus: 'NOT_REQUIRED',
    }),
    ensureInitial: jest.fn().mockResolvedValue(nativePlan('DRAFT')),
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
beforeEach(() => {
  jest.clearAllMocks()
  mockSecureValues.clear()
})

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
  expect(owner.getCurrent).toHaveBeenCalled()
})
it('automatically prepares an initial proposal for a persisted eligible Guide', async () => {
  const owner = api()
  const missing = new ApiError({
    status: 404,
    code: 'NOT_FOUND',
    message: 'missing',
  })
  let created = false
  owner.getCurrent.mockRejectedValue(missing)
  owner.getDraft.mockImplementation(async () => {
    if (created) return nativePlan('DRAFT')
    throw missing
  })
  owner.getGuidedJourney.mockResolvedValue({
    ...(await owner.getGuidedJourney()),
    nextAction: 'START_PLAN_PROPOSAL',
    entitlementStatus: 'VERIFIED',
  })
  owner.ensureInitial.mockImplementation(async () => {
    created = true
    return nativePlan('DRAFT')
  })
  const first = await mount(
    <SupportPlanActionWorkspace
      api={owner}
      legacyApi={legacy}
      emotionApi={emotion}
      origin={{ state: 'none' }}
      now={now}
    />,
  )
  await screen.findByText('Phương án để bạn xem lại')
  expect(owner.ensureInitial).toHaveBeenCalledWith(
    nativeIds.evaluation,
    `mb-initial-proposal-${nativeIds.evaluation}`,
  )
  expect(owner.ensureInitial).toHaveBeenCalledTimes(1)
  expect(owner.propose).not.toHaveBeenCalled()
  expect(owner.activate).not.toHaveBeenCalled()
  await first.unmount()
  await mount(
    <SupportPlanActionWorkspace
      api={owner}
      legacyApi={legacy}
      emotionApi={emotion}
      origin={{ state: 'none' }}
      now={now}
    />,
  )
  await screen.findByText('Phương án để bạn xem lại')
  expect(owner.ensureInitial).toHaveBeenCalledTimes(1)
})
it('rechecks an earlier unavailable journey when returning after eligibility changes', async () => {
  const owner = api()
  const missing = new ApiError({
    status: 404,
    code: 'NOT_FOUND',
    message: 'missing',
  })
  let created = false
  owner.getCurrent.mockRejectedValue(missing)
  owner.getDraft.mockImplementation(async () => {
    if (created) return nativePlan('DRAFT')
    throw missing
  })
  const journey = await owner.getGuidedJourney()
  owner.ensureInitial.mockImplementation(async () => {
    created = true
    return nativePlan('DRAFT')
  })
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  })
  const view = () => (
    <QueryClientProvider client={queryClient}>
      <SupportPlanActionWorkspace
        api={owner}
        legacyApi={legacy}
        emotionApi={emotion}
        origin={{ state: 'none' }}
        now={now}
      />
    </QueryClientProvider>
  )
  const first = await render(view())
  await screen.findByRole('button', { name: 'Quay lại hướng dẫn hỗ trợ' })
  expect(owner.ensureInitial).not.toHaveBeenCalled()
  await first.unmount()
  owner.getGuidedJourney.mockResolvedValue({
    ...journey,
    nextAction: 'START_PLAN_PROPOSAL',
    entitlementStatus: 'VERIFIED',
  })
  await render(view())
  await screen.findByText('Phương án để bạn xem lại')
  expect(owner.ensureInitial).toHaveBeenCalledTimes(1)
})
it('refreshes a still-mounted Plan on focus and prepares an eligible proposal once', async () => {
  const owner = api()
  const missing = new ApiError({
    status: 404,
    code: 'NOT_FOUND',
    message: 'missing',
  })
  let created = false
  owner.getCurrent.mockRejectedValue(missing)
  owner.getDraft.mockImplementation(async () => {
    if (created) return nativePlan('DRAFT')
    throw missing
  })
  const journey = await owner.getGuidedJourney()
  owner.ensureInitial.mockImplementation(async () => {
    created = true
    return nativePlan('DRAFT')
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
  await screen.findByRole('button', { name: 'Quay lại hướng dẫn hỗ trợ' })
  owner.getGuidedJourney.mockResolvedValue({
    ...journey,
    nextAction: 'START_PLAN_PROPOSAL',
    entitlementStatus: 'VERIFIED',
  })
  await act(async () => {
    for (const callback of mockFocusCallbacks) callback()
  })
  await screen.findByText('Phương án để bạn xem lại')
  expect(owner.ensureInitial).toHaveBeenCalledTimes(1)
  await act(async () => {
    for (const callback of mockFocusCallbacks) callback()
  })
  await waitFor(() =>
    expect(owner.getDraft.mock.calls.length).toBeGreaterThan(3),
  )
  expect(owner.ensureInitial).toHaveBeenCalledTimes(1)
  expect(owner.activate).not.toHaveBeenCalled()
})
it('loads a current plan appearing while the Plan remains mounted without proposing', async () => {
  const owner = api()
  const missing = new ApiError({
    status: 404,
    code: 'NOT_FOUND',
    message: 'missing',
  })
  let current: ReturnType<typeof nativePlan> | null = null
  owner.getCurrent.mockImplementation(async () => {
    if (current) return current
    throw missing
  })
  owner.getDraft.mockRejectedValue(missing)
  await mount(
    <SupportPlanActionWorkspace
      api={owner}
      legacyApi={legacy}
      emotionApi={emotion}
      origin={{ state: 'none' }}
      now={now}
    />,
  )
  await screen.findByRole('button', { name: 'Quay lại hướng dẫn hỗ trợ' })
  current = nativePlan('PAUSED')
  await act(async () => {
    for (const callback of mockFocusCallbacks) callback()
  })
  await screen.findByText('Kế hoạch hiện tại')
  expect(owner.ensureInitial).not.toHaveBeenCalled()
  expect(owner.activate).not.toHaveBeenCalled()
})
it('does not restart an in-flight proposal on repeated focus', async () => {
  const owner = api()
  const missing = new ApiError({
    status: 404,
    code: 'NOT_FOUND',
    message: 'missing',
  })
  let created = false
  let complete!: (value: ReturnType<typeof nativePlan>) => void
  owner.getCurrent.mockRejectedValue(missing)
  owner.getDraft.mockImplementation(async () => {
    if (created) return nativePlan('DRAFT')
    throw missing
  })
  const journey = await owner.getGuidedJourney()
  owner.ensureInitial.mockImplementation(
    () =>
      new Promise((resolve) => {
        complete = resolve
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
  await screen.findByRole('button', { name: 'Quay lại hướng dẫn hỗ trợ' })
  owner.getGuidedJourney.mockResolvedValue({
    ...journey,
    nextAction: 'START_PLAN_PROPOSAL',
    entitlementStatus: 'VERIFIED',
  })
  await act(async () => {
    for (const callback of mockFocusCallbacks) callback()
  })
  await waitFor(() => expect(owner.ensureInitial).toHaveBeenCalledTimes(1))
  await act(async () => {
    for (const callback of mockFocusCallbacks) callback()
    for (const callback of mockFocusCallbacks) callback()
  })
  expect(owner.ensureInitial).toHaveBeenCalledTimes(1)
  await act(async () => {
    created = true
    complete(nativePlan('DRAFT'))
  })
  await screen.findByText('Phương án để bạn xem lại')
  expect(owner.activate).not.toHaveBeenCalled()
})
it('rechecks Guide eligibility after focus if an older journey read is in flight', async () => {
  const owner = api()
  const missing = new ApiError({
    status: 404,
    code: 'NOT_FOUND',
    message: 'missing',
  })
  let created = false
  let complete!: (
    value: Awaited<ReturnType<SupportPlanActionApi['getGuidedJourney']>>,
  ) => void
  owner.getCurrent.mockRejectedValue(missing)
  owner.getDraft.mockImplementation(async () => {
    if (created) return nativePlan('DRAFT')
    throw missing
  })
  const oldJourney = await owner.getGuidedJourney()
  owner.getGuidedJourney.mockReset()
  owner.getGuidedJourney.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        complete = resolve
      }),
  )
  owner.getGuidedJourney.mockResolvedValue({
    ...oldJourney,
    nextAction: 'START_PLAN_PROPOSAL',
    entitlementStatus: 'VERIFIED',
  })
  owner.ensureInitial.mockImplementation(async () => {
    created = true
    return nativePlan('DRAFT')
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
  await waitFor(() => expect(owner.getGuidedJourney).toHaveBeenCalledTimes(1))
  await act(async () => {
    for (const callback of mockFocusCallbacks) callback()
  })
  await act(async () => complete(oldJourney))
  await screen.findByText('Phương án để bạn xem lại')
  expect(owner.ensureInitial).toHaveBeenCalledTimes(1)
  expect(owner.activate).not.toHaveBeenCalled()
})
it.each(['REVIEW_SAFETY_SUPPORT', 'EXPLORE_GUIDE_RESOURCES'] as const)(
  'does not propose on focus when the current Guide says %s',
  async (nextAction) => {
    const owner = api()
    const missing = new ApiError({
      status: 404,
      code: 'NOT_FOUND',
      message: 'missing',
    })
    owner.getCurrent.mockRejectedValue(missing)
    owner.getDraft.mockRejectedValue(missing)
    const journey = await owner.getGuidedJourney()
    await mount(
      <SupportPlanActionWorkspace
        api={owner}
        legacyApi={legacy}
        emotionApi={emotion}
        origin={{ state: 'none' }}
        now={now}
      />,
    )
    await screen.findByRole('button', { name: 'Quay lại hướng dẫn hỗ trợ' })
    const initialCalls = owner.getGuidedJourney.mock.calls.length
    owner.getGuidedJourney.mockResolvedValue({ ...journey, nextAction })
    await act(async () => {
      for (const callback of mockFocusCallbacks) callback()
    })
    await waitFor(() =>
      expect(owner.getGuidedJourney.mock.calls.length).toBeGreaterThan(
        initialCalls,
      ),
    )
    expect(owner.ensureInitial).not.toHaveBeenCalled()
  },
)
it.each(['REVIEW_SAFETY_SUPPORT', 'EXPLORE_GUIDE_RESOURCES'] as const)(
  'does not create a proposal when Guide returns %s',
  async (nextAction) => {
    const owner = api()
    const missing = new ApiError({
      status: 404,
      code: 'NOT_FOUND',
      message: 'missing',
    })
    owner.getCurrent.mockRejectedValue(missing)
    owner.getDraft.mockRejectedValue(missing)
    owner.getGuidedJourney.mockResolvedValue({
      ...(await owner.getGuidedJourney()),
      nextAction,
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
    await screen.findByRole('button', { name: 'Quay lại hướng dẫn hỗ trợ' })
    expect(owner.ensureInitial).not.toHaveBeenCalled()
  },
)
it.each(['ACTIVE', 'PAUSED'] as const)(
  'opens an existing %s plan without automatic proposal',
  async (status) => {
    const owner = api()
    owner.getCurrent.mockResolvedValue(nativePlan(status))
    owner.getDraft.mockRejectedValue(
      new ApiError({ status: 404, code: 'NOT_FOUND', message: 'missing' }),
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
    await screen.findByText('Kế hoạch hiện tại')
    expect(owner.ensureInitial).not.toHaveBeenCalled()
    expect(owner.activate).not.toHaveBeenCalled()
  },
)
it.each(['REQUEST_TIMEOUT', 'SUPPORT_PLAN_INITIAL_CHANGED'] as const)(
  'reconciles %s before retrying the proposal',
  async (code) => {
    const owner = api()
    const missing = new ApiError({
      status: 404,
      code: 'NOT_FOUND',
      message: 'missing',
    })
    let created = false
    owner.getCurrent.mockRejectedValue(missing)
    owner.getDraft.mockImplementation(async () => {
      if (created) return nativePlan('DRAFT')
      throw missing
    })
    owner.getGuidedJourney.mockResolvedValue({
      ...(await owner.getGuidedJourney()),
      nextAction: 'START_PLAN_PROPOSAL',
      entitlementStatus: 'VERIFIED',
    })
    owner.ensureInitial.mockImplementation(async () => {
      created = true
      throw new ApiError({
        code,
        ...(code === 'SUPPORT_PLAN_INITIAL_CHANGED' ? { status: 409 } : {}),
        message: 'unavailable',
      })
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
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Thử lại' }),
    )
    await screen.findByText('Phương án để bạn xem lại')
    expect(owner.ensureInitial).toHaveBeenCalledTimes(1)
  },
)
it('opens the authoritative current activity view after activation', async () => {
  const owner = api()
  const missing = new ApiError({
    status: 404,
    code: 'NOT_FOUND',
    message: 'missing',
  })
  owner.getCurrent
    .mockRejectedValueOnce(missing)
    .mockResolvedValue(nativePlan())
  owner.getDraft
    .mockResolvedValueOnce(nativePlan('DRAFT'))
    .mockRejectedValue(missing)
  await mount(
    <SupportPlanActionWorkspace
      api={owner}
      legacyApi={legacy}
      emotionApi={emotion}
      origin={{ state: 'none' }}
      now={now}
    />,
  )
  await fireEvent.press(await screen.findByTestId('native-plan-activate'))
  await screen.findByText('Kế hoạch hiện tại')
  await screen.findByText('Hoạt động gần đây và sắp tới')
  expect(owner.propose).not.toHaveBeenCalled()
})
it('keeps recovery when current plan cannot be confirmed after activation', async () => {
  const owner = api()
  owner.getCurrent
    .mockRejectedValueOnce(
      new ApiError({ code: 'NETWORK_ERROR', message: 'offline' }),
    )
    .mockResolvedValue(nativePlan())
  const changed = jest.fn().mockResolvedValue(undefined)
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
  await fireEvent.press(screen.getByTestId('native-plan-activate'))
  await screen.findByText(/Chưa thể thực hiện thao tác/)
  expect(changed).not.toHaveBeenCalled()
  await fireEvent.press(screen.getByTestId('native-plan-activate'))
  await waitFor(() => expect(changed).toHaveBeenCalled())
  expect(owner.activate).toHaveBeenCalledTimes(1)
})
it('renders the Care review cycle and focus reason without starting the plan', async () => {
  const owner = api()
  const draft = nativePlan('DRAFT')
  draft.focuses[0]!.rationale = 'Lý do từ Care'
  draft.cycle = {
    policyVersion: 'support-plan-cycle-v1',
    lengthDays: 14,
    timezone: 'Asia/Ho_Chi_Minh',
    cycleNumber: 1,
    startedOn: null,
    reviewDueOn: null,
    currentDay: null,
    pausedDays: 0,
    state: 'NOT_STARTED',
  }
  await mount(
    <NativeSupportPlanScreen
      api={owner}
      legacyApi={legacy}
      emotionApi={emotion}
      current={null}
      draft={draft}
      onChanged={jest.fn()}
      origin={{ state: 'none' }}
      now={now}
    />,
  )
  expect(screen.getByText('Lý do từ Care')).toBeTruthy()
  expect(screen.getByText(/không phải thời gian điều trị/)).toBeTruthy()
  expect(screen.getByText('Múi giờ: Asia/Ho_Chi_Minh')).toBeTruthy()
  expect(owner.activate).not.toHaveBeenCalled()
})
it('reconciles a timeout before retrying with the same activation key', async () => {
  const owner = api()
  const draft = nativePlan('DRAFT')
  owner.activate.mockRejectedValueOnce(
    new ApiError({ code: 'REQUEST_TIMEOUT', message: 'timeout' }),
  )
  owner.getCurrent
    .mockRejectedValueOnce(
      new ApiError({ status: 404, code: 'NOT_FOUND', message: 'missing' }),
    )
    .mockResolvedValue(nativePlan())
  owner.getDraft.mockResolvedValue(draft)
  await mount(
    <NativeSupportPlanScreen
      api={owner}
      legacyApi={legacy}
      emotionApi={emotion}
      current={null}
      draft={draft}
      onChanged={jest.fn().mockResolvedValue(undefined)}
      origin={{ state: 'none' }}
      now={now}
    />,
  )
  await fireEvent.press(screen.getByTestId('native-plan-activate'))
  await screen.findByText(/Chưa thể thực hiện thao tác/)
  await fireEvent.press(screen.getByTestId('native-plan-activate'))
  await waitFor(() => expect(owner.activate).toHaveBeenCalledTimes(2))
  await waitFor(() => expect(owner.getCurrent).toHaveBeenCalledTimes(2))
  expect(owner.getDraft).toHaveBeenCalledTimes(1)
  expect(owner.activate.mock.calls[0]).toEqual(owner.activate.mock.calls[1])
})
it('restores an ambiguous activation after the screen is remounted', async () => {
  const owner = api()
  const draft = nativePlan('DRAFT')
  owner.activate.mockRejectedValueOnce(
    new ApiError({ code: 'REQUEST_TIMEOUT', message: 'timeout' }),
  )
  owner.getCurrent
    .mockRejectedValueOnce(
      new ApiError({ status: 404, code: 'NOT_FOUND', message: 'missing' }),
    )
    .mockResolvedValue(nativePlan())
  owner.getDraft.mockResolvedValue(draft)
  const view = () => (
    <NativeSupportPlanScreen
      api={owner}
      legacyApi={legacy}
      emotionApi={emotion}
      current={null}
      draft={draft}
      onChanged={jest.fn().mockResolvedValue(undefined)}
      origin={{ state: 'none' }}
      now={now}
    />
  )
  const first = await mount(view())
  await fireEvent.press(screen.getByTestId('native-plan-activate'))
  await screen.findByText(/Chưa thể thực hiện thao tác/)
  await first.unmount()
  await mount(view())
  await fireEvent.press(screen.getByTestId('native-plan-activate'))
  await waitFor(() => expect(owner.activate).toHaveBeenCalledTimes(2))
  await waitFor(() => expect(owner.getCurrent).toHaveBeenCalledTimes(2))
  expect(owner.activate.mock.calls[0]).toEqual(owner.activate.mock.calls[1])
})
it('does not activate if secure recovery storage is unavailable', async () => {
  const owner = api()
  jest
    .mocked(SecureStore.setItemAsync)
    .mockRejectedValueOnce(new Error('storage unavailable'))
  await mount(
    <NativeSupportPlanScreen
      api={owner}
      legacyApi={legacy}
      emotionApi={emotion}
      current={null}
      draft={nativePlan('DRAFT')}
      onChanged={jest.fn().mockResolvedValue(undefined)}
      origin={{ state: 'none' }}
      now={now}
    />,
  )
  await fireEvent.press(screen.getByTestId('native-plan-activate'))
  await screen.findByText(/Chưa thể thực hiện thao tác/)
  expect(owner.activate).not.toHaveBeenCalled()
})
it('does not retry activation when reconciliation finds a current plan', async () => {
  const owner = api()
  owner.activate.mockRejectedValueOnce(
    new ApiError({ code: 'REQUEST_TIMEOUT', message: 'timeout' }),
  )
  const changed = jest.fn().mockResolvedValue(undefined)
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
  await fireEvent.press(screen.getByTestId('native-plan-activate'))
  await screen.findByText(/Chưa thể thực hiện thao tác/)
  await fireEvent.press(screen.getByTestId('native-plan-activate'))
  await waitFor(() => expect(changed).toHaveBeenCalled())
  expect(owner.activate).toHaveBeenCalledTimes(1)
})
it('does not retry an activation after the draft version changes', async () => {
  const owner = api()
  const draft = nativePlan('DRAFT')
  owner.activate.mockRejectedValueOnce(
    new ApiError({
      status: 412,
      code: 'VERSION_CONFLICT',
      message: 'conflict',
    }),
  )
  owner.getCurrent.mockRejectedValue(
    new ApiError({ status: 404, code: 'NOT_FOUND', message: 'missing' }),
  )
  owner.getDraft.mockResolvedValue({ ...draft, version: draft.version + 1 })
  await mount(
    <NativeSupportPlanScreen
      api={owner}
      legacyApi={legacy}
      emotionApi={emotion}
      current={null}
      draft={draft}
      onChanged={jest.fn().mockResolvedValue(undefined)}
      origin={{ state: 'none' }}
      now={now}
    />,
  )
  await fireEvent.press(screen.getByTestId('native-plan-activate'))
  await screen.findByText(/Kế hoạch hoặc hoạt động đã thay đổi/)
  await fireEvent.press(screen.getByTestId('native-plan-activate'))
  await screen.findByText(/Phương án đã thay đổi/)
  expect(owner.activate).toHaveBeenCalledTimes(1)
})
it('suppresses a second activation while the first request is pending', async () => {
  const owner = api()
  let resolve!: (plan: ReturnType<typeof nativePlan>) => void
  owner.activate.mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done
      }),
  )
  await mount(
    <NativeSupportPlanScreen
      api={owner}
      legacyApi={legacy}
      emotionApi={emotion}
      current={null}
      draft={nativePlan('DRAFT')}
      onChanged={jest.fn().mockResolvedValue(undefined)}
      origin={{ state: 'none' }}
      now={now}
    />,
  )
  await fireEvent.press(screen.getByTestId('native-plan-activate'))
  await fireEvent.press(screen.getByTestId('native-plan-activate'))
  expect(owner.activate).toHaveBeenCalledTimes(1)
  await act(async () => resolve(nativePlan()))
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
it.each([
  ['SUPPORT_PLAN_ENTITLEMENT_REQUIRED', 403, /Gói hiện tại chưa có quyền/],
  ['SUPPORT_PLAN_SAFETY_REVIEW_REQUIRED', 409, /hướng dẫn hỗ trợ an toàn/],
] as const)(
  'preserves Guide access when Care returns %s',
  async (code, status, expected) => {
    const owner = api()
    owner.propose.mockRejectedValue(
      new ApiError({ code, status, message: 'private details' }),
    )
    await mount(
      <NativeProposalEntry
        api={owner}
        current={null}
        draft={null}
        onChanged={jest.fn()}
      />,
    )
    await fireEvent.press(
      screen.getByRole('button', { name: 'Tạo phương án để xem lại' }),
    )
    await screen.findByText(expected)
    expect(screen.queryByText('private details')).toBeNull()
    await fireEvent.press(
      screen.getByRole('button', { name: 'Quay lại hướng dẫn hỗ trợ' }),
    )
    expect(mockPush).toHaveBeenCalledWith('/(user)/assessment')
  },
)
it.each(['ACTIVE', 'PAUSED'] as const)(
  'does not offer draft creation for a %s plan',
  async (status) => {
    const owner = api()
    await mount(
      <NativeProposalEntry
        api={owner}
        current={nativePlan(status)}
        draft={null}
        onChanged={jest.fn()}
      />,
    )
    expect(
      screen.queryByRole('button', { name: 'Tạo phương án để xem lại' }),
    ).toBeNull()
    expect(owner.propose).not.toHaveBeenCalled()
  },
)
it('shows locked state after an entitlement rejection and lets the user retry explicitly', async () => {
  const owner = api()
  owner.propose.mockRejectedValueOnce(
    new ApiError({
      code: 'SUPPORT_PLAN_ENTITLEMENT_REQUIRED',
      status: 403,
      message: 'private',
    }),
  )
  await mount(
    <NativeProposalEntry
      api={owner}
      current={null}
      draft={null}
      onChanged={jest.fn()}
    />,
  )
  await fireEvent.press(
    screen.getByRole('button', { name: 'Tạo phương án để xem lại' }),
  )
  await screen.findByText('Kế hoạch chưa khả dụng với gói hiện tại')
  expect(
    screen.queryByRole('button', { name: 'Tạo phương án để xem lại' }),
  ).toBeNull()
  await fireEvent.press(
    screen.getByRole('button', { name: 'Thử kiểm tra lại' }),
  )
  expect(
    screen.getByRole('button', { name: 'Tạo phương án để xem lại' }),
  ).toBeTruthy()
})
it('shows locked state after entitlement is revoked during activation', async () => {
  const owner = api()
  owner.activate.mockRejectedValueOnce(
    new ApiError({
      code: 'SUPPORT_PLAN_ENTITLEMENT_REQUIRED',
      status: 403,
      message: 'private',
    }),
  )
  await mount(
    <NativeSupportPlanScreen
      api={owner}
      legacyApi={legacy}
      emotionApi={emotion}
      current={null}
      draft={nativePlan('DRAFT')}
      onChanged={jest.fn()}
      origin={{ state: 'none' }}
      now={now}
    />,
  )
  await fireEvent.press(screen.getByTestId('native-plan-activate'))
  await screen.findByText('Kế hoạch chưa khả dụng với gói hiện tại')
  expect(screen.queryByTestId('native-plan-activate')).toBeNull()
  expect(mockSecureValues.size).toBe(0)
  expect(
    screen.getByRole('button', { name: 'Quay lại hướng dẫn hỗ trợ' }),
  ).toBeTruthy()
})
it('explains stale Care evidence without exposing backend details', async () => {
  const owner = api()
  owner.propose.mockRejectedValue(
    new ApiError({
      code: 'SUPPORT_EVALUATION_STALE',
      status: 409,
      message: 'private',
    }),
  )
  await mount(
    <NativeProposalEntry
      api={owner}
      current={null}
      draft={null}
      onChanged={jest.fn()}
    />,
  )
  await fireEvent.press(
    screen.getByRole('button', { name: 'Tạo phương án để xem lại' }),
  )
  await screen.findByText(/Thông tin nguồn hoặc hoạt động đã thay đổi/)
  expect(screen.queryByText('private')).toBeNull()
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
  await screen.findByRole('button', { name: 'Quay lại hướng dẫn hỗ trợ' })
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
