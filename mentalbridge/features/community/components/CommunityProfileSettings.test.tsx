import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({
  get: vi.fn(),
  put: vi.fn(),
}))

vi.mock('@/features/community/api/browser-community', async (original) => ({
  ...(await original<
    typeof import('@/features/community/api/browser-community')
  >()),
  getCommunityProfile: api.get,
  putCommunityProfile: api.put,
}))

import { ApiError } from '@/lib/api/api-error'
import CommunityProfileSettings from './CommunityProfileSettings'

const profile = {
  communityProfileId: '10000000-0000-4000-8000-000000000002',
  displayName: 'Mầm Xanh',
  avatarPreset: 'SPROUT' as const,
  status: 'ACTIVE' as const,
  version: 2,
  createdAt: '2026-09-29T05:00:00Z',
  updatedAt: '2026-09-29T05:10:00Z',
}

describe('CommunityProfileSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.get.mockResolvedValue({ data: profile, etag: '"2"' })
    api.put.mockResolvedValue({
      data: {
        ...profile,
        displayName: 'Lá Nhỏ',
        avatarPreset: 'LEAF',
        version: 3,
      },
      etag: '"3"',
    })
  })

  it('explains privacy and saves the independent display identity with its ETag', async () => {
    const user = userEvent.setup()
    render(<CommunityProfileSettings />)

    expect(await screen.findByDisplayValue('Mầm Xanh')).toBeVisible()
    expect(screen.getByText(/độc lập với hồ sơ tài khoản/)).toBeVisible()
    expect(
      screen.getByText(/không hiển thị email hay mã tài khoản/),
    ).toBeVisible()

    const name = screen.getByLabelText('Tên hiển thị hoặc biệt danh')
    await user.clear(name)
    await user.type(name, 'Lá Nhỏ')
    await user.click(screen.getByText('Lá xanh'))
    await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))

    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith(
        { displayName: 'Lá Nhỏ', avatarPreset: 'LEAF' },
        '"2"',
      ),
    )
  })

  it('creates a profile without accepting an account identity from the browser', async () => {
    const user = userEvent.setup()
    api.get.mockRejectedValue(
      new ApiError({
        message: 'Not found',
        code: 'COMMUNITY_PROFILE_NOT_FOUND',
        status: 404,
      }),
    )
    api.put.mockResolvedValue({ data: { ...profile, version: 0 }, etag: '"0"' })
    render(<CommunityProfileSettings />)

    const name = await screen.findByLabelText('Tên hiển thị hoặc biệt danh')
    await user.type(name, 'Mầm Xanh')
    await user.click(
      screen.getByRole('button', { name: 'Tạo danh tính cộng đồng' }),
    )

    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith(
        { displayName: 'Mầm Xanh', avatarPreset: null },
        null,
      ),
    )
    expect(JSON.stringify(api.put.mock.calls[0])).not.toContain('account')
  })
})
