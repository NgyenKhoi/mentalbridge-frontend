import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  upload: vi.fn(),
  remove: vi.fn(),
  createObjectUrl: vi.fn(() => 'blob:preview'),
  revokeObjectUrl: vi.fn(),
}))

vi.mock('@/features/community/api/browser-community', () => ({
  uploadCommunityMedia: mocks.upload,
  deleteCommunityMedia: mocks.remove,
}))

import CommunityMediaUploader from './CommunityMediaUploader'

describe('CommunityMediaUploader', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: mocks.createObjectUrl,
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: mocks.revokeObjectUrl,
    })
  })

  it('uploads a bounded file and exposes only its READY media id to the post', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    mocks.upload.mockResolvedValue({
      mediaId: '30000000-0000-4000-8000-000000000001',
      mediaType: 'IMAGE',
      state: 'READY',
      version: 1,
      createdAt: '2026-09-30T08:20:00Z',
      updatedAt: '2026-09-30T08:21:00Z',
    })
    mocks.remove.mockResolvedValue(undefined)
    render(<CommunityMediaUploader onChange={onChange} />)

    const file = new File(['safe-image'], 'story.webp', {
      type: 'image/webp',
    })
    await user.upload(screen.getByLabelText('Thêm tệp'), file)

    expect(await screen.findByText('Sẵn sàng đính kèm')).toBeInTheDocument()
    expect(mocks.upload).toHaveBeenCalledWith(file, expect.any(AbortSignal))
    await waitFor(() =>
      expect(onChange).toHaveBeenLastCalledWith({
        mediaIds: ['30000000-0000-4000-8000-000000000001'],
        busy: false,
      }),
    )

    await user.click(screen.getByRole('button', { name: 'Gỡ story.webp' }))
    expect(mocks.remove).toHaveBeenCalledWith(
      '30000000-0000-4000-8000-000000000001',
      1,
    )
    await waitFor(() =>
      expect(onChange).toHaveBeenLastCalledWith({ mediaIds: [], busy: false }),
    )
  })

  it('rejects an unsafe file before requesting an upload', async () => {
    render(<CommunityMediaUploader onChange={vi.fn()} />)

    fireEvent.change(screen.getByLabelText('Thêm tệp'), {
      target: {
        files: [new File(['svg'], 'location.svg', { type: 'image/svg+xml' })],
      },
    })

    expect(await screen.findByRole('alert')).toHaveTextContent('JPEG')
    expect(mocks.upload).not.toHaveBeenCalled()
  })
})
