import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native'
import { AccessibilityInfo } from 'react-native'

import type { SupportPlanActionApi } from '@/support-plan/support-plan-action-api'
import {
  nativeIds,
  nativeOccurrence,
  nativePlan,
} from '@/support-plan/native-plan-test-fixtures'

import { SupportPlanCompanion } from './SupportPlanCompanion'
import { resetCompanionSessionPreferences } from './companion-session'

const mockPush = jest.fn()
jest.mock('expo-router', () => ({
  router: { push: (value: unknown) => mockPush(value) },
}))

function message() {
  return {
    schemaVersion: 'support-plan-companion-message-v1',
    supportPlanId: nativeIds.plan,
    actionId: nativeIds.action,
    intent: 'EXPLAIN_ACTION',
    surface: 'TODAY',
    text: 'Hoạt động này đến từ kế hoạch đã được bạn duyệt.',
    delivery: 'GENERATED',
    policyVersion: 'support-plan-companion-policy-v1',
    promptVersion: 'support-plan-companion-prompt-v1',
    templateVersion: 'support-plan-companion-template-v1',
    provider: 'OPENAI',
    model: 'bounded-test-model',
    fallbackReason: null,
  } as const
}

function api() {
  return {
    requestCompanionExplanation: jest.fn().mockResolvedValue(message()),
  } as unknown as jest.Mocked<SupportPlanActionApi>
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

function companion(
  owner = api(),
  interrupted = false,
  plan = nativePlan(),
  occurrences = [nativeOccurrence()],
) {
  return (
    <SupportPlanCompanion
      api={owner}
      subject="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
      plan={plan}
      occurrences={occurrences}
      now={() => new Date('2026-10-13T12:00:00Z')}
      interrupted={interrupted}
    />
  )
}

beforeEach(() => {
  jest.clearAllMocks()
  resetCompanionSessionPreferences()
  jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockResolvedValue(false)
})

afterEach(() => jest.restoreAllMocks())

it('stays in-flow and makes no provider request until the user asks', async () => {
  const owner = api()
  await render(companion(owner))
  expect(screen.getByTestId('support-plan-companion')).toBeTruthy()
  expect(
    screen.getByText(/Kế hoạch chỉ thay đổi khi bạn xác nhận/),
  ).toBeTruthy()
  expect(owner.requestCompanionExplanation).not.toHaveBeenCalled()
  await fireEvent.press(screen.getByTestId('companion-open'))
  expect(await screen.findByTestId('companion-sheet')).toBeTruthy()
  expect(owner.requestCompanionExplanation).not.toHaveBeenCalled()
})

it('sends one identity-only explanation request and renders the parsed result', async () => {
  const owner = api()
  let finish!: (value: ReturnType<typeof message>) => void
  owner.requestCompanionExplanation.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  await render(companion(owner))
  await fireEvent.press(screen.getByTestId('companion-open'))
  const explain = await screen.findByTestId('companion-explain')
  await fireEvent.press(explain)
  await fireEvent.press(explain)
  expect(owner.requestCompanionExplanation).toHaveBeenCalledTimes(1)
  expect(owner.requestCompanionExplanation).toHaveBeenCalledWith(
    nativeIds.plan,
    nativeIds.action,
    'TODAY',
  )
  await act(async () => finish(message()))
  expect(await screen.findByText(message().text)).toBeTruthy()
})

it('keeps the plan visible and authoritative when the provider is unavailable', async () => {
  const owner = api()
  owner.requestCompanionExplanation.mockRejectedValueOnce(new Error('offline'))
  await render(companion(owner))
  await fireEvent.press(screen.getByTestId('companion-open'))
  await fireEvent.press(await screen.findByTestId('companion-explain'))
  expect(
    await screen.findByText(/Kế hoạch và các hoạt động của bạn vẫn giữ nguyên/),
  ).toBeTruthy()
  expect(
    screen.getAllByText(nativePlan().focuses[0]!.actions[0]!.presentation.title)
      .length,
  ).toBeGreaterThan(0)
})

it('interrupts guidance during authoritative edits and never requests AI', async () => {
  const owner = api()
  await render(companion(owner, true))
  expect(screen.getByTestId('companion-open')).toBeDisabled()
  await fireEvent.press(screen.getByTestId('companion-open'))
  expect(screen.queryByTestId('companion-sheet')).toBeNull()
  expect(owner.requestCompanionExplanation).not.toHaveBeenCalled()
})

it('keeps mute and collapse preferences in runtime memory for the same subject', async () => {
  const first = await render(companion())
  await fireEvent.press(screen.getByTestId('companion-mute'))
  await fireEvent.press(screen.getByTestId('companion-collapse'))
  await first.unmount()
  await render(companion())
  expect(screen.getByLabelText('Mở rộng Bạn đồng hành')).toBeTruthy()
  await fireEvent.press(screen.getByTestId('companion-collapse'))
  expect(screen.getByLabelText('Bật lời nhắc của Bạn đồng hành')).toBeTruthy()
})

it('uses the canonical Emotion route and preserves occurrence authority', async () => {
  await render(companion())
  await fireEvent.press(screen.getByTestId('companion-open'))
  await fireEvent.press(
    await screen.findByRole('button', { name: 'Mở Ghi nhận cảm xúc' }),
  )
  expect(mockPush).toHaveBeenCalledWith({
    pathname: '/(user)/emotion',
    params: {
      occurrenceId: nativeIds.occurrence,
      actionId: nativeIds.action,
    },
  })
})

it('keeps the actual request locked through close and clears its late success', async () => {
  const owner = api()
  const request = deferred<ReturnType<typeof message>>()
  owner.requestCompanionExplanation.mockImplementationOnce(
    () => request.promise,
  )
  await render(companion(owner))
  await fireEvent.press(screen.getByTestId('companion-open'))
  await fireEvent.press(await screen.findByTestId('companion-explain'))
  await fireEvent.press(
    screen.getByRole('button', {
      name: 'Đóng hướng dẫn Bạn đồng hành',
    }),
  )
  await fireEvent.press(screen.getByTestId('companion-open'))
  await fireEvent.press(await screen.findByTestId('companion-explain'))
  expect(owner.requestCompanionExplanation).toHaveBeenCalledTimes(1)

  await act(async () => request.resolve(message()))
  expect(screen.queryByText(message().text)).toBeNull()
  await fireEvent.press(screen.getByTestId('companion-explain'))
  expect(owner.requestCompanionExplanation).toHaveBeenCalledTimes(2)
  expect(await screen.findByText(message().text)).toBeTruthy()
})

it('keeps a pending provider call locked when deterministic next-step guidance wins', async () => {
  const owner = api()
  const request = deferred<ReturnType<typeof message>>()
  owner.requestCompanionExplanation.mockImplementationOnce(
    () => request.promise,
  )
  await render(companion(owner))
  await fireEvent.press(screen.getByTestId('companion-open'))
  await fireEvent.press(await screen.findByTestId('companion-explain'))
  await fireEvent.press(
    screen.getByRole('button', { name: 'Tôi nên bắt đầu từ đâu?' }),
  )
  expect(
    screen.getByText(/không tự hoàn thành hoặc thay đổi kế hoạch/),
  ).toBeTruthy()
  await fireEvent.press(screen.getByTestId('companion-explain'))
  expect(owner.requestCompanionExplanation).toHaveBeenCalledTimes(1)

  await act(async () => request.resolve(message()))
  expect(screen.queryByText(message().text)).toBeNull()
  expect(
    screen.getByText(/không tự hoàn thành hoặc thay đổi kế hoạch/),
  ).toBeTruthy()
})

it('invalidates a pending request during dirty or confirmation interruption and ignores a late error', async () => {
  const owner = api()
  const request = deferred<ReturnType<typeof message>>()
  owner.requestCompanionExplanation.mockImplementationOnce(
    () => request.promise,
  )
  const view = await render(companion(owner))
  await fireEvent.press(screen.getByTestId('companion-open'))
  await fireEvent.press(await screen.findByTestId('companion-explain'))

  await view.rerender(companion(owner, true))
  await waitFor(() =>
    expect(screen.queryByTestId('companion-sheet')).toBeNull(),
  )
  await act(async () => request.reject(new Error('late offline')))
  expect(screen.queryByText(/Chưa thể tải lời giải thích/)).toBeNull()

  await view.rerender(companion(owner, false))
  await fireEvent.press(screen.getByTestId('companion-open'))
  await fireEvent.press(await screen.findByTestId('companion-explain'))
  expect(owner.requestCompanionExplanation).toHaveBeenCalledTimes(2)
})

it('clears ready guidance when the action context changes', async () => {
  const owner = api()
  const view = await render(companion(owner))
  await fireEvent.press(screen.getByTestId('companion-open'))
  await fireEvent.press(await screen.findByTestId('companion-explain'))
  expect(await screen.findByText(message().text)).toBeTruthy()

  const changedPlan = nativePlan()
  changedPlan.version = 2
  const changedAction = changedPlan.focuses[0]!.actions[0]!
  changedAction.actionId = '20000000-0000-4000-8000-000000000642'
  changedAction.actionVersion = 2
  const changedOccurrence = nativeOccurrence({
    occurrenceId: '30000000-0000-4000-8000-000000000642',
    actionId: changedAction.actionId,
    actionVersion: changedAction.actionVersion,
  })
  await view.rerender(companion(owner, false, changedPlan, [changedOccurrence]))
  await waitFor(() =>
    expect(screen.queryByTestId('companion-sheet')).toBeNull(),
  )
  await fireEvent.press(screen.getByTestId('companion-open'))
  expect(screen.queryByText(message().text)).toBeNull()
})
