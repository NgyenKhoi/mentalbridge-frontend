import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native'
import type { ReactElement } from 'react'
import { Linking } from 'react-native'

import { ApiError } from '@/api/api-error'
import type { AppSession } from '@/auth/session'

import type { ResourceApi } from './resource-api'
import type { ResourceDetail, ResourceProgressItem } from './resource-contract'
import { ResourceDetailScreen } from './ResourceDetailScreen'

let mockSession: AppSession | null = {
  subject: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  role: 'USER',
}
const mockSignOut = jest.fn()

jest.mock('@/auth/session-context', () => ({
  useSession: () => ({ session: mockSession, signOut: mockSignOut }),
}))

function detail(overrides: Partial<ResourceDetail> = {}): ResourceDetail {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    category: 'ARTICLE',
    resourceKind: 'LEARNING',
    interactionType: 'STRUCTURED_READER',
    repeatability: 'ONE_TIME',
    completionMode: 'EXPLICIT',
    streakEligible: false,
    expectedDurationMinutes: 7,
    cooldownDays: 0,
    recommendedFrequencyPerWeek: 1,
    planTags: ['DEPRESSIVE_SYMPTOMS'],
    locale: 'vi-VN',
    title: 'Bài đọc đã duyệt',
    summary: 'Tóm tắt đã duyệt.',
    externalUrl: null,
    sourceOrganization: 'MentalBridge',
    status: 'PUBLISHED',
    reviewedAt: '2026-10-01T00:00:00.000Z',
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    contentVersion: '4',
    contentBody: 'Nội dung dự phòng.',
    sourceTitle: null,
    sourceUrl: null,
    sourceReviewNote: null,
    structuredContent: {
      overview: 'Tổng quan đã được rà soát.',
      keyIdeas: ['Một ý chính hữu ích.'],
      nextStep: 'Chọn một bước vừa sức.',
    },
    interactionConfig: {},
    safetyNotes: ['Dừng lại nếu bạn thấy không thoải mái.'],
    sourceRetrievedAt: null,
    sourceContentHash: null,
    contentVersionLabel: 'reviewed-v4',
    sourceReviewStatus: 'REVIEWED',
    effectiveAt: '2026-10-01T00:00:00.000Z',
    expiresAt: null,
    ...overrides,
  }
}

function progress(
  resource: ResourceDetail,
  overrides: Partial<ResourceProgressItem> = {},
): ResourceProgressItem {
  return {
    resourceId: resource.id,
    localDate: '2026-10-07',
    contentVersion: resource.contentVersion,
    status: 'COMPLETED',
    completedActionIds: [],
    completedAt: '2026-10-07T01:00:00.000Z',
    updatedAt: '2026-10-07T01:00:00.000Z',
    version: '1',
    ...overrides,
  }
}

function api(
  resource: ResourceDetail,
  overrides: Partial<ResourceApi> = {},
): ResourceApi {
  return {
    listResources: jest.fn(),
    getResource: jest.fn().mockResolvedValue(resource),
    listProgress: jest.fn().mockResolvedValue([]),
    saveProgress: jest.fn().mockImplementation((_id, _date, update) =>
      Promise.resolve(
        progress(resource, {
          status: update.status,
          completedActionIds: update.completedActionIds,
          completedAt:
            update.status === 'COMPLETED' ? '2026-10-07T01:00:00.000Z' : null,
        }),
      ),
    ),
    ...overrides,
  }
}

function queryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  })
}

async function renderDetail(ui: ReactElement, client = queryClient()) {
  const view = await render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  )
  return { ...view, client }
}

const screenFor = (resourceApi: ResourceApi, resourceId: string) => (
  <ResourceDetailScreen
    activityDate="2026-10-07"
    api={resourceApi}
    now={() => new Date('2026-10-07T03:00:00.000Z')}
    onBack={jest.fn()}
    resourceId={resourceId}
    timezone="Asia/Ho_Chi_Minh"
  />
)

