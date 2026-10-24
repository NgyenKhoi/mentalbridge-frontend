import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native'
import * as Linking from 'expo-linking'
import { AccessibilityInfo } from 'react-native'

import { CrisisSupportWidget } from './CrisisSupportWidget'

jest.mock('expo-linking', () => ({
  openURL: jest.fn(),
}))

const openURL = jest.mocked(Linking.openURL)

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, reject, resolve }
}

beforeEach(() => {
  jest.clearAllMocks()
  openURL.mockResolvedValue(true)
  jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockResolvedValue(false)
})

afterEach(() => jest.restoreAllMocks())

it('keeps reviewed contacts bundled and makes no call before deliberate selection', async () => {
  await render(<CrisisSupportWidget />)

  expect(
    screen.getByRole('button', { name: 'Mở hỗ trợ khẩn cấp' }),
  ).toBeOnTheScreen()
  expect(openURL).not.toHaveBeenCalled()

  await fireEvent.press(
    screen.getByRole('button', { name: 'Mở hỗ trợ khẩn cấp' }),
  )

  expect(screen.getByRole('header', { name: 'Hỗ trợ khẩn cấp' })).toBeTruthy()
  expect(screen.getByText('Tổng đài khẩn cấp quốc gia')).toBeTruthy()
  expect(screen.getByText('112')).toBeTruthy()
  expect(screen.getByText('24/7')).toBeTruthy()
  expect(screen.getByText('Cấp cứu y tế')).toBeTruthy()
  expect(screen.getByText('115')).toBeTruthy()
  expect(
    screen.getByText(/MentalBridge không phải là dịch vụ cấp cứu/),
  ).toBeTruthy()
  expect(openURL).not.toHaveBeenCalled()
})

it.each([
  ['Tổng đài khẩn cấp quốc gia', '112'],
  ['Cấp cứu y tế', '115'],
])(
  'hands %s to the native phone app only after selection',
  async (name, phone) => {
    await render(<CrisisSupportWidget />)
    await fireEvent.press(
      screen.getByRole('button', { name: 'Mở hỗ trợ khẩn cấp' }),
    )

    await fireEvent.press(
      screen.getByRole('button', { name: `Gọi ${name} số ${phone}` }),
    )

    await waitFor(() => expect(openURL).toHaveBeenCalledWith(`tel:${phone}`))
    expect(openURL).toHaveBeenCalledTimes(1)
  },
)

it('keeps the selected number visible when the native phone handoff fails', async () => {
  openURL.mockRejectedValueOnce(new Error('dialer unavailable'))
  await render(<CrisisSupportWidget />)
  await fireEvent.press(
    screen.getByRole('button', { name: 'Mở hỗ trợ khẩn cấp' }),
  )
  await fireEvent.press(
    screen.getByRole('button', {
      name: 'Gọi Tổng đài khẩn cấp quốc gia số 112',
    }),
  )

  expect(
    await screen.findByText(
      /Chưa thể mở ứng dụng gọi điện.*số 112 đang hiển thị để gọi/,
    ),
  ).toBeTruthy()
  expect(screen.getByText('112')).toBeTruthy()
})

it('clears a dial error when the sheet is dismissed and reopened', async () => {
  openURL.mockRejectedValueOnce(new Error('dialer unavailable'))
  await render(<CrisisSupportWidget />)
  await fireEvent.press(
    screen.getByRole('button', { name: 'Mở hỗ trợ khẩn cấp' }),
  )
  await fireEvent.press(
    screen.getByRole('button', { name: 'Gọi Cấp cứu y tế số 115' }),
  )
  expect(await screen.findByText(/số 115 đang hiển thị/)).toBeTruthy()

  await fireEvent.press(
    screen.getByRole('button', { name: 'Đóng bảng hỗ trợ khẩn cấp' }),
  )
  await fireEvent.press(
    screen.getByRole('button', { name: 'Mở hỗ trợ khẩn cấp' }),
  )

  expect(screen.queryByText(/Chưa thể mở ứng dụng gọi điện/)).toBeNull()
  expect(openURL).toHaveBeenCalledTimes(1)
})

it('ignores a late dialer failure after the sheet is dismissed', async () => {
  const handoff = deferred<true>()
  openURL.mockReturnValueOnce(handoff.promise)
  await render(<CrisisSupportWidget />)
  await fireEvent.press(
    screen.getByRole('button', { name: 'Mở hỗ trợ khẩn cấp' }),
  )
  await fireEvent.press(
    screen.getByRole('button', {
      name: 'Gọi Tổng đài khẩn cấp quốc gia số 112',
    }),
  )
  await fireEvent.press(
    screen.getByRole('button', { name: 'Đóng bảng hỗ trợ khẩn cấp' }),
  )

  await act(async () => handoff.reject(new Error('late failure')))
  await fireEvent.press(
    screen.getByRole('button', { name: 'Mở hỗ trợ khẩn cấp' }),
  )

  expect(screen.queryByText(/Chưa thể mở ứng dụng gọi điện/)).toBeNull()
  expect(openURL).toHaveBeenCalledTimes(1)
})
