import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Button } from 'react-native'

import { SessionProvider, useSession } from '@/auth/session-context'
import type { SessionService } from '@/auth/identity-session-service'

import { AssessmentJourneyRoute } from './AssessmentJourneyRoute'

const mockApiQueue: object[] = []
jest.mock('@/config/runtime-config-context', () => ({
  useRuntimeConfig: () => ({}),
}))
jest.mock('@/api/api-client', () => ({ createApiClient: () => ({}) }))
jest.mock('./assessment-api', () => ({
  createAssessmentApi: () => mockApiQueue.shift(),
}))
jest.mock('./combined-meaning-api', () => ({
  createCombinedMeaningApi: () => ({}),
}))
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn() },
  useFocusEffect: () => {},
}))

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

const ownerA = { subject: 'owner-a', role: 'USER' as const }
const ownerB = { subject: 'owner-b', role: 'USER' as const }
const assessment = {
  assessmentId: 'one',
  instrument: 'PHQ9',
  submittedAt: '2026-10-06T08:00:00Z',
  result: { screeningLevel: 'MILD' },
}
const history = { items: [assessment], nextCursor: null, hasMore: false }
const emptyHistory = { items: [], nextCursor: null, hasMore: false }

function api(listAssessments: Promise<unknown>) {
  return {
    getCurrentEpisode: jest.fn().mockResolvedValue(null),
    listAssessments: jest.fn().mockReturnValue(listAssessments),
    listSupportGuides: jest.fn().mockResolvedValue(emptyHistory),
    getGuidedJourney: jest.fn().mockResolvedValue(null),
  }
}

function Controls() {
  const { signIn, signOut } = useSession()
  return (
    <>
      <Button title="Switch B" onPress={() => void signIn('b', 'test')} />
      <Button title="Login A" onPress={() => void signIn('a', 'test')} />
      <Button title="Logout" onPress={() => void signOut()} />
      <AssessmentJourneyRoute />
    </>
  )
}

function setup(
  logout: () => Promise<void>,
  refresh?: () => Promise<{ session: typeof ownerA; accessExpiresAt: string }>,
) {
  const service = {
    logout,
    signIn: jest.fn(async (email: string) => ({
      session: { ...(email === 'a' ? ownerA : ownerB) },
      accessExpiresAt: new Date(
        Date.now() + (refresh ? 60_100 : 3600_000),
      ).toISOString(),
    })),
    refresh,
  } as unknown as SessionService
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <SessionProvider service={service} initialSession={ownerA}>
        <Controls />
      </SessionProvider>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  mockApiQueue.length = 0
})

it('discards owner A pending result after switching to B and shows B data', async () => {
  const old = deferred<unknown>()
  mockApiQueue.push(api(old.promise), api(Promise.resolve(emptyHistory)))
  await setup(async () => {})
  await waitFor(() => expect(mockApiQueue).toHaveLength(1))
  await fireEvent.press(screen.getByRole('button', { name: 'Switch B' }))
  expect(
    await screen.findByText('Bạn chưa có kết quả sàng lọc đã lưu.'),
  ).toBeOnTheScreen()
  await act(async () => {
    old.resolve(history)
    await old.promise
  })
  expect(screen.queryByText('PHQ-9 · Nhẹ')).toBeNull()
  expect(
    screen.getByText('Bạn chưa có kết quả sàng lọc đã lưu.'),
  ).toBeOnTheScreen()
})

it('documents that logout start leaves the old request visible until logout completes', async () => {
  const old = deferred<unknown>()
  const logout = deferred<void>()
  mockApiQueue.push(api(old.promise))
  await setup(() => logout.promise)
  await waitFor(() => expect(mockApiQueue).toHaveLength(0))
  await fireEvent.press(screen.getByRole('button', { name: 'Logout' }))
  await act(async () => {
    old.resolve(history)
    await old.promise
  })
  expect(await screen.findByText('PHQ-9 · Nhẹ')).toBeOnTheScreen()
  await act(async () => {
    logout.resolve()
    await logout.promise
  })
  await waitFor(() => expect(screen.queryByText('PHQ-9 · Nhẹ')).toBeNull())
})

it('discards a previous login result when the same owner logs in again', async () => {
  const old = deferred<unknown>()
  mockApiQueue.push(api(old.promise), api(Promise.resolve(emptyHistory)))
  await setup(async () => {})
  await waitFor(() => expect(mockApiQueue).toHaveLength(1))
  await fireEvent.press(screen.getByRole('button', { name: 'Logout' }))
  await fireEvent.press(screen.getByRole('button', { name: 'Login A' }))
  expect(
    await screen.findByText('Bạn chưa có kết quả sàng lọc đã lưu.'),
  ).toBeOnTheScreen()
  await act(async () => {
    old.resolve(history)
    await old.promise
  })
  expect(screen.queryByText('PHQ-9 · Nhẹ')).toBeNull()
})

