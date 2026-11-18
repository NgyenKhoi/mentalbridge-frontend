import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { AppState, type AppStateStatus } from 'react-native'
import type { CommunityApi } from './community-api'
import { fixtureSummary } from './community-fixtures'
import {
  CommunityReelsViewer,
  type CommunityReel,
} from './CommunityReelsViewer'

const mockPlayers: { play: jest.Mock; pause: jest.Mock }[] = []
jest.mock('expo-router', () => ({
  useFocusEffect: (callback: () => void) =>
    jest.requireActual('react').useEffect(callback, [callback]),
}))
jest.mock('expo', () => ({
  useEvent: (_player: unknown, _event: string, initial: unknown) => initial,
}))
jest.mock('expo-video', () => ({
  VideoView: 'VideoView',
  useVideoPlayer: (_source: unknown, setup: (player: unknown) => void) =>
    jest.requireActual('react').useState(() => {
      const player = {
        play: jest.fn(),
        pause: jest.fn(),
        status: 'readyToPlay',
        duration: 30,
        currentTime: 0,
        replaceAsync: jest.fn().mockResolvedValue(undefined),
      }
      setup(player)
      mockPlayers.push(player)
      return player
    })[0],
}))

const item = (id: string): CommunityReel => ({
  id,
  post: fixtureSummary,
  media: {
    mediaId: id,
    type: 'VIDEO',
    url: 'https://media.example.test/community.mp4',
    width: 1080,
    height: 1920,
    durationSeconds: 30,
    altText: null,
  },
})

it('pauses the previous reel on swipe, on background and when closing the viewer', async () => {
  mockPlayers.length = 0
  const listeners: ((state: AppStateStatus) => void)[] = []
  const appState = jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((_name, callback) => {
      listeners.push(callback)
      return { remove: jest.fn() }
    })
  const items = [item('first'), item('second')]
  const onClose = jest.fn()
  try {
    const view = await render(
      <CommunityReelsViewer
        items={items}
        initialId="first"
        api={{} as CommunityApi}
        onClose={onClose}
        onOpenPost={jest.fn()}
      />,
    )
    await fireEvent(screen.getByTestId('community-reels'), 'layout', {
      nativeEvent: { layout: { width: 400, height: 800 } },
    })
    await act(() => listeners.forEach((listener) => listener('active')))
    const first = mockPlayers[0]!
    expect(first.play).toHaveBeenCalled()
    first.pause.mockClear()
    await act(() => listeners.forEach((listener) => listener('background')))
    expect(first.pause).toHaveBeenCalled()
    await act(() => listeners.forEach((listener) => listener('active')))
    first.pause.mockClear()
    await fireEvent(
      screen.getByTestId('community-reels-list'),
      'momentumScrollEnd',
      {
        nativeEvent: { contentOffset: { y: 800 } },
      },
    )
    expect(first.pause).toHaveBeenCalled()
    await fireEvent.press(screen.getByRole('button', { name: 'Đóng Reels' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    await view.unmount()
    expect(
      mockPlayers.every((player) => player.pause.mock.calls.length > 0),
    ).toBe(true)
  } finally {
    appState.mockRestore()
  }
})
