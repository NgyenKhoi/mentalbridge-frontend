import { StyleSheet } from 'react-native'
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native'
import type { CommunityApi } from './community-api'
import type { CommunityMedia, MediaRecord } from './community-contract'
import { fixtureDate, fixturePostId } from './community-fixtures'
import type { CommunityMediaTransport } from './community-media'
import {
  CommunityMediaEditor,
  CommunityMediaPreview,
  CommunityMediaView,
} from './CommunityMedia'

jest.mock('expo-video', () => ({
  useVideoPlayer: jest.fn(),
  VideoView: 'VideoView',
}))
const record = (state: MediaRecord['state']): MediaRecord => ({
  mediaId: fixturePostId,
  mediaType: 'IMAGE',
  state,
  version: state === 'READY' ? 2 : 1,
  createdAt: fixtureDate,
  updatedAt: fixtureDate,
})
function setup(state: MediaRecord['state']) {
  const methods = {
    uploadIntent: jest.fn().mockResolvedValue({
      mediaId: fixturePostId,
      state: 'PENDING',
      version: 0,
    }),
    finalize: jest.fn().mockResolvedValue(record(state)),
    removeMedia: jest.fn().mockResolvedValue(undefined),
  }
  const api = methods as unknown as CommunityApi
  const transport: CommunityMediaTransport = {
    pick: jest.fn().mockResolvedValue({
      uri: 'file:///selected.jpg',
      request: {
        fileName: 'selected.jpg',
        mediaType: 'IMAGE',
        mimeType: 'image/jpeg',
        sizeBytes: 25,
      },
    }),
    upload: jest.fn().mockResolvedValue(undefined),
  }
  return { methods, api, transport, onChange: jest.fn() }
}
describe('READY-only native Community attachments', () => {
  it('attaches only after signed upload and authoritative READY finalization', async () => {
    const props = setup('READY')
    await render(
      <CommunityMediaEditor {...props} initialMedia={[]} disabled={false} />,
    )
    await fireEvent.press(
      screen.getByRole('button', { name: 'Chọn ảnh hoặc video' }),
    )
    expect(await screen.findByText('Tệp sẵn sàng để đăng')).toBeOnTheScreen()
    await waitFor(() =>
      expect(props.onChange).toHaveBeenLastCalledWith([fixturePostId], false),
    )
    expect(props.transport.upload).toHaveBeenCalledWith(
      expect.objectContaining({ uri: 'file:///selected.jpg' }),
      expect.objectContaining({ mediaId: fixturePostId }),
      expect.any(AbortSignal),
    )
    expect(props.methods.finalize).toHaveBeenCalledWith(fixturePostId)
    await fireEvent.press(screen.getByRole('button', { name: 'Gỡ tệp mới' }))
    await waitFor(() =>
      expect(props.methods.removeMedia).toHaveBeenCalledWith(fixturePostId, 2),
    )
    await waitFor(() =>
      expect(props.onChange).toHaveBeenLastCalledWith([], false),
    )
  })
  it.each(['PROCESSING', 'REJECTED', 'PENDING', 'EXPIRED', 'DELETED'] as const)(
    'never attaches %s or enables publish with an unresolved file',
    async (state) => {
      const props = setup(state)
      await render(
        <CommunityMediaEditor {...props} initialMedia={[]} disabled={false} />,
      )
      await fireEvent.press(
        screen.getByRole('button', { name: 'Chọn ảnh hoặc video' }),
      )
      await screen.findByText('Tệp chưa sẵn sàng')
      expect(props.onChange).toHaveBeenLastCalledWith([], true)
      props.methods.finalize.mockResolvedValue(record('READY'))
      await fireEvent.press(
        screen.getByRole('button', { name: 'Kiểm tra tệp' }),
      )
      await waitFor(() =>
        expect(props.onChange).toHaveBeenLastCalledWith([fixturePostId], false),
      )
    },
  )
  it('keeps failed cleanup visible and does not silently discard authoritative media', async () => {
    const props = setup('READY')
    props.methods.removeMedia.mockRejectedValue(new Error('unavailable'))
    await render(
      <CommunityMediaEditor {...props} initialMedia={[]} disabled={false} />,
    )
    await fireEvent.press(
      screen.getByRole('button', { name: 'Chọn ảnh hoặc video' }),
    )
    await screen.findByText('Tệp sẵn sàng để đăng')
    await fireEvent.press(screen.getByRole('button', { name: 'Gỡ tệp mới' }))
    expect(
      await screen.findByText(/Chưa thể gỡ tệp khỏi máy chủ/),
    ).toBeOnTheScreen()
    expect(screen.getByText('Tệp sẵn sàng để đăng')).toBeOnTheScreen()
  })
})