it('documents that direct same-owner replacement cannot be distinguished from refresh', async () => {
  const old = deferred<unknown>()
  mockApiQueue.push(api(old.promise))
  await setup(async () => {})
  await waitFor(() => expect(mockApiQueue).toHaveLength(0))
  await fireEvent.press(screen.getByRole('button', { name: 'Login A' }))
  await act(async () => {
    old.resolve(history)
    await old.promise
  })
  expect(await screen.findByText('PHQ-9 · Nhẹ')).toBeOnTheScreen()
})

it.each(['PHQ9', 'GAD7'] as const)(
  'keeps %s answers during the provider refresh',
  async (instrument) => {
    const episode = {
      episodeId: 'episode',
      purpose: 'INITIAL_CHECK',
      status: 'IN_PROGRESS',
      phq9AssessmentId: instrument === 'GAD7' ? 'phq' : null,
      gad7AssessmentId: null,
    }
    const questionnaire = {
      instrument,
      title: `Bài ${instrument}`,
      referencePeriodDays: 14,
      questions: [
        { questionId: 'q1', itemNumber: 1, prompt: 'Câu hỏi một' },
        { questionId: 'q2', itemNumber: 2, prompt: 'Câu hỏi hai' },
      ],
      responseOptions: [{ value: 1, label: 'Vài ngày' }],
    }
    const assessmentApi = {
      ...api(Promise.resolve(emptyHistory)),
      getCurrentEpisode: jest.fn().mockResolvedValue(episode),
      getQuestionnaire: jest.fn().mockResolvedValue(questionnaire),
      getPrivacyDisclosure: jest.fn().mockResolvedValue({ version: 'v1' }),
      getConsents: jest.fn().mockResolvedValue({ decisions: [] }),
      startEpisode: jest.fn(),
      ensureEpisodeSupportGuide: jest.fn(),
      grantPrivacyConsent: jest.fn().mockResolvedValue(undefined),
      submitEpisodeAssessment: jest
        .fn()
        .mockRejectedValue(new Error('offline')),
    }
    const refresh = jest.fn().mockResolvedValue({
      session: { ...ownerA },
      accessExpiresAt: new Date(Date.now() + 3600_000).toISOString(),
    })
    mockApiQueue.push(assessmentApi)
    await setup(async () => {}, refresh)
    await fireEvent.press(
      await screen.findByRole('button', {
        name: /Bắt đầu sàng lọc|Tiếp tục sàng lọc|Xem lại kết quả sàng lọc/,
      }),
    )
    await fireEvent.press(
      await screen.findByRole('radio', { name: 'Vài ngày' }),
    )
    await fireEvent.press(screen.getByRole('button', { name: 'Câu tiếp theo' }))
    expect(screen.getByText('Câu hỏi hai')).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('radio', { name: 'Vài ngày' }))
    await fireEvent.press(
      screen.getByRole('checkbox', { name: 'Đồng ý xử lý dữ liệu sàng lọc' }),
    )
    await fireEvent.press(
      screen.getByRole('button', { name: 'Hoàn tất bài này' }),
    )
    await waitFor(() =>
      expect(assessmentApi.submitEpisodeAssessment).toHaveBeenCalledTimes(1),
    )
    await fireEvent.press(screen.getByRole('button', { name: 'Login A' }))
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1))
    expect(screen.getByText('Câu hỏi hai')).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('button', { name: 'Câu trước' }))
    expect(
      screen.getByRole('radio', { name: 'Vài ngày', checked: true }),
    ).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('button', { name: 'Câu tiếp theo' }))
    await fireEvent.press(
      screen.getByRole('button', { name: 'Hoàn tất bài này' }),
    )
    await waitFor(() =>
      expect(assessmentApi.submitEpisodeAssessment).toHaveBeenCalledTimes(2),
    )
    expect(assessmentApi.submitEpisodeAssessment.mock.calls[0]?.[3]).toEqual(
      assessmentApi.submitEpisodeAssessment.mock.calls[1]?.[3],
    )
    expect(assessmentApi.grantPrivacyConsent.mock.calls[0]?.[1]).toEqual(
      assessmentApi.grantPrivacyConsent.mock.calls[1]?.[1],
    )
    expect(assessmentApi.startEpisode).not.toHaveBeenCalled()
    expect(assessmentApi.ensureEpisodeSupportGuide).not.toHaveBeenCalled()
  },
)

it('does not render an old response after unmount', async () => {
  const old = deferred<unknown>()
  mockApiQueue.push(api(old.promise))
  const view = await setup(async () => {})
  await waitFor(() => expect(mockApiQueue).toHaveLength(0))
  await view.unmount()
  await act(async () => {
    old.resolve(history)
    await old.promise
  })
  expect(screen.queryByText('PHQ-9 · Nhẹ')).toBeNull()
})
