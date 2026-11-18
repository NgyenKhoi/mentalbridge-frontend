import { act, render } from '@testing-library/react-native'
import { AppState, type AppStateStatus } from 'react-native'

import { useForegroundRefresh } from './use-foreground-refresh'

jest.mock('expo-router', () => ({
  useFocusEffect: (callback: () => void) =>
    jest.requireActual('react').useEffect(callback, [callback]),
}))

it('refreshes every 15 seconds while active and stops in the background or on blur', async () => {
  jest.useFakeTimers()
  const refresh = jest.fn()
  const remove = jest.fn()
  let emit: (state: AppStateStatus) => void = () => undefined
  const listener = jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((_event, handler) => {
      emit = handler
      return { remove }
    })
  function Screen() {
    useForegroundRefresh(refresh)
    return null
  }
  try {
    const screen = await render(<Screen />)
    await act(() => emit('active'))
    refresh.mockClear()
    await act(() => jest.advanceTimersByTime(15_000))
    expect(refresh).toHaveBeenCalledTimes(1)

    await act(() => emit('background'))
    await act(() => jest.advanceTimersByTime(30_000))
    expect(refresh).toHaveBeenCalledTimes(1)

    await act(() => emit('active'))
    expect(refresh).toHaveBeenCalledTimes(2)
    await screen.unmount()
    expect(remove).toHaveBeenCalledTimes(1)
    await act(() => jest.advanceTimersByTime(15_000))
    expect(refresh).toHaveBeenCalledTimes(2)
  } finally {
    listener.mockRestore()
    jest.useRealTimers()
  }
})
