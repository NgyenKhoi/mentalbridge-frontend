import { create } from 'axios'

import {
  makeSessionSummary,
  makeSessionSummaryList,
} from '@/specialist-summary/specialist-summary-test-fixtures'
import {
  APPOINTMENT_ID,
  USER_ID,
} from '@/specialist-appointments/specialist-appointment-test-fixtures'

import { createUserSummaryApi } from './user-summary-api'

describe('MB-724 USER SessionSummary API boundary', () => {
  it('loads only the owned completed appointment summaries', async () => {
    const client = create()
    const get = jest
      .spyOn(client, 'get')
      .mockResolvedValue({ data: makeSessionSummaryList() })
    const api = createUserSummaryApi(client, USER_ID)

    await expect(api.list(APPOINTMENT_ID)).resolves.toEqual(
      makeSessionSummaryList(),
    )
    expect(get).toHaveBeenCalledWith(
      `/api/v1/appointments/${APPOINTMENT_ID}/session-summaries`,
    )
  })

  it.each([
    [
      'another appointment',
      { appointmentId: '77777777-7777-4777-8777-777777777777' },
    ],
    ['another user', { userAccountId: '66666666-6666-4666-8666-666666666666' }],
  ])('rejects a list item owned by %s', async (_label, drift) => {
    const client = create()
    jest.spyOn(client, 'get').mockResolvedValue({
      data: makeSessionSummaryList([makeSessionSummary(drift)]),
    })
    const api = createUserSummaryApi(client, USER_ID)

    await expect(api.list(APPOINTMENT_ID)).rejects.toMatchObject({
      code: 'SESSION_SUMMARY_AUTHORITY_MISMATCH',
      status: 502,
    })
  })

  it('updates exact-summary reuse consent with its current version', async () => {
    const summary = makeSessionSummary({
      reuseConsent: {
        approved: true,
        version: 4,
        updatedAt: '2030-10-15T04:02:00.000Z',
      },
    })
    const client = create()
    const put = jest.spyOn(client, 'put').mockResolvedValue({ data: summary })
    const api = createUserSummaryApi(client, USER_ID)

    await expect(
      api.updateConsent(APPOINTMENT_ID, summary.id, true, 3),
    ).resolves.toEqual(summary)
    expect(put).toHaveBeenCalledWith(
      `/api/v1/session-summaries/${summary.id}/reuse-consent`,
      { approved: true },
      { headers: { 'If-Match': '"3"' } },
    )
  })

  it('updates one agreed next step with state, hidden and its current version', async () => {
    const original = makeSessionSummary()
    const step = original.agreedNextSteps[0]
    if (!step) throw new Error('Missing step fixture')
    const updated = makeSessionSummary({
      agreedNextSteps: [
        {
          ...step,
          state: 'COMPLETED',
          hidden: true,
          stateVersion: 2,
          stateUpdatedAt: '2030-10-15T04:03:00.000Z',
        },
      ],
    })
    const client = create()
    const put = jest.spyOn(client, 'put').mockResolvedValue({ data: updated })
    const api = createUserSummaryApi(client, USER_ID)

    await expect(
      api.updateStep(
        APPOINTMENT_ID,
        step.id,
        { state: 'COMPLETED', hidden: true },
        1,
      ),
    ).resolves.toEqual(updated)
    expect(put).toHaveBeenCalledWith(
      `/api/v1/agreed-next-steps/${step.id}`,
      { state: 'COMPLETED', hidden: true },
      { headers: { 'If-Match': '"1"' } },
    )
  })

  it('rejects a mutation response for another command or owner', async () => {
    const summary = makeSessionSummary()
    const step = summary.agreedNextSteps[0]
    if (!step) throw new Error('Missing step fixture')
    const client = create()
    jest
      .spyOn(client, 'put')
      .mockResolvedValueOnce({ data: { ...summary, id: APPOINTMENT_ID } })
      .mockResolvedValueOnce({
        data: makeSessionSummary({ agreedNextSteps: [] }),
      })
    const api = createUserSummaryApi(client, USER_ID)

    await expect(
      api.updateConsent(APPOINTMENT_ID, summary.id, true, 0),
    ).rejects.toMatchObject({ code: 'SESSION_SUMMARY_AUTHORITY_MISMATCH' })
    await expect(
      api.updateStep(
        APPOINTMENT_ID,
        step.id,
        { state: 'PENDING', hidden: false },
        0,
      ),
    ).rejects.toMatchObject({ code: 'SESSION_SUMMARY_AUTHORITY_MISMATCH' })
  })
})
