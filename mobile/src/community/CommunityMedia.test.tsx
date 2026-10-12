import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native'
import type { CommunityApi } from './community-api'
import type { MediaRecord } from './community-contract'
import { fixtureDate, fixturePostId } from './community-fixtures'
import type { CommunityMediaTransport } from './community-media'
import { CommunityMediaEditor } from './CommunityMedia'

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
    uploadIntent: jest
      .fn()
      .mockResolvedValue({
        mediaId: fixturePostId,
        state: 'PENDING',
        version: 0,
      }),
    finalize: jest.fn().mockResolvedValue(record(state)),
    removeMedia: jest.fn().mockResolvedValue(undefined),
  }
  const api = methods as unknown as CommunityApi
  const transport: CommunityMediaTransport = {
    pick: jest
      .fn()
      .mockResolvedValue({
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
