import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ImgHTMLAttributes } from 'react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/image', () => ({
  default: ({
    alt,
    src,
    width,
    height,
    className,
    onLoad,
    onError,
  }: ImgHTMLAttributes<HTMLImageElement>) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt={alt}
      src={src}
      width={width}
      height={height}
      className={className}
      onLoad={onLoad}
      onError={onError}
    />
  ),
}))

import CommunityMedia from './CommunityMedia'

const media = [
  {
    mediaId: '30000000-0000-4000-8000-000000000001',
    type: 'IMAGE' as const,
    url: 'https://media.example.test/first.webp',
    width: 1200,
    height: 800,
    durationSeconds: null,
    altText: 'Ảnh thứ nhất',
  },
  {
    mediaId: '30000000-0000-4000-8000-000000000002',
    type: 'IMAGE' as const,
    url: 'https://media.example.test/second.webp',
    width: 1200,
    height: 800,
    durationSeconds: null,
    altText: 'Ảnh thứ hai',
  },
]

describe('CommunityMedia', () => {
  it('renders nothing when there are no attachments', () => {
    const { container } = render(<CommunityMedia media={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('reserves a portrait image using its native metadata ratio', () => {
    render(
      <CommunityMedia media={[{ ...media[0], width: 600, height: 1000 }]} />,
    )

    const image = screen.getByAltText('Ảnh thứ nhất')
    expect(image).toHaveAttribute('width', '600')
    expect(image).toHaveAttribute('height', '1000')
    expect(image.parentElement?.style.getPropertyValue('--media-ratio')).toBe(
      '0.6',
    )
  })

  it('uses a stable fallback then learns intrinsic size when metadata is absent', () => {
    render(
      <CommunityMedia media={[{ ...media[0], width: null, height: null }]} />,
    )

    const image = screen.getByAltText('Ảnh thứ nhất')
    expect(image).toHaveAttribute('width', '1200')
    expect(image).toHaveAttribute('height', '900')
    Object.defineProperties(image, {
      naturalWidth: { value: 600 },
      naturalHeight: { value: 1000 },
    })
    fireEvent.load(image)
    expect(image.parentElement?.style.getPropertyValue('--media-ratio')).toBe(
      '0.6',
    )
  })

  it('opens an accessible viewer and moves next and back', async () => {
    const user = userEvent.setup()
    render(<CommunityMedia media={media} />)

    await user.click(
      screen.getByRole('button', { name: 'Mở nội dung đính kèm 1 trên 2' }),
    )
    expect(screen.getByText('Nội dung đính kèm 1/2')).toBeVisible()

    await user.click(screen.getByRole('button', { name: /Tiếp/ }))
    expect(screen.getByText('Nội dung đính kèm 2/2')).toBeVisible()
    expect(screen.getAllByAltText('Ảnh thứ hai')).toHaveLength(2)

    await user.click(screen.getByRole('button', { name: /Trước/ }))
    expect(screen.getByText('Nội dung đính kèm 1/2')).toBeVisible()
  })

  it('bounds the preview to four tiles while keeping all ten attachments reachable', async () => {
    const user = userEvent.setup()
    const gallery = Array.from({ length: 10 }, (_, index) => ({
      ...media[0],
      mediaId: `30000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
      url: `https://media.example.test/${index + 1}.webp`,
      altText: `Ảnh ${index + 1}`,
    }))
    render(<CommunityMedia media={gallery} />)

    expect(
      screen.getAllByRole('button', { name: /Mở nội dung đính kèm/ }),
    ).toHaveLength(4)
    expect(screen.getByText('+6')).toBeVisible()
    await user.click(
      screen.getByRole('button', { name: /Mở nội dung đính kèm 4 trên 10/ }),
    )
    const dialog = screen.getByRole('dialog')
    within(dialog).getByRole('button', { name: 'Đóng trình xem' }).focus()
    for (let index = 0; index < 6; index += 1)
      await user.keyboard('{ArrowRight}')
    expect(within(dialog).getByText('Nội dung đính kèm 10/10')).toBeVisible()
    expect(within(dialog).getByAltText('Ảnh 10')).toBeVisible()

    await user.keyboard('{ArrowRight}')
    expect(within(dialog).getByText('Nội dung đính kèm 1/10')).toBeVisible()
    await user.keyboard('{ArrowLeft}')
    expect(within(dialog).getByText('Nội dung đính kèm 10/10')).toBeVisible()
  })

  it('keeps video playback manual and does not steal arrow keys from video controls', async () => {
    const user = userEvent.setup()
    render(
      <CommunityMedia media={[{ ...media[0], type: 'VIDEO' }, media[1]]} />,
    )
    await user.click(
      screen.getByRole('button', { name: 'Mở nội dung đính kèm 1 trên 2' }),
    )

    const dialog = screen.getByRole('dialog')
    const video = within(dialog).getByLabelText('Ảnh thứ nhất')
    expect(video).toHaveAttribute('controls')
    expect(video).not.toHaveAttribute('autoplay')
    fireEvent.keyDown(video, { key: 'ArrowRight' })
    expect(within(dialog).getByText('Nội dung đính kèm 1/2')).toBeVisible()
  })

  it('offers a local retry when a viewer image cannot load', async () => {
    const user = userEvent.setup()
    render(<CommunityMedia media={[media[0]]} />)
    fireEvent.error(screen.getByAltText('Ảnh thứ nhất'))
    expect(screen.getByText('Mở để thử lại')).toBeVisible()
    await user.click(
      screen.getByRole('button', { name: 'Mở nội dung đính kèm 1 trên 1' }),
    )

    const dialog = screen.getByRole('dialog')
    fireEvent.error(within(dialog).getByAltText('Ảnh thứ nhất'))
    expect(within(dialog).getByText('Chưa tải được ảnh')).toBeVisible()
    await user.click(
      within(dialog).getByRole('button', { name: 'Thử tải lại' }),
    )
    expect(within(dialog).getByAltText('Ảnh thứ nhất')).toBeVisible()
    expect(
      within(dialog).queryByText('Chưa tải được ảnh'),
    ).not.toBeInTheDocument()
  })

  it('uses independent viewer labels and restores focus after Escape', async () => {
    const user = userEvent.setup()
    render(
      <>
        <CommunityMedia media={[media[0]]} />
        <CommunityMedia media={[media[1]]} />
      </>,
    )
    const triggers = screen.getAllByRole('button', {
      name: /Mở nội dung đính kèm/,
    })

    await user.click(triggers[0])
    const firstDialog = screen.getByRole('dialog')
    const firstLabel = firstDialog.getAttribute('aria-labelledby')
    expect(document.getElementById(firstLabel ?? '')).toHaveTextContent(
      'Nội dung đính kèm 1/1',
    )
    fireEvent(
      firstDialog,
      new Event('cancel', { bubbles: true, cancelable: true }),
    )
    await waitFor(() => expect(firstDialog).not.toHaveAttribute('open'))
    await waitFor(() => expect(triggers[0]).toHaveFocus())

    await user.click(triggers[1])
    const secondDialog = screen.getByRole('dialog')
    expect(secondDialog.getAttribute('aria-labelledby')).not.toBe(firstLabel)
    expect(
      document.getElementById(
        secondDialog.getAttribute('aria-labelledby') ?? '',
      ),
    ).toHaveTextContent('Nội dung đính kèm 1/1')
  })
})