const image = (id: number): CommunityMedia => ({
  mediaId: String(id),
  type: 'IMAGE',
  url: `https://cdn.example.test/${id}.jpg`,
  width: null,
  height: null,
  durationSeconds: null,
  altText: null,
})
describe('Community media view', () => {
  it('turns a failed image into a retry tile and tries again on request', async () => {
    await render(<CommunityMediaView media={[image(1)]} />)
    await fireEvent(screen.getByLabelText('Ảnh được chia sẻ'), 'error')
    expect(screen.getByText('Chưa tải được ảnh')).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('button', { name: 'Thử tải lại' }))
    expect(screen.queryByText('Chưa tải được ảnh')).not.toBeOnTheScreen()
    expect(screen.getByLabelText('Ảnh được chia sẻ')).toBeOnTheScreen()
  })
  it('shows three tiles with a +n tile that opens every item', async () => {
    await render(
      <CommunityMediaView media={[1, 2, 3, 4, 5].map((id) => image(id))} />,
    )
    expect(screen.getAllByLabelText('Ảnh được chia sẻ')).toHaveLength(3)
    expect(screen.getByText('+2')).toBeOnTheScreen()
    await fireEvent.press(
      screen.getByRole('button', { name: 'Xem thêm 2 ảnh và video' }),
    )
    expect(screen.getAllByLabelText('Ảnh được chia sẻ')).toHaveLength(5)
  })
  it('previews only the first item in the feed and counts the rest', async () => {
    await render(<CommunityMediaPreview media={[image(1), image(2)]} />)
    expect(screen.getAllByLabelText('Ảnh được chia sẻ')).toHaveLength(1)
    expect(screen.getByText('+1')).toBeOnTheScreen()
  })
  it('previews a video in a 16:9 box and an image in the 16:10 box', async () => {
    const video: CommunityMedia = { ...image(1), type: 'VIDEO' }
    const ratio = (testID: string) => {
      let node = screen.getByTestId(testID, {
        includeHiddenElements: true,
      }).parent
      while (node && !StyleSheet.flatten(node.props.style)?.aspectRatio)
        node = node.parent
      return StyleSheet.flatten(node?.props.style).aspectRatio
    }
    const view = await render(<CommunityMediaPreview media={[video]} />)
    expect(ratio('icon-play-circle-outline')).toBeCloseTo(16 / 9)
    await view.rerender(<CommunityMediaPreview media={[image(1)]} />)
    expect(
      StyleSheet.flatten(
        screen.getByLabelText('Ảnh được chia sẻ').parent?.props.style,
      ).aspectRatio,
    ).toBeCloseTo(16 / 10)
  })
  it('squares the corners only when the media runs edge to edge', async () => {
    const radius = () =>
      StyleSheet.flatten(
        screen.getByLabelText('Ảnh được chia sẻ').parent?.props.style,
      ).borderRadius
    const view = await render(<CommunityMediaPreview media={[image(1)]} />)
    expect(radius()).toBe(12)
    await view.rerender(<CommunityMediaPreview flush media={[image(1)]} />)
    expect(radius()).toBe(0)
    await view.rerender(<CommunityMediaView flush media={[image(1)]} />)
    expect(radius()).toBe(0)
  })
  it('lists an attached file with a remove control in the editor', async () => {
    const props = setup('READY')
    await render(
      <CommunityMediaEditor
        {...props}
        initialMedia={[image(1)]}
        disabled={false}
      />,
    )
    expect(screen.getByText('Tệp đã đính kèm')).toBeOnTheScreen()
    await fireEvent.press(
      screen.getByRole('button', { name: 'Gỡ tệp đã đính kèm' }),
    )
    await waitFor(() =>
      expect(props.onChange).toHaveBeenLastCalledWith([], false),
    )
  })
})
