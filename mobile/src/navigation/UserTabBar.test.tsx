import { fireEvent, render, screen } from '@testing-library/react-native'

import { isUserTabPath, UserTabBar } from './UserTabBar'

const mockReplace = jest.fn()
jest.mock('expo-router', () => ({
  router: { replace: (path: string) => mockReplace(path) },
}))

it('keeps all five tabs available and highlights the active route', async () => {
  const view = await render(<UserTabBar pathname="/journal" />)
  expect(screen.getAllByRole('tab')).toHaveLength(5)
  const journal = screen.getByRole('tab', { name: 'Nhật ký', selected: true })
  await fireEvent.press(journal)
  expect(mockReplace).not.toHaveBeenCalled()

  await fireEvent.press(screen.getByRole('tab', { name: 'Cá nhân' }))
  expect(mockReplace).toHaveBeenCalledWith('/(user)/profile')

  await view.rerender(<UserTabBar pathname="/profile" />)
  expect(
    screen.getByRole('tab', { name: 'Cá nhân', selected: true }),
  ).toBeOnTheScreen()
  expect(
    screen.getByRole('tab', { name: 'Nhật ký', selected: false }),
  ).toBeOnTheScreen()
})

it('shows the shared bar on main tabs and excludes standalone screens', () => {
  expect(
    ['/user', '/support-plan', '/journal', '/specialists', '/profile'].every(
      isUserTabPath,
    ),
  ).toBe(true)
  expect(
    [
      '/login',
      '/messages',
      '/resources',
      '/resources/item',
      '/change-password',
    ].some(isUserTabPath),
  ).toBe(false)
})
