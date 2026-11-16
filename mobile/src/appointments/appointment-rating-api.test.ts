import { create } from 'axios'

import { createAppointmentRatingApi } from './appointment-rating-api'

const appointmentId = '10000000-0000-4000-8000-000000000001'
const rating = {
  appointmentId,
  specialistAccountId: '20000000-0000-4000-8000-000000000002',
  rating: 4,
  createdAt: '2026-11-16T01:00:00Z',
  updatedAt: '2026-11-16T01:00:00Z',
  version: 2,
  specialistAggregate: { averageRating: 4.5, ratingCount: 2 },
}

describe('MB-709 appointment rating API', () => {
  it('pins owner endpoints and sends the current version only for edits', async () => {
    const client = create()
    const get = jest.spyOn(client, 'get').mockResolvedValue({ data: rating })
    const put = jest.spyOn(client, 'put').mockResolvedValue({ data: rating })
    const api = createAppointmentRatingApi(client)
    await api.current(appointmentId)
    expect(get).toHaveBeenCalledWith(
      `/api/v1/appointments/${appointmentId}/rating`,
    )
    await api.save(appointmentId, 4, 2)
    expect(put).toHaveBeenCalledWith(
      `/api/v1/appointments/${appointmentId}/rating`,
      { rating: 4 },
      { headers: { 'If-Match': '"2"' } },
    )
  })

  it('fails closed when the authoritative receipt belongs to another appointment', async () => {
    const client = create()
    jest.spyOn(client, 'put').mockResolvedValue({
      data: { ...rating, appointmentId: rating.specialistAccountId },
    })
    await expect(
      createAppointmentRatingApi(client).save(appointmentId, 4),
    ).rejects.toMatchObject({ code: 'APPOINTMENT_RATING_CONTRACT_MISMATCH' })
  })
})
