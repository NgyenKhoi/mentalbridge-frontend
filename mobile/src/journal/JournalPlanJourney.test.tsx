import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native'
import { Alert, BackHandler } from 'react-native'
import type { AppSession } from '@/auth/session'
import {
  nativeIds,
  nativeOccurrence,
  nativePlan,
} from '@/support-plan/native-plan-test-fixtures'
import type { JournalOriginInput } from '@/support-plan/journal-plan-context'
import { ApiError } from '@/api/api-error'
import { JournalScreen } from './JournalScreen'
import { entry, journalApi, page, subject } from './journal-test-fixtures'

let mockSession: AppSession | null = { subject, role: 'USER' }
jest.mock('@/auth/session-context', () => ({
  useSession: () => ({ session: mockSession }),
}))
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }))
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'private',
}))
const originValue = {
  source: 'journal' as const,
  occurrenceId: nativeIds.occurrence,
  actionId: nativeIds.action,
  localDate: '2026-10-13',
}
const origin: JournalOriginInput = { state: 'valid', value: originValue }
const now = () => new Date('2026-10-13T12:00:00Z')
function fixture() {
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
  const planApi = {
    getCurrent: jest.fn().mockResolvedValue(plan),
    getOccurrences: jest.fn().mockResolvedValue({
      supportPlanId: plan.supportPlanId,
      supportPlanStatus: plan.status,
      representationMode: 'NATIVE_V3',
      occurrences: [occurrence],
    }),
  }
  const api = journalApi({ list: jest.fn().mockResolvedValue(page([])) })
  return {
    api,
    planApi,
    onReturnToPlan: jest.fn(),
    onBack: jest.fn(),
    planOrigin: origin,
    now,
  }
}
async function mount(props = fixture()) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  })
  const result = await render(
    <QueryClientProvider client={client}>
      <JournalScreen {...props} />
    </QueryClientProvider>,
  )
  await screen.findByText('Viết vài dòng nhật ký')
  return { ...result, client, props }
}
async function fill() {
  await screen.findByLabelText('Nội dung nhật ký')
  await fireEvent.changeText(
    screen.getByLabelText('Nội dung nhật ký'),
    'Nội dung riêng của tôi.',
  )
  await fireEvent.press(screen.getByRole('radio', { name: 'Cảm xúc: Tốt' }))
}
beforeEach(() => {
  jest.clearAllMocks()
  mockSession = { subject, role: 'USER' }
})
afterEach(() => jest.restoreAllMocks())