describe('mobile reviewed resource detail and progress', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useRealTimers()
    mockSession = {
      subject: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      role: 'USER',
    }
  })

  it('renders reviewed article fields, completes it, and reloads persisted server progress', async () => {
    const resource = detail()
    const resourceApi = api(resource, {
      listProgress: jest
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValue([progress(resource)]),
    })
    const client = queryClient()
    const view = await renderDetail(screenFor(resourceApi, resource.id), client)

    expect(
      await screen.findByText('Tổng quan đã được rà soát.'),
    ).toBeOnTheScreen()
    expect(screen.getByText(/Một ý chính hữu ích/)).toBeOnTheScreen()
    expect(screen.queryByText(/reviewed-v4/)).not.toBeOnTheScreen()
    await fireEvent.press(
      screen.getByRole('button', { name: 'Đánh dấu hoàn thành' }),
    )
    await waitFor(() =>
      expect(resourceApi.saveProgress).toHaveBeenCalledWith(
        resource.id,
        '2026-10-07',
        { status: 'COMPLETED', completedActionIds: [] },
      ),
    )
    expect(await screen.findByText('Đã lưu tiến độ.')).toBeOnTheScreen()

    await view.unmount()
    await renderDetail(screenFor(resourceApi, resource.id), client)
    expect(
      await screen.findByRole('button', { name: 'Đã hoàn thành' }),
    ).toBeDisabled()
  })

  it('persists only server-provided checklist action identifiers', async () => {
    const resource = detail({
      category: 'MEDITATION',
      resourceKind: 'PRACTICE',
      interactionType: 'GROUNDING_GUIDE',
      repeatability: 'REPEATABLE',
      completionMode: 'STEPS',
      interactionConfig: {
        steps: [
          { id: 'see', label: 'Nhận biết một điều đang thấy' },
          { id: 'hear', label: 'Nhận biết một âm thanh' },
        ],
      },
    })
    const resourceApi = api(resource)
    await renderDetail(screenFor(resourceApi, resource.id))

    const complete = await screen.findByRole('button', {
      name: 'Đánh dấu hoàn thành',
    })
    expect(complete).toBeDisabled()
    await fireEvent.press(
      screen.getByRole('checkbox', {
        name: 'Nhận biết một điều đang thấy',
      }),
    )
    await waitFor(() =>
      expect(resourceApi.saveProgress).toHaveBeenCalledWith(
        resource.id,
        '2026-10-07',
        { status: 'IN_PROGRESS', completedActionIds: ['see'] },
      ),
    )
    await fireEvent.press(
      screen.getByRole('checkbox', { name: 'Nhận biết một âm thanh' }),
    )
    await waitFor(() => expect(complete).toBeEnabled())
    await fireEvent.press(complete)
    await waitFor(() =>
      expect(resourceApi.saveProgress).toHaveBeenLastCalledWith(
        resource.id,
        '2026-10-07',
        { status: 'COMPLETED', completedActionIds: ['see', 'hear'] },
      ),
    )
  })

  it('completes a timed practice only after its reviewed duration', async () => {
    jest.useFakeTimers()
    const resource = detail({
      category: 'MEDITATION',
      resourceKind: 'PRACTICE',
      interactionType: 'PROGRESSIVE_RELAXATION',
      repeatability: 'REPEATABLE',
      completionMode: 'TIMED',
      interactionConfig: {
        durationSeconds: 2,
        steps: [{ id: 'settle', label: 'Thả lỏng vai', seconds: 2 }],
      },
    })
    const resourceApi = api(resource)
    await renderDetail(screenFor(resourceApi, resource.id))

    await fireEvent.press(
      await screen.findByRole('button', { name: 'Bắt đầu thực hành' }),
    )
    expect(resourceApi.saveProgress).not.toHaveBeenCalled()
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1000)
    })
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1000)
    })
    await waitFor(() =>
      expect(resourceApi.saveProgress).toHaveBeenCalledWith(
        resource.id,
        '2026-10-07',
        { status: 'COMPLETED', completedActionIds: ['settle'] },
      ),
    )
  })

  it('requires an opened reviewed video before explicit confirmation', async () => {
    const canOpen = jest.spyOn(Linking, 'canOpenURL').mockResolvedValue(true)
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined)
    const resource = detail({
      category: 'VIDEO',
      interactionType: 'VIDEO_TRANSCRIPT',
      completionMode: 'VIDEO_CONFIRMATION',
      externalUrl: 'https://www.youtube.com/watch?v=reviewed',
    })
    const resourceApi = api(resource)
    await renderDetail(screenFor(resourceApi, resource.id))

    const confirm = await screen.findByRole('button', {
      name: 'Xác nhận đã xem nội dung',
    })
    expect(confirm).toBeDisabled()
    await fireEvent.press(
      screen.getByRole('button', { name: 'Mở video đã rà soát' }),
    )
    await waitFor(() => expect(open).toHaveBeenCalledWith(resource.externalUrl))
    expect(canOpen).toHaveBeenCalledWith(resource.externalUrl)
    expect(confirm).toBeEnabled()
    await fireEvent.press(confirm)
    await waitFor(() =>
      expect(resourceApi.saveProgress).toHaveBeenCalledWith(
        resource.id,
        '2026-10-07',
        { status: 'COMPLETED', completedActionIds: [] },
      ),
    )
  })

  it('renders archived/unavailable and progress dependency failures truthfully', async () => {
    const resource = detail()
    const unavailableApi = api(resource, {
      getResource: jest
        .fn()
        .mockRejectedValue(
          new ApiError({ code: 'NOT_FOUND', message: 'Missing', status: 404 }),
        ),
    })
    const first = await renderDetail(screenFor(unavailableApi, resource.id))
    expect(
      await screen.findByText('Tài nguyên không còn khả dụng'),
    ).toBeOnTheScreen()
    await first.unmount()

    const dependencyApi = api(resource, {
      listProgress: jest.fn().mockRejectedValue(
        new ApiError({
          code: 'CONTENT_UNAVAILABLE',
          message: 'Unavailable',
          status: 503,
        }),
      ),
    })
    await renderDetail(screenFor(dependencyApi, resource.id))
    expect(await screen.findByText(resource.title)).toBeOnTheScreen()
    expect(screen.getByText(/cập nhật đang tạm dừng/)).toBeOnTheScreen()
    expect(dependencyApi.saveProgress).not.toHaveBeenCalled()
  })
})
