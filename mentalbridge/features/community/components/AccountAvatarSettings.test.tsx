import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/api/api-error'
import AccountAvatarSettings from './AccountAvatarSettings'

const api = vi.hoisted(() => ({
  getCommunityProfile: vi.fn(),
  putCommunityProfile: vi.fn(),
}))
vi.mock('@/features/community/api/browser-community', () => api)
vi.mock('./CommunityAvatarEditor', () => ({
  default: ({ profile }: { profile: { displayName: string } }) => (
    <div>Trình sửa ảnh của {profile.displayName}</div>
  ),
}))

const profile = {
  communityProfileId: '11111111-1111-4111-8111-111111111111',
  displayName: 'Minh An',
  avatarPreset: null,
  status: 'ACTIVE',
  version: 1,
  createdAt: '2026-09-20T08:00:00Z',
  updatedAt: '2026-09-20T08:00:00Z',
}
const notFound = new ApiError({
  message: 'missing',
  code: 'COMMUNITY_PROFILE_NOT_FOUND',
  status: 404,
})

describe('AccountAvatarSettings', () => {
  beforeEach(() => {
    api.getCommunityProfile.mockReset()
    api.putCommunityProfile.mockReset()
  })

  it('opens the editor straight away when a community profile exists', async () => {
    api.getCommunityProfile.mockResolvedValue({ data: profile, etag: '"1"' })
    render(<AccountAvatarSettings displayName="Minh An" initials="MA" />)

    expect(await screen.findByText('Trình sửa ảnh của Minh An')).toBeVisible()
    expect(api.putCommunityProfile).not.toHaveBeenCalled()
  })

  it('creates the community profile on first change, then shows the editor', async () => {
    api.getCommunityProfile.mockRejectedValue(notFound)
    api.putCommunityProfile.mockResolvedValue({ data: profile, etag: '"1"' })
    const user = userEvent.setup()
    render(<AccountAvatarSettings displayName="  Minh An " initials="MA" />)

    await user.click(
      await screen.findByRole('button', { name: 'Đổi ảnh đại diện' }),
    )

    expect(api.putCommunityProfile).toHaveBeenCalledWith(
      { displayName: 'Minh An', avatarPreset: null },
      null,
    )
    expect(await screen.findByText('Trình sửa ảnh của Minh An')).toBeVisible()
  })

  it('keeps the button and says so when the profile cannot be created', async () => {
    api.getCommunityProfile.mockRejectedValue(notFound)
    api.putCommunityProfile.mockRejectedValue(new Error('down'))
    const user = userEvent.setup()
    render(<AccountAvatarSettings displayName="Minh An" initials="MA" />)

    await user.click(
      await screen.findByRole('button', { name: 'Đổi ảnh đại diện' }),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Chưa thể bắt đầu đổi ảnh',
    )
    expect(
      screen.getByRole('button', { name: 'Đổi ảnh đại diện' }),
    ).toBeEnabled()
  })

  it('offers a retry when the profile cannot be loaded', async () => {
    api.getCommunityProfile
      .mockRejectedValueOnce(new Error('down'))
      .mockResolvedValueOnce({ data: profile, etag: '"1"' })
    const user = userEvent.setup()
    render(<AccountAvatarSettings displayName="Minh An" initials="MA" />)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Chưa tải được ảnh đại diện',
    )
    await user.click(screen.getByRole('button', { name: 'Thử tải lại' }))
    await waitFor(() =>
      expect(screen.getByText('Trình sửa ảnh của Minh An')).toBeVisible(),
    )
  })
})
