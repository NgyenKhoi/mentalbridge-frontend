import { create } from 'axios'

import { createAppointmentApi } from './appointment-api'
import {
  appointment,
  cancelled,
  credits,
  slot,
  subject,
} from './appointment-fixtures'

describe('MB-630 owner-scoped API boundary', () => {
  it('reads only public owner endpoints and rejects a different credit owner', async () => {
    const client = create()
    const get = jest.spyOn(client, 'get').mockResolvedValue({ data: credits })
    const api = createAppointmentApi(client, subject)
    await api.credits()
    expect(get).toHaveBeenCalledWith('/api/v1/service-credits')
    get.mockResolvedValue({
      data: { ...credits, accountId: appointment.specialistAccountId },
    })
    await expect(api.credits()).rejects.toMatchObject({
      code: 'APPOINTMENT_CONTRACT_MISMATCH',
    })
    get.mockResolvedValue({
      data: {
        items: [appointment],
        count: 1,
        generatedAt: credits.generatedAt,
      },
    })
    await api.list()
    expect(get).toHaveBeenLastCalledWith('/api/v1/appointments')
    get.mockResolvedValue({
      data: {
        items: [slot],
        count: 1,
        generatedAt: credits.generatedAt,
        videoEnabled: false,
      },
    })
    await api.slots()
    expect(get).toHaveBeenLastCalledWith('/api/v1/bookable-slots')
  })
  it('sends only exact slot/modality plus stable idempotency, with If-Match for replacement', async () => {
    const client = create()
    const post = jest
      .spyOn(client, 'post')
      .mockResolvedValue({ data: appointment })
    const api = createAppointmentApi(client, subject)
    const key = 'appointment-synthetic-command'
    const body = { slotId: slot.id, modality: slot.modality }
    await api.request(body, key)
    await api.request(body, key)
    expect(post).toHaveBeenNthCalledWith(2, '/api/v1/appointments', body, {
      headers: { 'Idempotency-Key': key },
    })
    const replacement = { ...body, replacesAppointmentId: cancelled.id }
    post.mockResolvedValue({
      data: { ...appointment, replacesAppointmentId: cancelled.id },
    })
    await api.request(replacement, key, 7)
    expect(post).toHaveBeenLastCalledWith('/api/v1/appointments', replacement, {
      headers: { 'Idempotency-Key': key, 'If-Match': '"7"' },
    })
    await expect(api.request(replacement, key)).rejects.toThrow()
  })
  it('cancels without a state/credit/actor payload and verifies returned identity', async () => {
    const client = create()
    const post = jest
      .spyOn(client, 'post')
      .mockResolvedValue({ data: cancelled })
    const api = createAppointmentApi(client, subject)
    await api.cancel(cancelled.id, 0, 'appointment-cancel-synthetic')
    expect(post).toHaveBeenCalledWith(
      `/api/v1/appointments/${cancelled.id}/cancel`,
      undefined,
      {
        headers: {
          'Idempotency-Key': 'appointment-cancel-synthetic',
          'If-Match': '"0"',
        },
      },
    )
    post.mockResolvedValue({ data: { ...cancelled, id: slot.id } })
    await expect(
      api.cancel(cancelled.id, 0, 'appointment-cancel-synthetic'),
    ).rejects.toMatchObject({ code: 'APPOINTMENT_CONTRACT_MISMATCH' })
    post.mockResolvedValue({ data: { ...appointment, slotId: cancelled.id } })
    await expect(
      api.request(
        { slotId: slot.id, modality: slot.modality },
        'appointment-synthetic-command',
      ),
    ).rejects.toMatchObject({ code: 'APPOINTMENT_CONTRACT_MISMATCH' })
  })
})
