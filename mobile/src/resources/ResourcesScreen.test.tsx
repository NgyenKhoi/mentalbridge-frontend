import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native'
import type { ReactElement } from 'react'

import { ApiError } from '@/api/api-error'
import type { AppSession } from '@/auth/session'

import type { ResourceApi } from './resource-api'
import type {
  ResourceCatalogue,
  ResourceProgressItem,
  ResourceSummary,
} from './resource-contract'
import { ResourcesScreen } from './ResourcesScreen'

let mockSession: AppSession | null = {
  subject: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  role: 'USER',
}
const mockSignOut = jest.fn()

jest.mock('@/auth/session-context', () => ({
  useSession: () => ({ session: mockSession, signOut: mockSignOut }),
}))

const article: ResourceSummary = {
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
  title: 'Hiểu các dấu hiệu thường gặp',
  summary: 'Một bài đọc đã được rà soát.',
  externalUrl: null,
  sourceOrganization: 'MentalBridge',
  status: 'PUBLISHED',
  reviewedAt: '2026-10-01T00:00:00.000Z',
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
}
const video: ResourceSummary = {
  ...article,
  id: '22222222-2222-4222-8222-222222222222',
  category: 'VIDEO',
  interactionType: 'VIDEO_TRANSCRIPT',
  completionMode: 'VIDEO_CONFIRMATION',
  title: 'Video thở nhẹ',
}
const saved: ResourceProgressItem = {
  resourceId: article.id,
  localDate: '2026-10-07',
  contentVersion: '4',
  status: 'COMPLETED',
  completedActionIds: [],
  completedAt: '2026-10-07T01:00:00.000Z',
  updatedAt: '2026-10-07T01:00:00.000Z',
  version: '1',
}

function page(
  data: ResourceSummary[],
  overrides: Partial<ResourceCatalogue> = {},
): ResourceCatalogue {
  return { data, count: data.length, ...overrides }
}

function api(overrides: Partial<ResourceApi> = {}): ResourceApi {
  return {
    listResources: jest.fn().mockResolvedValue(page([article])),
    getResource: jest.fn(),
    listProgress: jest.fn().mockResolvedValue([saved]),
    saveProgress: jest.fn(),
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

async function renderResources(ui: ReactElement) {
  const client = queryClient()
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

const props = (resourceApi: ResourceApi, onOpenResource = jest.fn()) => ({
  api: resourceApi,
  now: () => new Date('2026-10-07T03:00:00.000Z'),
  timezone: 'Asia/Ho_Chi_Minh',
  onBack: jest.fn(),
  onOpenResource,
})

describe('mobile reviewed resource catalogue', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSession = {
      subject: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      role: 'USER',
    }
  })

  it('paginates, filters through the contract, and keeps day/filter context for detail navigation', async () => {
    const listResources = jest.fn(async (request) => {
      if (request.category === 'ARTICLE') return page([article])
      if (request.cursor) return page([video])
      return page([article], {
        nextCursor: '33333333-3333-4333-8333-333333333333',
      })
    })
    const resourceApi = api({ listResources })
    const onOpenResource = jest.fn()
    await renderResources(
      <ResourcesScreen {...props(resourceApi, onOpenResource)} />,
    )

    expect(
      await screen.findByText('Hiểu các dấu hiệu thường gặp'),
    ).toBeOnTheScreen()
    expect(screen.getByText('Đã hoàn thành')).toBeOnTheScreen()
    await fireEvent.press(
      screen.getByRole('button', { name: 'Tải thêm tài nguyên' }),
    )
    expect(await screen.findByText('Video thở nhẹ')).toBeOnTheScreen()
    expect(listResources).toHaveBeenCalledWith(
      expect.objectContaining({
        cursor: '33333333-3333-4333-8333-333333333333',
      }),
    )

    await fireEvent.press(screen.getByRole('radio', { name: 'Bài đọc' }))
    await waitFor(() =>
      expect(listResources).toHaveBeenCalledWith(
        expect.objectContaining({ category: 'ARTICLE' }),
      ),
    )
    await fireEvent.press(
      await screen.findByRole('button', {
        name: 'Mở Hiểu các dấu hiệu thường gặp',
      }),
    )
    expect(onOpenResource).toHaveBeenCalledWith(
      article.id,
      '2026-10-07',
      'ARTICLE',
    )
  })

  it('distinguishes authoritative unavailable from a genuine filtered empty state', async () => {
    const resourceApi = api({
      listResources: jest
        .fn()
        .mockResolvedValueOnce(
          page([], {
            fallback: 'unavailable',
            message: 'Tài nguyên hỗ trợ tạm thời chưa khả dụng.',
          }),
        )
        .mockResolvedValue(page([])),
    })
    await renderResources(<ResourcesScreen {...props(resourceApi)} />)

    expect(
      await screen.findByText('Tài nguyên hỗ trợ tạm thời chưa khả dụng.'),
    ).toBeOnTheScreen()
    expect(
      screen.queryByText('Chưa có tài nguyên đã rà soát phù hợp để hiển thị.'),
    ).not.toBeOnTheScreen()

    await fireEvent.press(screen.getByRole('radio', { name: 'Video' }))
    expect(
      await screen.findByText(
        'Nhóm này chưa có tài nguyên phù hợp. Hãy chọn nhóm khác.',
      ),
    ).toBeOnTheScreen()
  })

  it('keeps catalogue usable when owner progress dependency fails', async () => {
    const resourceApi = api({
      listProgress: jest.fn().mockRejectedValue(
        new ApiError({
          code: 'CONTENT_UNAVAILABLE',
          message: 'Unavailable',
          status: 503,
        }),
      ),
    })
    await renderResources(<ResourcesScreen {...props(resourceApi)} />)

    expect(
      await screen.findByText('Hiểu các dấu hiệu thường gặp'),
    ).toBeOnTheScreen()
    expect(screen.getByText(/Chưa thể tải tiến độ/)).toBeOnTheScreen()
  })

  it('does not call owner APIs or expose resources to the wrong actor', async () => {
    mockSession = {
      subject: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      role: 'SPECIALIST',
    }
    const resourceApi = api()
    await renderResources(<ResourcesScreen {...props(resourceApi)} />)

    expect(
      screen.getByText(
        'Tài khoản này không có quyền xem tài nguyên dành cho người dùng.',
      ),
    ).toBeOnTheScreen()
    expect(resourceApi.listResources).not.toHaveBeenCalled()
    expect(resourceApi.listProgress).not.toHaveBeenCalled()
  })
})
