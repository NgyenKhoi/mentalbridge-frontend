import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native'

import { ApiError } from '@/api/api-error'

import type { AppointmentRatingApi } from './appointment-rating-api'
import { AppointmentRatingPanel } from './AppointmentRatingPanel'

const id = '10000000-0000-4000-8000-000000000001'
const value = {
  appointmentId: id,
  specialistAccountId: '20000000-0000-4000-8000-000000000002',
  rating: 4,
  createdAt: '2026-11-16T01:00:00Z',
  updatedAt: '2026-11-16T01:00:00Z',
  version: 2,
  specialistAggregate: { averageRating: 4.5, ratingCount: 2 },
}

async function mount(api: AppointmentRatingApi) {
  return await render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false },
          },
        })
      }
    >
      <AppointmentRatingPanel api={api} appointmentId={id} />
    </QueryClientProvider>,
  )
}

describe('MB-709 rating states', () => {
  it('preserves unchanged rating and submits an edit with authoritative version', async () => {
    const api: AppointmentRatingApi = {
      current: jest.fn().mockResolvedValue(value),
      save: jest.fn().mockResolvedValue({ ...value, rating: 5, version: 3 }),
    }
    await mount(api)
    expect(await screen.findByText('Đánh giá hiện tại: 4/5')).toBeOnTheScreen()
    expect(
      screen.getByRole('button', { name: 'Cập nhật đánh giá' }),
    ).toBeDisabled()
    await fireEvent.press(screen.getByRole('radio', { name: '5 sao' }))
    await fireEvent.press(
      screen.getByRole('button', { name: 'Cập nhật đánh giá' }),
    )
    await waitFor(() => expect(api.save).toHaveBeenCalledWith(id, 5, 2))
  })

  it('reloads after a stale edit instead of claiming success', async () => {
    const api: AppointmentRatingApi = {
      current: jest.fn().mockResolvedValue(value),
      save: jest.fn().mockRejectedValue(
        new ApiError({
          status: 412,
          code: 'APPOINTMENT_RATING_VERSION_MISMATCH',
          message: 'stale',
        }),
      ),
    }
    await mount(api)
    await screen.findByText('Đánh giá hiện tại: 4/5')
    await fireEvent.press(screen.getByRole('radio', { name: '5 sao' }))
    await fireEvent.press(
      screen.getByRole('button', { name: 'Cập nhật đánh giá' }),
    )
    expect(await screen.findByText(/Đánh giá đã thay đổi/)).toBeOnTheScreen()
    await waitFor(() => expect(api.current).toHaveBeenCalledTimes(2))
  })
})
