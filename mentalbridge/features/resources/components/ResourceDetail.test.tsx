import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ResourceBrowserError } from '../api/browser-resources'
import ResourceDetail from './ResourceDetail'

const api = vi.hoisted(() => ({
  getResourceDetail: vi.fn(),
  getResourceCatalogue: vi.fn(),
  getResourceProgress: vi.fn(),
  saveResourceProgress: vi.fn(),
}))

const youtube = vi.hoisted(() => {
  const state = { currentTime: 0 }
  const player = {
    destroy: vi.fn(),
    getCurrentTime: vi.fn(() => state.currentTime),
    playVideo: vi.fn(),
    seekTo: vi.fn(),
  }
  const Player = vi.fn(function PlayerMock(
    _element: HTMLIFrameElement,
    options: { events: { onReady: () => void } },
  ) {
    queueMicrotask(options.events.onReady)
    return player
  })
  return {
    Player,
    player,
    state,
    animationFrame: null as FrameRequestCallback | null,
  }
})

vi.mock('../api/browser-resources', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/browser-resources')>()),
  getResourceDetail: api.getResourceDetail,
  getResourceCatalogue: api.getResourceCatalogue,
}))
vi.mock('../api/browser-resource-progress', () => ({
  getResourceProgress: api.getResourceProgress,
  saveResourceProgress: api.saveResourceProgress,
}))

const resource = {
  id: '00000000-0000-4000-8000-000000000213',
  category: 'VIDEO' as const,
  locale: 'vi-VN',
  title: 'Video: Thở chánh niệm ngắn',
  summary: 'Video hướng dẫn ngắn đã được rà soát.',
  contentBody: 'Thực hành ở mức bạn thấy dễ chịu.',
  externalUrl: 'https://www.youtube.com/watch?v=wfDTp2GogaQ',
  sourceOrganization: 'NHS Every Mind Matters',
  sourceTitle: 'Mindful Breathing Exercise',
  sourceUrl:
    'https://www.nhs.uk/every-mind-matters/mental-wellbeing-tips/top-tips-to-improve-your-mental-wellbeing/',
  sourceReviewNote: 'Đã xác minh video và tác giả.',
  resourceKind: 'LEARNING' as const,
  interactionType: 'VIDEO_TRANSCRIPT' as const,
  repeatability: 'ONE_TIME' as const,
  completionMode: 'VIDEO_CONFIRMATION' as const,
  streakEligible: false,
  expectedDurationMinutes: 7,
  cooldownDays: 0,
  recommendedFrequencyPerWeek: 1,
  planTags: ['ANXIETY_SYMPTOMS'],
  structuredContent: {},
  interactionConfig: {},
  safetyNotes: [],
  sourceRetrievedAt: '2026-09-23T00:00:00Z',
  sourceContentHash: null,
  contentVersionLabel: 'test-v1',
  sourceReviewStatus: 'REVIEWED' as const,
  contentVersion: '4',
  status: 'PUBLISHED' as const,
  reviewedAt: '2026-09-23T00:00:00Z',
  effectiveAt: '2026-09-23T00:00:00Z',
  expiresAt: null,
  createdAt: '2026-09-23T00:00:00Z',
  updatedAt: '2026-09-23T00:00:00Z',
}

