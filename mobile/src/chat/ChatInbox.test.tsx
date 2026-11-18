import { fireEvent, render, screen } from '@testing-library/react-native'
import { appointment } from '@/appointments/appointment-fixtures'
import { ChatInbox } from './ChatInbox'

jest.mock('@/resources/useResourceFonts', () => ({
  useResourceFonts: () => false,
}))

it('filters real appointment rows and opens their exact conversation id', async () => {
  const open = jest.fn()
  await render(
    <ChatInbox
      items={[
        {
          ...appointment,
          id: 'active',
          specialistDisplayName: 'Chuyên gia An',
          status: 'IN_PROGRESS',
        },
        {
          ...appointment,
          id: 'ended',
          specialistDisplayName: 'Chuyên gia Bình',
          status: 'COMPLETED',
        },
        {
          ...appointment,
          id: 'requested',
          specialistDisplayName: 'Lịch chưa xác nhận',
        },
      ]}
      loading={false}
      failed={false}
      role="USER"
      onBack={jest.fn()}
      onRetry={jest.fn()}
      onOpen={open}
    />,
  )
  expect(screen.queryByText('Lịch chưa xác nhận')).toBeNull()
  await fireEvent.changeText(
    screen.getByLabelText('Tìm cuộc trò chuyện'),
    'Bình',
  )
  expect(screen.queryByText('Chuyên gia An')).toBeNull()
  await fireEvent.press(
    screen.getByRole('button', {
      name: 'Mở phiên trò chuyện với Chuyên gia Bình',
    }),
  )
  expect(open).toHaveBeenCalledWith('ended')
})
