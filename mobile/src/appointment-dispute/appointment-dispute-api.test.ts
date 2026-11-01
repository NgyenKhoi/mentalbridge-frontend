import { create } from 'axios'

import { createAppointmentDisputeApi } from './appointment-dispute-api'
import { disputeFixture } from './appointment-dispute-fixtures'

describe('MB-726 owner-scoped dispute API boundary', () => {
  it('reads the exact owned appointment path and rejects another identity', async () => {
    const client = create()
    const get = jest
      .spyOn(client, 'get')
      .mockResolvedValue({ data: disputeFixture })
    const api = createAppointmentDisputeApi(client)

    await expect(api.get(disputeFixture.appointmentId)).resolves.toEqual(
      disputeFixture,
    )
    expect(get).toHaveBeenCalledWith(
      `/api/v1/appointments/${disputeFixture.appointmentId}/dispute`,
    )

    get.mockResolvedValue({
      data: {
        ...disputeFixture,
        appointmentId: '20a7e5d8-7960-42fb-9706-e642f849b78f',
      },
    })
    await expect(api.get(disputeFixture.appointmentId)).rejects.toMatchObject({
      code: 'APPOINTMENT_DISPUTE_CONTRACT_MISMATCH',
    })
  })

  it('posts only the bounded reason/null evidence and stable key', async () => {
    const client = create()
    const post = jest
      .spyOn(client, 'post')
      .mockResolvedValue({ data: disputeFixture })
    const api = createAppointmentDisputeApi(client)
    const body = {
      reasonCode: 'OUTCOME_INCORRECT',
      evidenceType: null,
      evidenceOccurredAt: null,
    } as const
    const key = 'appointment-dispute-command'

    await api.open(disputeFixture.appointmentId, body, key)
    await api.open(disputeFixture.appointmentId, body, key)
    expect(post).toHaveBeenNthCalledWith(
      2,
      `/api/v1/appointments/${disputeFixture.appointmentId}/dispute`,
      body,
      { headers: { 'Idempotency-Key': key } },
    )
    expect(post.mock.calls[1]?.[2]).not.toHaveProperty('headers.If-Match')

    post.mockResolvedValue({
      data: { ...disputeFixture, reasonCode: 'TECHNICAL_FAILURE' },
    })
    await expect(
      api.open(disputeFixture.appointmentId, body, key),
    ).rejects.toMatchObject({
      code: 'APPOINTMENT_DISPUTE_CONTRACT_MISMATCH',
    })
  })

  it('rejects private or malformed command fields before transport', async () => {
    const client = create()
    const post = jest.spyOn(client, 'post')
    const api = createAppointmentDisputeApi(client)

    await expect(
      api.open(
        disputeFixture.appointmentId,
        {
          reasonCode: 'TECHNICAL_FAILURE',
          evidenceType: null,
          evidenceOccurredAt: null,
          notes: 'private',
        } as never,
        'appointment-dispute-command',
      ),
    ).rejects.toThrow()
    expect(post).not.toHaveBeenCalled()
  })
})