it('uses existing editor, sends only confirmed creation ID on explicit return and never auto-analyzes/checks', async () => {
  const { props } = await mount()
  await fill()
  await fireEvent.press(screen.getByTestId('journal-save'))
  await screen.findByText(/Đã lưu bài nhật ký. Quay lại hoạt động/)
  expect(props.onReturnToPlan).not.toHaveBeenCalled()
  await fireEvent.press(screen.getByTestId('journal-return-to-plan'))
  await waitFor(() =>
    expect(props.onReturnToPlan).toHaveBeenCalledWith({
      ...(origin.state === 'valid' ? origin.value : {}),
      journalId: entry.id,
    }),
  )
  expect(JSON.stringify(props.onReturnToPlan.mock.calls)).not.toContain(
    'Nội dung riêng',
  )
  expect(props.api.requestAnalysis).not.toHaveBeenCalled()
})
it('keeps drafts and same request on unknown save; pending hardware back and return cannot leave', async () => {
  const props = fixture()
  let complete!: (value: typeof entry) => void
  props.api.create = jest
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve
        }),
    )
    .mockRejectedValueOnce(new Error('unknown'))
    .mockResolvedValue(entry)
  const back = jest.spyOn(BackHandler, 'addEventListener')
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
  await mount(props)
  await fill()
  await fireEvent.press(screen.getByTestId('journal-save'))
  await waitFor(() =>
    expect(screen.getByTestId('journal-return-to-plan')).toBeDisabled(),
  )
  const handler = back.mock.calls
    .filter(([event]) => event === 'hardwareBackPress')
    .at(-1)![1]
  await act(async () => {
    handler({ type: 'hardwareBackPress', timeStamp: 0 })
  })
  expect(alert).not.toHaveBeenCalled()
  expect(props.onBack).not.toHaveBeenCalled()
  await act(async () => complete(entry))
  await screen.findByText('Đã lưu nhật ký.')
  alert.mockRestore()
  back.mockRestore()
})
it('unknown save locks return until exact replay confirms it', async () => {
  const props = fixture()
  props.api.create = jest
    .fn()
    .mockRejectedValueOnce(new Error('unknown'))
    .mockResolvedValue(entry)
  await mount(props)
  await fill()
  await fireEvent.press(screen.getByTestId('journal-save'))
  await screen.findByText(/Chưa xác nhận được lần lưu vừa rồi/)
  expect(screen.getByTestId('journal-return-to-plan')).toBeDisabled()
  expect(props.onReturnToPlan).not.toHaveBeenCalled()
  await fireEvent.press(screen.getByTestId('journal-save'))
  await screen.findByText('Đã lưu nhật ký.')
  expect((props.api.create as jest.Mock).mock.calls[1]).toEqual(
    (props.api.create as jest.Mock).mock.calls[0],
  )
})
it('query changes never reset a dirty editor or retarget its saved candidate', async () => {
  const { props, client, rerender } = await mount()
  await fill()
  await rerender(
    <QueryClientProvider client={client}>
      <JournalScreen
        {...props}
        planOrigin={{
          state: 'valid',
          value: {
            ...originValue,
            actionId: '22222222-2222-4222-8222-222222222223',
          },
        }}
      />
    </QueryClientProvider>,
  )
  expect(screen.getByLabelText('Nội dung nhật ký')).toHaveDisplayValue(
    'Nội dung riêng của tôi.',
  )
  await fireEvent.press(screen.getByTestId('journal-save'))
  await screen.findByText('Đã lưu nhật ký.')
  await fireEvent.press(screen.getByTestId('journal-return-to-plan'))
  await waitFor(() =>
    expect(props.onReturnToPlan).toHaveBeenCalledWith({
      ...(origin.state === 'valid' ? origin.value : {}),
      journalId: entry.id,
    }),
  )
})
it('return outage preserves the saved candidate for retry', async () => {
  const { props } = await mount()
  await fill()
  await fireEvent.press(screen.getByTestId('journal-save'))
  await screen.findByText('Đã lưu nhật ký.')
  props.planApi.getCurrent.mockRejectedValueOnce(new Error('unavailable'))
  await fireEvent.press(screen.getByTestId('journal-return-to-plan'))
  await screen.findByText(/Chưa kiểm tra được hoạt động để quay lại/)
  expect(props.onReturnToPlan).not.toHaveBeenCalled()
  await fireEvent.press(screen.getByTestId('journal-return-to-plan'))
  await waitFor(() =>
    expect(props.onReturnToPlan).toHaveBeenCalledWith(
      expect.objectContaining({ journalId: entry.id }),
    ),
  )
})
it('asks before dropping a changed saved draft; cancel retains inputs', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
  const { props } = await mount()
  await fill()
  await fireEvent.press(screen.getByTestId('journal-return-to-plan'))
  expect(alert).toHaveBeenCalledWith(
    'Rời bài viết?',
    expect.any(String),
    expect.any(Array),
  )
  expect(props.onReturnToPlan).not.toHaveBeenCalled()
  expect(screen.getByLabelText('Nội dung nhật ký')).toHaveDisplayValue(
    'Nội dung riêng của tôi.',
  )
  alert.mockRestore()
})
it('subject change clears origin draft and candidate', async () => {
  const { props, client, rerender } = await mount()
  await fill()
  mockSession = {
    subject: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    role: 'USER',
  }
  props.planApi.getCurrent.mockResolvedValue({
    ...nativePlan(),
    representationMode: 'V2_RESOURCE_ADAPTER',
  })
  await rerender(
    <QueryClientProvider client={client}>
      <JournalScreen {...props} />
    </QueryClientProvider>,
  )
  await screen.findByText(/Không xác định được hoạt động này/)
  expect(screen.queryByLabelText('Nội dung nhật ký')).toBeNull()
  expect(props.onReturnToPlan).not.toHaveBeenCalled()
})
it('a late origin read never retargets ordinary writing that was already started', async () => {
  const props = fixture()
  const plan = await props.planApi.getCurrent()
  let finish!: (value: typeof plan) => void
  props.planApi.getCurrent.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  })
  await render(
    <QueryClientProvider client={client}>
      <JournalScreen {...props} />
    </QueryClientProvider>,
  )
  await fireEvent.press(await screen.findByTestId('journal-new'))
  await fill()
  await act(async () => finish(plan))
  await screen.findByText('Viết vài dòng nhật ký')
  expect(screen.getByLabelText('Nội dung nhật ký')).toHaveDisplayValue(
    'Nội dung riêng của tôi.',
  )
  await fireEvent.press(screen.getByTestId('journal-save'))
  await screen.findByText('Đã lưu nhật ký.')
  await fireEvent.press(screen.getByTestId('journal-return-to-plan'))
  await waitFor(() =>
    expect(props.onReturnToPlan).toHaveBeenCalledWith(originValue),
  )
})
it('revising a newly saved entry keeps the same candidate and does not create a second fact', async () => {
  const { props } = await mount()
  await fill()
  await fireEvent.press(screen.getByTestId('journal-save'))
  await screen.findByText('Đã lưu nhật ký.')
  await fireEvent.changeText(
    screen.getByLabelText('Nội dung nhật ký'),
    'Chỉnh sửa vẫn riêng tư.',
  )
  await fireEvent.press(screen.getByTestId('journal-save'))
  await waitFor(() => expect(props.api.revise).toHaveBeenCalledTimes(1))
  await waitFor(() =>
    expect(screen.getByTestId('journal-return-to-plan')).not.toBeDisabled(),
  )
  await fireEvent.press(screen.getByTestId('journal-return-to-plan'))
  await waitFor(() =>
    expect(props.onReturnToPlan).toHaveBeenCalledWith(
      expect.objectContaining({ journalId: entry.id }),
    ),
  )
  expect(props.api.create).toHaveBeenCalledTimes(1)
  expect(props.api.requestAnalysis).not.toHaveBeenCalled()
})
it('opens an accepted owned entry, not the query candidate, without creating another writing session', async () => {
  const props = fixture()
  const accepted = {
    ownerDomain: 'JOURNAL_AI' as const,
    kind: 'JOURNAL_ENTRY' as const,
    factId: entry.id,
    factRevision: '1',
    occurredAt: entry.createdAt,
    verifiedAt: entry.createdAt,
  }
  props.planApi.getOccurrences.mockResolvedValue({
    supportPlanId: nativeIds.plan,
    supportPlanStatus: 'ACTIVE',
    representationMode: 'NATIVE_V3',
    occurrences: [
      nativeOccurrence({
        actionType: 'JOURNAL',
        state: 'COMPLETED',
        displayState: 'COMPLETED',
        completionEvidence: accepted,
      }),
    ],
  })
  props.planOrigin = {
    state: 'valid',
    value: { ...originValue, journalId: entry.id },
  }
  await mount(props)
  await screen.findByLabelText('Nội dung nhật ký')
  expect(props.api.detail).toHaveBeenCalledWith(entry.id)
  expect(props.api.create).not.toHaveBeenCalled()
  await fireEvent.press(screen.getByTestId('journal-return-to-plan'))
  await waitFor(() =>
    expect(props.onReturnToPlan).toHaveBeenCalledWith(
      expect.objectContaining({ journalId: entry.id }),
    ),
  )
})
it('unavailable/deleted owned entry keeps its accepted history link without fabricating private content', async () => {
  const props = fixture()
  props.planOrigin = {
    state: 'valid',
    value: { ...originValue, journalId: entry.id },
  }
  props.planApi.getOccurrences.mockResolvedValue({
    supportPlanId: nativeIds.plan,
    supportPlanStatus: 'ACTIVE',
    representationMode: 'NATIVE_V3',
    occurrences: [
      nativeOccurrence({
        actionType: 'JOURNAL',
        state: 'COMPLETED',
        displayState: 'COMPLETED',
        completionEvidence: {
          ownerDomain: 'JOURNAL_AI',
          kind: 'JOURNAL_ENTRY',
          factId: entry.id,
          factRevision: '1',
          occurredAt: entry.createdAt,
          verifiedAt: entry.createdAt,
        },
      }),
    ],
  })
  props.api.detail = jest
    .fn()
    .mockRejectedValue(
      new ApiError({ status: 404, code: 'NOT_FOUND', message: 'missing' }),
    )
  await mount(props)
  await screen.findByRole('button', { name: 'Thử mở lại nhật ký' })
  expect(screen.queryByLabelText('Nội dung nhật ký')).toBeNull()
  await fireEvent.press(screen.getByTestId('journal-return-to-plan'))
  await waitFor(() =>
    expect(props.onReturnToPlan).toHaveBeenCalledWith(
      expect.objectContaining({ journalId: entry.id }),
    ),
  )
})
it('a different day explains the boundary and ordinary private writing does not supply a plan candidate', async () => {
  const props = fixture()
  props.now = () => new Date('2026-10-14T12:00:00Z')
  await mount(props)
  await screen.findByText(/không thể tạo bài cho một hoạt động ở ngày khác/)
  expect(screen.queryByLabelText('Nội dung nhật ký')).toBeNull()
  await fireEvent.press(screen.getByTestId('journal-new'))
  await fill()
  await fireEvent.press(screen.getByTestId('journal-save'))
  await screen.findByText('Đã lưu nhật ký.')
  await fireEvent.press(screen.getByTestId('journal-return-to-plan'))
  await waitFor(() =>
    expect(props.onReturnToPlan).toHaveBeenCalledWith(
      origin.state === 'valid' ? origin.value : undefined,
    ),
  )
})