describe('ResourceDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    youtube.state.currentTime = 0
    youtube.animationFrame = null
    Object.defineProperty(window, 'YT', {
      configurable: true,
      value: { Player: youtube.Player },
      writable: true,
    })
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((callback: FrameRequestCallback) => {
        youtube.animationFrame = callback
        return 1
      }),
    )
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
      configurable: true,
      value: vi.fn(),
    })
    api.getResourceDetail.mockResolvedValue(resource)
    api.getResourceCatalogue.mockResolvedValue({
      items: [resource],
      hasMore: false,
    })
    api.getResourceProgress.mockResolvedValue([])
    api.saveResourceProgress.mockImplementation(
      async (_resourceId: string, localDate: string, update: object) => ({
        resourceId: resource.id,
        localDate,
        contentVersion: resource.contentVersion,
        ...update,
        completedAt: '2026-09-29T02:00:00.000Z',
        updatedAt: '2026-09-29T02:00:00.000Z',
        version: '1',
      }),
    )
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders reviewed detail, embedded video, TOC, and catalogue return', async () => {
    const user = userEvent.setup()
    render(<ResourceDetail resourceId={resource.id} fromSupportPlan={false} />)

    expect(
      await screen.findByRole('heading', { name: resource.title }),
    ).toBeVisible()
    expect(screen.getByText(resource.contentBody)).toBeVisible()
    expect(screen.getByText(resource.sourceTitle)).toBeVisible()
    expect(screen.getByText(resource.sourceReviewNote)).toBeVisible()
    const frame = screen.getByTitle(resource.title) as HTMLIFrameElement
    expect(frame).toHaveAttribute(
      'src',
      'https://www.youtube-nocookie.com/embed/wfDTp2GogaQ?cc_load_policy=0&rel=0&modestbranding=1&enablejsapi=1',
    )
    expect(
      screen.getByRole('complementary', {
        name: 'Nội dung video',
      }),
    ).toBeVisible()
    expect(screen.queryByText(/phụ đề tiếng Việt:/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/^CC$/i)).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /0:00 chọn một tư thế thoải mái/i }),
    ).toBeVisible()
    await waitFor(() => expect(youtube.Player).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(youtube.animationFrame).not.toBeNull())
    act(() => {
      youtube.state.currentTime = 50
      youtube.animationFrame?.(0)
    })
    const activeCue = screen.getByRole('button', {
      name: /0:40 hít vào nhẹ nhàng/i,
    })
    await waitFor(() =>
      expect(activeCue).toHaveAttribute('aria-current', 'true'),
    )
    const activeWords = activeCue.querySelectorAll('span > span')
    expect(activeWords[0]).toHaveStyle({ opacity: '1' })
    expect(activeWords[activeWords.length - 1]).toHaveStyle({ opacity: '0.4' })
    youtube.player.seekTo.mockClear()
    await user.click(
      screen.getByRole('button', { name: /1:04 thở ra chậm hơn/i }),
    )
    expect(youtube.player.seekTo).toHaveBeenCalledWith(64, true)
    expect(youtube.player.playVideo).toHaveBeenCalled()
    expect(screen.getByRole('complementary', { name: 'Mục lục' })).toBeVisible()
    expect(
      screen.getByRole('link', { name: /quay lại resources/i }),
    ).toHaveAttribute('href', '/resources')
  })

  it('gates video completion behind the two reflection answers', async () => {
    const user = userEvent.setup()
    render(
      <ResourceDetail
        resourceId={resource.id}
        fromSupportPlan={false}
        activityDate="2026-09-29"
      />,
    )

    await screen.findByTitle(resource.title)
    await waitFor(() => expect(youtube.Player).toHaveBeenCalled())

    await user.click(
      await screen.findByRole('button', { name: /đánh dấu đã xem xong/i }),
    )
    await user.click(screen.getByLabelText(/cố tiếp tục để hoàn thành/i))
    await user.click(screen.getByLabelText(/cố gắng làm tất cả/i))
    await user.click(screen.getByRole('button', { name: 'Hoàn tất' }))

    expect(screen.getByRole('alert')).toHaveTextContent(/xem lại phần chính/i)
    expect(api.saveResourceProgress).toHaveBeenCalledWith(
      resource.id,
      '2026-09-29',
      {
        status: 'IN_PROGRESS',
        completedActionIds: ['video-viewed'],
      },
    )

    youtube.player.seekTo.mockClear()
    await user.click(screen.getByRole('button', { name: /xem lại từ 0:40/i }))
    await waitFor(() =>
      expect(youtube.player.seekTo).toHaveBeenCalledWith(40, true),
    )

    await user.click(
      screen.getByRole('button', { name: /đánh dấu đã xem xong/i }),
    )

    await user.click(screen.getByLabelText(/dừng lại hoặc giảm cường độ/i))
    await user.click(screen.getByLabelText(/một bước nhỏ, an toàn/i))
    await user.click(screen.getByRole('button', { name: 'Hoàn tất' }))

    expect(api.saveResourceProgress).toHaveBeenLastCalledWith(
      resource.id,
      '2026-09-29',
      {
        status: 'COMPLETED',
        completedActionIds: ['video-viewed', 'video-reflected'],
      },
    )
    expect(await screen.findByText(/một bước nhỏ đã hoàn thành/i)).toBeVisible()
  })

  it('confirms the final checklist step and keeps completion after later edits', async () => {
    const checklistResource = {
      ...resource,
      category: 'JOURNALING' as const,
      title: 'Viết vài dòng dịu dàng',
      externalUrl: null,
      resourceKind: 'REFLECTION' as const,
      interactionType: 'REFLECTION' as const,
      repeatability: 'REPEATABLE' as const,
      completionMode: 'STEPS' as const,
    }
    api.getResourceDetail.mockResolvedValue(checklistResource)
    api.getResourceCatalogue.mockResolvedValue({
      items: [checklistResource],
      hasMore: false,
    })
    const user = userEvent.setup()

    render(
      <ResourceDetail
        resourceId={checklistResource.id}
        fromSupportPlan={false}
        activityDate="2026-09-29"
      />,
    )

    const settle = await screen.findByRole('checkbox', {
      name: /gọi tên cảm xúc hiện tại/i,
    })
    const write = screen.getByRole('checkbox', { name: /viết tự do/i })
    const reflect = screen.getByRole('checkbox', { name: /điều dịu dàng/i })

    await user.click(settle)
    await waitFor(() =>
      expect(api.saveResourceProgress).toHaveBeenCalledTimes(1),
    )
    await user.click(write)
    await waitFor(() =>
      expect(api.saveResourceProgress).toHaveBeenCalledTimes(2),
    )
    await user.click(reflect)

    expect(
      screen.getByRole('heading', { name: /xác nhận đã hoàn thành/i }),
    ).toBeVisible()
    expect(api.saveResourceProgress).toHaveBeenCalledTimes(2)

    await user.click(
      screen.getByRole('button', { name: 'Xác nhận hoàn thành' }),
    )
    await waitFor(() =>
      expect(api.saveResourceProgress).toHaveBeenCalledTimes(3),
    )
    expect(api.saveResourceProgress).toHaveBeenLastCalledWith(
      checklistResource.id,
      '2026-09-29',
      expect.objectContaining({
        status: 'COMPLETED',
        completedActionIds: ['settle', 'write', 'reflect'],
        practiceSessionId: expect.any(String),
        practiceStartedAt: expect.any(String),
      }),
    )

    await user.click(settle)
    await waitFor(() =>
      expect(api.saveResourceProgress).toHaveBeenCalledTimes(4),
    )
    expect(api.saveResourceProgress).toHaveBeenLastCalledWith(
      checklistResource.id,
      '2026-09-29',
      {
        status: 'COMPLETED',
        completedActionIds: ['write', 'reflect'],
      },
    )
    expect(
      screen.getByText(/kết quả hoàn thành đã được ghi nhận/i),
    ).toBeVisible()

    const firstSession = api.saveResourceProgress.mock.calls[2]?.[2] as {
      practiceSessionId: string
    }
    await user.click(
      screen.getByRole('button', {
        name: /thực hành lại và ghi một lần mới/i,
      }),
    )
    expect(settle).not.toBeChecked()
    expect(write).not.toBeChecked()
    expect(reflect).not.toBeChecked()

    await user.click(settle)
    await user.click(write)
    await user.click(reflect)
    await user.click(
      screen.getByRole('button', { name: 'Xác nhận hoàn thành' }),
    )
    await waitFor(() =>
      expect(api.saveResourceProgress).toHaveBeenCalledTimes(7),
    )
    expect(api.saveResourceProgress).toHaveBeenLastCalledWith(
      checklistResource.id,
      '2026-09-29',
      expect.objectContaining({
        status: 'COMPLETED',
        practiceSessionId: expect.not.stringMatching(
          new RegExp(`^${firstSession.practiceSessionId}$`),
        ),
      }),
    )
  })

  it('renders purpose-shaped worksheet prompts without persisting private notes', async () => {
    const worksheetResource = {
      ...resource,
      category: 'JOURNALING' as const,
      title: 'Gỡ rối từng bước',
      externalUrl: null,
      resourceKind: 'ACTION' as const,
      interactionType: 'PROBLEM_SOLVING_WORKSHEET' as const,
      repeatability: 'REPEATABLE' as const,
      completionMode: 'STEPS' as const,
      interactionConfig: {
        steps: [
          { id: 'define', label: 'Gọi tên vấn đề' },
          { id: 'next', label: 'Chọn bước nhỏ tiếp theo' },
        ],
      },
    }
    api.getResourceDetail.mockResolvedValue(worksheetResource)
    api.getResourceCatalogue.mockResolvedValue({
      items: [worksheetResource],
      hasMore: false,
    })

    render(
      <ResourceDetail
        resourceId={worksheetResource.id}
        fromSupportPlan={false}
      />,
    )

    expect(
      await screen.findByText(/nội dung bạn nhập.+không được lưu/i),
    ).toBeVisible()
    expect(
      screen.getByRole('textbox', { name: /ghi chú cho: gọi tên vấn đề/i }),
    ).toBeVisible()
    expect(
      screen.getByRole('checkbox', { name: 'Gọi tên vấn đề' }),
    ).toBeVisible()
  })

  it('renders behavioral activation planning controls', async () => {
    const activationResource = {
      ...resource,
      category: 'JOURNALING' as const,
      externalUrl: null,
      resourceKind: 'ACTION' as const,
      interactionType: 'BEHAVIORAL_ACTIVATION_PLANNER' as const,
      repeatability: 'REPEATABLE' as const,
      completionMode: 'STEPS' as const,
      interactionConfig: {
        steps: [{ id: 'choose', label: 'Chọn một hoạt động nhỏ' }],
      },
    }
    api.getResourceDetail.mockResolvedValue(activationResource)
    api.getResourceCatalogue.mockResolvedValue({
      items: [activationResource],
      hasMore: false,
    })

    render(
      <ResourceDetail
        resourceId={activationResource.id}
        fromSupportPlan={false}
      />,
    )

    expect(
      await screen.findByRole('group', { name: 'Bản nháp hoạt động' }),
    ).toBeVisible()
    expect(screen.getByLabelText('Mức năng lượng phù hợp')).toBeVisible()
    expect(screen.getByLabelText('Thời điểm dự kiến')).toBeVisible()
    expect(screen.getByRole('radio', { name: 'Đã làm' })).toBeVisible()
  })

  it('renders reviewed structured content instead of collapsing to the legacy body', async () => {
    const structuredResource = {
      ...resource,
      category: 'ARTICLE' as const,
      interactionType: 'STRUCTURED_READER' as const,
      completionMode: 'EXPLICIT' as const,
      externalUrl: null,
      structuredContent: {
        overview: 'Tổng quan đã được biên tập.',
        whenUseful: 'Khi bạn muốn hiểu rõ hơn trước khi thực hành.',
        keyIdeas: ['Ý chính thứ nhất.', 'Ý chính thứ hai.'],
        steps: ['Đọc chậm một lượt.', 'Chọn một ý phù hợp.'],
        cautions: ['Dừng lại nếu nội dung làm bạn khó chịu hơn.'],
        nextStep: 'Chọn một bước vừa sức trong kế hoạch.',
      },
    }
    api.getResourceDetail.mockResolvedValue(structuredResource)
    api.getResourceCatalogue.mockResolvedValue({
      items: [structuredResource],
      hasMore: false,
    })

    render(
      <ResourceDetail
        resourceId={structuredResource.id}
        fromSupportPlan={false}
      />,
    )

    expect(await screen.findByText('Tổng quan đã được biên tập.')).toBeVisible()
    expect(
      screen.getByText('Khi bạn muốn hiểu rõ hơn trước khi thực hành.'),
    ).toBeVisible()
    expect(screen.getByText('Ý chính thứ hai.')).toBeVisible()
    expect(screen.getByText('Chọn một ý phù hợp.')).toBeVisible()
    expect(
      screen.getByText('Dừng lại nếu nội dung làm bạn khó chịu hơn.'),
    ).toBeVisible()
    expect(
      screen.getByText(/chọn một bước vừa sức trong kế hoạch/i),
    ).toBeVisible()
    expect(screen.queryByText(resource.contentBody)).not.toBeInTheDocument()
  })

  it('highlights each timed practice cue as the session advances', async () => {
    const timedResource = {
      ...resource,
      category: 'MEDITATION' as const,
      title: 'Đi bộ nhẹ trong vài phút',
      externalUrl: null,
      resourceKind: 'PRACTICE' as const,
      interactionType: 'WALK_TIMER' as const,
      repeatability: 'REPEATABLE' as const,
      completionMode: 'TIMED' as const,
      streakEligible: true,
      expectedDurationMinutes: 1,
      cooldownDays: 0,
      recommendedFrequencyPerWeek: 4,
      planTags: [],
      structuredContent: {},
      interactionConfig: {
        durationSeconds: 6,
        steps: [
          { id: 'prepare', label: 'Chuẩn bị' },
          { id: 'walk', label: 'Đi bộ' },
          { id: 'finish', label: 'Chậm lại' },
        ],
      },
      safetyNotes: [],
      sourceRetrievedAt: '2026-09-29T00:00:00Z',
      sourceContentHash: null,
      contentVersionLabel: 'test',
      sourceReviewStatus: 'REVIEWED' as const,
    }
    api.getResourceDetail.mockResolvedValue(timedResource)
    api.getResourceCatalogue.mockResolvedValue({
      items: [timedResource],
      hasMore: false,
    })

    render(
      <ResourceDetail
        resourceId={timedResource.id}
        fromSupportPlan={false}
        activityDate="2026-09-30"
      />,
    )

    await screen.findByRole('heading', { name: timedResource.title })
    vi.useFakeTimers()
    fireEvent.click(screen.getByRole('button', { name: 'Bắt đầu 6 giây' }))

    const practice = screen
      .getByRole('heading', {
        name: 'Vận động theo nhịp vừa sức',
      })
      .closest('section') as HTMLElement
    const prepare = within(practice)
      .getByText('Chuẩn bị', { selector: 'b' })
      .closest('li')
    const walk = within(practice)
      .getByText('Đi bộ', { selector: 'b' })
      .closest('li')
    expect(prepare).toHaveAttribute('aria-current', 'step')
    expect(prepare).toHaveTextContent('2 giây')
    expect(prepare).toHaveTextContent('Đang thực hiện · còn 2 giây')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })

    expect(prepare).not.toHaveAttribute('aria-current')
    expect(walk).toHaveAttribute('aria-current', 'step')
    expect(prepare).toHaveTextContent('✓')
  })

  it('returns to Support Plan when opened from an occurrence', async () => {
    render(
      <ResourceDetail
        resourceId={resource.id}
        fromSupportPlan
        contentVersion="4"
      />,
    )

    expect(
      await screen.findByRole('link', {
        name: /quay lại kế hoạch hỗ trợ/i,
      }),
    ).toHaveAttribute('href', '/support-plan')
    expect(api.getResourceDetail).toHaveBeenCalledWith(
      resource.id,
      '4',
      expect.anything(),
    )
  })

  it('shows a bounded not-found state', async () => {
    api.getResourceDetail.mockRejectedValue(new ResourceBrowserError(404))
    render(<ResourceDetail resourceId={resource.id} fromSupportPlan={false} />)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Không tìm thấy tài nguyên',
    )
  })

  it('uses resource-focused loading and unavailable copy', async () => {
    api.getResourceDetail.mockReturnValueOnce(new Promise(() => undefined))
    const { unmount } = render(
      <ResourceDetail resourceId={resource.id} fromSupportPlan={false} />,
    )
    expect(screen.getByText('Đang chuẩn bị nội dung…')).toBeVisible()
    expect(screen.queryByText(/Content service/i)).toBeNull()
    unmount()

    api.getResourceDetail.mockRejectedValueOnce(new ResourceBrowserError(503))
    render(<ResourceDetail resourceId={resource.id} fromSupportPlan={false} />)
    expect(
      await screen.findByText('Tài nguyên này tạm thời chưa tải được'),
    ).toBeVisible()
    expect(screen.queryByText(/Content service/i)).toBeNull()
  })
})
