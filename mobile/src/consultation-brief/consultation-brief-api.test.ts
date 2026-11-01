import { create } from 'axios'

import { createConsultationBriefApi } from './consultation-brief-api'
import {
  activeBrief,
  appointmentId,
  draftBrief,
  revokedBrief,
  screeningChoices,
} from './consultation-brief-fixtures'

describe('MB-723 consultation brief API boundary', () => {
  it('reads only the owner brief and bounded screening context endpoints', async () => {
    const client = create()
    const get = jest
      .spyOn(client, 'get')
      .mockResolvedValueOnce({ data: screeningChoices })
      .mockResolvedValueOnce({ data: draftBrief })
    const api = createConsultationBriefApi(client)

    await expect(api.screeningContexts()).resolves.toEqual(screeningChoices)
    await expect(api.get(appointmentId)).resolves.toEqual(draftBrief)

    expect(get).toHaveBeenNthCalledWith(
      1,
      '/api/v1/consultation-briefs/screening-contexts',
    )
    expect(get).toHaveBeenNthCalledWith(
      2,
      `/api/v1/consultation-briefs/${appointmentId}`,
    )
  })

  it('saves only the minimized draft and uses optimistic concurrency after creation', async () => {
    const client = create()
    const put = jest
      .spyOn(client, 'put')
      .mockResolvedValue({ data: draftBrief })
    const api = createConsultationBriefApi(client)
    const draft = {
      currentSituation: draftBrief.currentSituation,
      supportEvaluationId: draftBrief.supportEvaluationId,
      userGoals: draftBrief.userGoals,
    }

    await api.save(appointmentId, draft)
    expect(put).toHaveBeenNthCalledWith(
      1,
      `/api/v1/consultation-briefs/${appointmentId}/draft`,
      draft,
      { headers: {} },
    )
    await api.save(appointmentId, draft, 1)
    expect(put).toHaveBeenNthCalledWith(
      2,
      `/api/v1/consultation-briefs/${appointmentId}/draft`,
      draft,
      { headers: { 'If-Match': '"1"' } },
    )
  })

  it('approves and revokes with the exact current version and no body', async () => {
    const client = create()
    const post = jest
      .spyOn(client, 'post')
      .mockResolvedValueOnce({ data: activeBrief })
      .mockResolvedValueOnce({ data: revokedBrief })
    const api = createConsultationBriefApi(client)

    await api.approve(appointmentId, 1)
    expect(post).toHaveBeenNthCalledWith(
      1,
      `/api/v1/consultation-briefs/${appointmentId}/approve`,
      undefined,
      { headers: { 'If-Match': '"1"' } },
    )
    await api.revoke(appointmentId, 2)
    expect(post).toHaveBeenNthCalledWith(
      2,
      `/api/v1/consultation-briefs/${appointmentId}/revoke`,
      undefined,
      { headers: { 'If-Match': '"2"' } },
    )
  })

  it('fails closed when an action returns a different appointment or state', async () => {
    const client = create()
    jest.spyOn(client, 'post').mockResolvedValue({
      data: { ...activeBrief, appointmentId: activeBrief.id },
    })
    const api = createConsultationBriefApi(client)

    await expect(api.approve(appointmentId, 1)).rejects.toMatchObject({
      code: 'CONSULTATION_BRIEF_CONTRACT_MISMATCH',
    })
  })
})
