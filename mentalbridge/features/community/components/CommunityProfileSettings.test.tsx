import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({
  get: vi.fn(),
  put: vi.fn(),
  avatar: vi.fn(),
  upload: vi.fn(),
}))

vi.mock('@/features/community/api/browser-community', async (original) => ({
  ...(await original<
    typeof import('@/features/community/api/browser-community')
  >()),
  getCommunityProfile: api.get,
  putCommunityProfile: api.put,
  putCommunityAvatar: api.avatar,
  uploadCommunityMedia: api.upload,
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
const image = {
  mediaId: '30000000-0000-4000-8000-000000000001',
  url: 'https://res.cloudinary.com/test/image/upload/avatar.webp',
  width: 512,
  height: 512,
}
const createUrl = vi.fn()
const revokeUrl = vi.fn()
const decodes: Array<{
  onload: (() => void) | null
  onerror: (() => void) | null
  naturalWidth: number
  naturalHeight: number
}> = []

function chooseFile(
  name = 'avatar.webp',
  type = 'image/webp',
  content = 'image',
) {
  fireEvent.change(screen.getByLabelText('Chọn tệp ảnh đại diện'), {
    target: { files: [new File([content], name, { type })] },
  })
}

describe('CommunityProfileSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    decodes.length = 0
    createUrl.mockImplementation(() => `blob:preview-${decodes.length}`)
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: createUrl,
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: revokeUrl,
    })
    vi.stubGlobal(
      'Image',
      class {
        onload: (() => void) | null = null
        onerror: (() => void) | null = null
        naturalWidth = 512
        naturalHeight = 512
        set src(_value: string) {
          decodes.push(this)
          queueMicrotask(() => this.onload?.())
        }
      },
    )
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
    api.upload.mockResolvedValue({ mediaId: image.mediaId, state: 'READY' })
    api.avatar.mockResolvedValue({
      data: { ...profile, avatarImage: image, version: 3 },
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

  it('validates an empty name inline and returns focus without a browser popup', async () => {
    const user = userEvent.setup()
    render(<CommunityProfileSettings />)
    const name = await screen.findByLabelText('Tên hiển thị hoặc biệt danh')
    await user.clear(name)
    await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('1 đến 80 ký tự')
    expect(name).toHaveAttribute('aria-invalid', 'true')
    expect(name).toHaveFocus()
    expect(api.put).not.toHaveBeenCalled()
    await user.type(name, 'Tên mới')
    expect(name).toHaveAttribute('aria-invalid', 'false')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('does not treat a failed profile read as permission to create another identity', async () => {
    const user = userEvent.setup()
    api.get.mockRejectedValueOnce(new Error('Offline'))
    render(<CommunityProfileSettings />)
    expect(
      await screen.findByRole('heading', {
        name: 'Chưa tải được danh tính cộng đồng',
      }),
    ).toBeVisible()
    expect(
      screen.queryByRole('button', { name: 'Tạo danh tính cộng đồng' }),
    ).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Thử tải lại' }))
    expect(await screen.findByDisplayValue('Mầm Xanh')).toBeVisible()
    expect(api.put).not.toHaveBeenCalled()
  })

  it('previews and cancels a photo without changing the saved profile or independent name draft', async () => {
    const user = userEvent.setup()
    render(<CommunityProfileSettings />)
    const name = await screen.findByLabelText('Tên hiển thị hoặc biệt danh')
    await user.clear(name)
    await user.type(name, 'Tên đang sửa')
    chooseFile()
    expect(await screen.findByText('avatar.webp')).toBeVisible()
    expect(
      screen.getByLabelText('Xem trước ảnh đang chọn').querySelector('img'),
    ).toHaveAttribute('src', 'blob:preview-0')
    await user.click(screen.getByRole('button', { name: 'Hủy lựa chọn' }))
    expect(name).toHaveValue('Tên đang sửa')
    expect(
      screen
        .getByLabelText('Ảnh đại diện hiện tại')
        .querySelector('.is-sprout svg'),
    ).not.toBeNull()
    expect(api.avatar).not.toHaveBeenCalled()
    expect(api.upload).not.toHaveBeenCalled()
    expect(revokeUrl).toHaveBeenCalledWith('blob:preview-0')
    expect(
      screen.getByRole('button', { name: 'Chọn ảnh từ máy' }),
    ).toHaveFocus()
  })

  it('rejects empty, unsupported and corrupt files while preserving the saved photo', async () => {
    api.get.mockResolvedValue({
      data: { ...profile, avatarImage: image },
      etag: '"2"',
    })
    render(<CommunityProfileSettings />)
    await screen.findByLabelText('Tên hiển thị hoặc biệt danh')
    chooseFile('empty.png', 'image/png', '')
    expect(screen.getByRole('alert')).toHaveTextContent('tệp không được rỗng')
    chooseFile('unsafe.svg', 'image/svg+xml')
    expect(createUrl).not.toHaveBeenCalled()
    vi.stubGlobal(
      'Image',
      class {
        onerror: (() => void) | null = null
        set src(_value: string) {
          queueMicrotask(() => this.onerror?.())
        }
      },
    )
    chooseFile('broken.png', 'image/png')
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Không đọc được ảnh',
    )
    expect(
      screen.getByLabelText('Ảnh đại diện hiện tại').querySelector('img'),
    ).toHaveAttribute('src', image.url)
    expect(api.avatar).not.toHaveBeenCalled()
    expect(api.upload).not.toHaveBeenCalled()
    expect(revokeUrl).toHaveBeenCalled()
  })

  it('keeps a dirty name across photo save and retries the ready media without re-uploading', async () => {
    const user = userEvent.setup()
    api.avatar.mockRejectedValueOnce(new Error('Lost response'))
    render(<CommunityProfileSettings />)
    const name = await screen.findByLabelText('Tên hiển thị hoặc biệt danh')
    await user.clear(name)
    await user.type(name, 'Tên đang sửa')
    chooseFile()
    await screen.findByText('avatar.webp')
    await user.click(screen.getByRole('button', { name: 'Lưu ảnh đại diện' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Lựa chọn của bạn vẫn được giữ',
    )
    expect(name).toHaveValue('Tên đang sửa')
    await user.click(screen.getByRole('button', { name: 'Lưu ảnh đại diện' }))
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        'Đã lưu ảnh đại diện',
      ),
    )
    expect(api.upload).toHaveBeenCalledTimes(1)
    expect(api.avatar).toHaveBeenCalledTimes(2)
    expect(api.avatar).toHaveBeenLastCalledWith(
      image.mediaId,
      '"2"',
      expect.any(AbortSignal),
    )
    expect(name).toHaveValue('Tên đang sửa')
    expect(
      screen.getByLabelText('Ảnh đại diện hiện tại').querySelector('img'),
    ).toHaveAttribute('src', image.url)
    await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))
    expect(api.put).toHaveBeenLastCalledWith(
      { displayName: 'Tên đang sửa', avatarPreset: 'SPROUT' },
      '"3"',
    )
  })

  it('requires explicit conflict reload, retains photo/name drafts and uses the new version to retry', async () => {
    const user = userEvent.setup()
    api.avatar.mockRejectedValueOnce(
      new ApiError({
        message: 'Stale',
        code: 'COMMUNITY_PROFILE_VERSION_MISMATCH',
        status: 412,
      }),
    )
    render(<CommunityProfileSettings />)
    const name = await screen.findByLabelText('Tên hiển thị hoặc biệt danh')
    await user.clear(name)
    await user.type(name, 'Tên của tôi')
    chooseFile()
    await screen.findByText('avatar.webp')
    await user.click(screen.getByRole('button', { name: 'Lưu ảnh đại diện' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Tải thông tin mới',
    )
    expect(api.get).toHaveBeenCalledTimes(1)
    expect(
      screen.getByRole('button', { name: 'Lưu ảnh đại diện' }),
    ).toBeDisabled()
    api.get.mockRejectedValueOnce(new Error('Offline'))
    await user.click(screen.getByRole('button', { name: 'Tải thông tin mới' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Chưa tải được thông tin mới',
    )
    expect(name).toHaveValue('Tên của tôi')
    api.get.mockResolvedValueOnce({
      data: { ...profile, displayName: 'Tên ở nơi khác', version: 4 },
      etag: '"4"',
    })
    await user.click(screen.getByRole('button', { name: 'Tải thông tin mới' }))
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Lưu ảnh đại diện' }),
      ).toBeEnabled(),
    )
    expect(name).toHaveValue('Tên của tôi')
    expect(screen.getByText('avatar.webp')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Lưu ảnh đại diện' }))
    await waitFor(() =>
      expect(api.avatar).toHaveBeenLastCalledWith(
        image.mediaId,
        '"4"',
        expect.any(AbortSignal),
      ),
    )
    expect(api.upload).toHaveBeenCalledTimes(1)
  })

  it('keeps the remove dialog and current photo on failure, then removes only the photo on retry', async () => {
    const user = userEvent.setup()
    api.get.mockResolvedValue({
      data: { ...profile, avatarImage: image },
      etag: '"2"',
    })
    api.avatar
      .mockRejectedValueOnce(new Error('Offline'))
      .mockResolvedValueOnce({
        data: { ...profile, avatarImage: null, version: 3 },
        etag: '"3"',
      })
    render(<CommunityProfileSettings />)
    await screen.findByLabelText('Tên hiển thị hoặc biệt danh')
    await user.click(screen.getByRole('button', { name: 'Gỡ ảnh tải lên' }))
    const dialog = screen.getByRole('dialog', {
      name: 'Gỡ ảnh đại diện đã tải lên?',
    })
    await user.click(within(dialog).getByRole('button', { name: 'Gỡ ảnh' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Ảnh hiện tại vẫn được giữ',
    )
    expect(dialog).toHaveAttribute('open')
    expect(
      screen.getByLabelText('Ảnh đại diện hiện tại').querySelector('img'),
    ).not.toBeNull()
    await user.click(within(dialog).getByRole('button', { name: 'Gỡ ảnh' }))
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('Đã gỡ ảnh tải lên'),
    )
    expect(api.avatar).toHaveBeenLastCalledWith(
      null,
      '"2"',
      expect.any(AbortSignal),
    )
    expect(
      screen
        .getByLabelText('Ảnh đại diện hiện tại')
        .querySelector('.is-sprout svg'),
    ).not.toBeNull()
    expect(api.put).not.toHaveBeenCalled()
    expect(api.upload).not.toHaveBeenCalled()
  })

  it('preserves name edits on their own conflict reload rather than silently resetting them', async () => {
    const user = userEvent.setup()
    api.put.mockRejectedValueOnce(
      new ApiError({
        message: 'Stale',
        code: 'COMMUNITY_PROFILE_VERSION_MISMATCH',
        status: 412,
      }),
    )
    render(<CommunityProfileSettings />)
    const name = await screen.findByLabelText('Tên hiển thị hoặc biệt danh')
    await user.clear(name)
    await user.type(name, 'Bản nháp')
    await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'các chỉnh sửa của bạn vẫn được giữ',
    )
    expect(api.get).toHaveBeenCalledTimes(1)
    api.get.mockResolvedValueOnce({
      data: { ...profile, displayName: 'Tên khác', version: 4 },
      etag: '"4"',
    })
    await user.click(screen.getByRole('button', { name: 'Tải thông tin mới' }))
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Lưu thay đổi' }),
      ).toBeEnabled(),
    )
    expect(name).toHaveValue('Bản nháp')
  })

  it('clears the photo conflict when the name region reloads the authoritative profile', async () => {
    const user = userEvent.setup()
    const conflict = new ApiError({
      message: 'Stale',
      code: 'COMMUNITY_PROFILE_VERSION_MISMATCH',
      status: 412,
    })
    api.avatar.mockRejectedValueOnce(conflict)
    api.put.mockRejectedValueOnce(conflict)
    render(<CommunityProfileSettings />)
    const name = await screen.findByLabelText('Tên hiển thị hoặc biệt danh')
    await user.clear(name)
    await user.type(name, 'Bản nháp độc lập')
    chooseFile()
    await screen.findByText('avatar.webp')
    await user.click(screen.getByRole('button', { name: 'Lưu ảnh đại diện' }))
    await screen.findByRole('alert')
    await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))
    await waitFor(() =>
      expect(
        screen.getAllByRole('button', { name: 'Tải thông tin mới' }),
      ).toHaveLength(2),
    )
    api.get.mockResolvedValueOnce({
      data: { ...profile, displayName: 'Tên ở nơi khác', version: 4 },
      etag: '"4"',
    })
    const reloads = screen.getAllByRole('button', { name: 'Tải thông tin mới' })
    await user.click(reloads[1])
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Lưu ảnh đại diện' }),
      ).toBeEnabled(),
    )
    expect(
      screen.queryByRole('button', { name: 'Tải thông tin mới' }),
    ).not.toBeInTheDocument()
    expect(name).toHaveValue('Bản nháp độc lập')
    expect(screen.getByText('avatar.webp')).toBeVisible()
    expect(api.upload).toHaveBeenCalledTimes(1)
    expect(api.get).toHaveBeenCalledTimes(2)
  })

  it('adopts remote name and preset changes when those fields were never edited locally', async () => {
    const user = userEvent.setup()
    api.avatar.mockRejectedValueOnce(
      new ApiError({
        message: 'Stale',
        code: 'COMMUNITY_PROFILE_VERSION_MISMATCH',
        status: 412,
      }),
    )
    render(<CommunityProfileSettings />)
    await screen.findByDisplayValue('Mầm Xanh')
    chooseFile()
    await screen.findByText('avatar.webp')
    await user.click(screen.getByRole('button', { name: 'Lưu ảnh đại diện' }))
    await screen.findByRole('alert')
    api.get.mockResolvedValueOnce({
      data: {
        ...profile,
        displayName: 'Tên mới ở nơi khác',
        avatarPreset: 'LEAF',
        version: 4,
      },
      etag: '"4"',
    })
    await user.click(screen.getByRole('button', { name: 'Tải thông tin mới' }))
    await waitFor(() =>
      expect(screen.getByLabelText('Tên hiển thị hoặc biệt danh')).toHaveValue(
        'Tên mới ở nơi khác',
      ),
    )
    expect(screen.getByRole('radio', { name: 'Lá xanh' })).toBeChecked()
    expect(screen.getByText('avatar.webp')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))
    expect(api.put).toHaveBeenLastCalledWith(
      { displayName: 'Tên mới ở nơi khác', avatarPreset: 'LEAF' },
      '"4"',
    )
  })

  it('blocks duplicate photo commands and name saves while pending; aborts the upload when unmounted', async () => {
    const user = userEvent.setup()
    api.upload.mockImplementationOnce(() => new Promise(() => undefined))
    const view = render(<CommunityProfileSettings />)
    await screen.findByLabelText('Tên hiển thị hoặc biệt danh')
    chooseFile()
    await screen.findByText('avatar.webp')
    await user.dblClick(
      screen.getByRole('button', { name: 'Lưu ảnh đại diện' }),
    )
    expect(api.upload).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Lưu thay đổi' })).toBeDisabled()
    const signal: AbortSignal = api.upload.mock.calls[0][1]
    expect(signal.aborted).toBe(false)
    view.unmount()
    expect(signal.aborted).toBe(true)
    expect(revokeUrl).toHaveBeenCalledWith('blob:preview-0')
    expect(api.avatar).not.toHaveBeenCalled()
  })
})
