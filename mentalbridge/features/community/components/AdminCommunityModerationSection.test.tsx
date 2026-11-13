import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminCommunityModerationSection from './AdminCommunityModerationSection'

const mockSummary = {
  totalPosts: 3,
  activePosts: 3,
  hiddenPosts: 0,
  removedPosts: 0,
  sensitivePosts: 0,
  totalComments: 5,
  totalReactions: 12,
  openCases: 0,
  aiSafetyScore: '99.4%',
  safetyStatus: 'An toàn tuyệt đối',
}

const mockPosts = [
  {
    id: '30db3d3e-fa1b-4e1e-907c-581e2272c7cd',
    content: 'For when the thoughts won’t stop #anxiety #MentalHealth',
    state: 'ACTIVE' as const,
    sensitive_content_warning: null,
    comment_count: 2,
    reaction_count: 5,
    published_at: '2026-11-06T16:48:59Z',
    updated_at: '2026-11-06T16:48:59Z',
    author_mode: 'AUTHENTICATED',
    author_profile_id: 'prof-user-01',
    author_display_name: 'Khôi',
    avatar_preset: null,
    author_status: 'ACTIVE',
    media_list: [
      {
        id: 'media-vid-01',
        url: 'https://res.cloudinary.com/test/video/authenticated/sample.mp4',
        type: 'VIDEO',
        state: 'READY',
        altText: 'Video tâm sự',
      },
    ],
    topic_list: ['EXPERIENCE_SHARING'],
  },
  {
    id: '4b1f3af2-1f09-47a0-97de-d53af155249b',
    content: 'Bức tranh bình yên tự vẽ chiều nay',
    state: 'ACTIVE' as const,
    sensitive_content_warning: null,
    comment_count: 0,
    reaction_count: 3,
    published_at: '2026-11-07T10:00:00Z',
    updated_at: '2026-11-07T10:00:00Z',
    author_mode: 'ANONYMOUS',
    author_profile_id: 'prof-user-02',
    author_display_name: 'Ngọc Quyên',
    avatar_preset: null,
    author_status: 'ACTIVE',
    media_list: [
      {
        id: 'media-img-01',
        url: 'https://res.cloudinary.com/test/image/authenticated/art.jpg',
        type: 'IMAGE',
        state: 'READY',
        altText: 'Ảnh vẽ',
      },
    ],
    topic_list: ['MY_STORY'],
  },
]

describe('AdminCommunityModerationSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Mock global fetch
    global.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url === '/api/admin/community/moderation') {
        if (!init || init.method === 'GET' || !init.method) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                success: true,
                summary: mockSummary,
                posts: mockPosts,
                comments: [],
                cases: [],
              }),
          })
        }

        // POST action
        const body = JSON.parse(init.body as string)
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              message: `Thao tác ${body.action} thành công.`,
            }),
        })
      }

      return Promise.reject(new Error(`Unhandled request: ${url}`))
    }) as any
  })

  it('renders the compact list view of posts with media badges and author info', async () => {
    render(<AdminCommunityModerationSection />)

    // Check table headers
    expect(await screen.findByText('TÁC GIẢ')).toBeInTheDocument()
    expect(screen.getByText('NỘI DUNG & ĐÍNH KÈM')).toBeInTheDocument()
    expect(screen.getByText('QUYỀN QUẢN TRỊ')).toBeInTheDocument()

    // Check post rows
    expect(screen.getByText('Khôi')).toBeInTheDocument()
    expect(screen.getByText(/For when the thoughts won’t stop/i)).toBeInTheDocument()
    expect(screen.getByText(/Video \(1\)/i)).toBeInTheDocument()

    expect(screen.getByText('Ngọc Quyên')).toBeInTheDocument()
    expect(screen.getByText(/Bức tranh bình yên tự vẽ/i)).toBeInTheDocument()
    expect(screen.getByText(/Ảnh \(1\)/i)).toBeInTheDocument()
  })

  it('opens the detail modal when clicking a post and renders video player and admin buttons', async () => {
    render(<AdminCommunityModerationSection />)

    // Wait for posts to load
    await screen.findByText('Khôi')

    // Click "Chi tiết" button on the video post
    const detailButtons = screen.getAllByRole('button', { name: /Chi tiết/i })
    fireEvent.click(detailButtons[0])

    // Verify modal opened
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toBeInTheDocument()
    expect(
      within(dialog).getByText(/Chi tiết bài viết & Bảng điều phối kiểm duyệt/i),
    ).toBeInTheDocument()
    expect(within(dialog).getByText(/Mã bài viết:/i)).toBeInTheDocument()

    // Verify video player rendered for video media
    const video = dialog.querySelector('video')
    expect(video).toBeInTheDocument()
    expect(video).toHaveAttribute(
      'src',
      'https://res.cloudinary.com/test/video/authenticated/sample.mp4',
    )

    // Verify Admin buttons in modal
    expect(
      within(dialog).getByRole('button', { name: /Gắn cảnh báo nhạy cảm/i }),
    ).toBeInTheDocument()
    expect(
      within(dialog).getByRole('button', { name: /Tạm ẩn bài viết/i }),
    ).toBeInTheDocument()
    expect(
      within(dialog).getByRole('button', { name: /Gỡ bài viết vi phạm/i }),
    ).toBeInTheDocument()
    expect(
      within(dialog).getByRole('button', { name: /Báo cáo \/ Gắn cờ/i }),
    ).toBeInTheDocument()

    // Click "Đóng" button to close modal
    const closeBtn = within(dialog).getByRole('button', { name: /^Đóng$/i })
    fireEvent.click(closeBtn)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('executes admin moderation actions from modal with live state updates', async () => {
    render(<AdminCommunityModerationSection />)

    await screen.findByText('Khôi')

    // Open modal
    const detailButtons = screen.getAllByRole('button', { name: /Chi tiết/i })
    fireEvent.click(detailButtons[0])

    const dialog = await screen.findByRole('dialog')

    // Click "Tạm ẩn bài viết" inside modal
    const hideBtn = within(dialog).getByRole('button', { name: /Tạm ẩn bài viết/i })
    fireEvent.click(hideBtn)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/admin/community/moderation',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            action: 'UPDATE_POST_STATE',
            postId: '30db3d3e-fa1b-4e1e-907c-581e2272c7cd',
            state: 'HIDDEN',
          }),
        }),
      )
    })

    // Now button text inside modal should update to "Hiển thị lại bài"
    expect(
      await within(dialog).findByRole('button', { name: /Hiển thị lại bài/i }),
    ).toBeInTheDocument()
  })

  it('allows toggling between list view and card view', async () => {
    render(<AdminCommunityModerationSection />)

    await screen.findByText('TÁC GIẢ')

    // Switch to Card view
    const cardViewBtn = screen.getByRole('button', { name: /Thẻ/i })
    fireEvent.click(cardViewBtn)

    // In card view, table is not rendered
    expect(screen.queryByText('TÁC GIẢ')).not.toBeInTheDocument()
    expect(screen.getByText(/For when the thoughts won’t stop/i)).toBeInTheDocument()

    // Switch back to List view
    const listViewBtn = screen.getByRole('button', { name: /Danh sách/i })
    fireEvent.click(listViewBtn)

    expect(await screen.findByText('TÁC GIẢ')).toBeInTheDocument()
  })
})
