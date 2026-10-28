import type { AxiosInstance } from 'axios'
import { z } from 'zod'

import { ApiError } from '@/api/api-error'

import {
  consultationBriefDraftRequestSchema,
  consultationBriefSchema,
  consultationBriefScreeningContextListSchema,
  type ConsultationBrief,
  type ConsultationBriefDraftRequest,
  type ConsultationBriefScreeningContextList,
} from './consultation-brief-contract'

export interface ConsultationBriefApi {
  screeningContexts(): Promise<ConsultationBriefScreeningContextList>
  get(appointmentId: string): Promise<ConsultationBrief>
  save(
    appointmentId: string,
    draft: ConsultationBriefDraftRequest,
    version?: number,
  ): Promise<ConsultationBrief>
  approve(appointmentId: string, version: number): Promise<ConsultationBrief>
  revoke(appointmentId: string, version: number): Promise<ConsultationBrief>
}

function versionHeader(version: number) {
  return { 'If-Match': `"${z.number().int().nonnegative().parse(version)}"` }
}

function parseBrief(
  data: unknown,
  appointmentId: string,
  expected?: Readonly<{
    status?: ConsultationBrief['status']
    sharingStatus?: ConsultationBrief['sharingStatus']
  }>,
) {
  const brief = consultationBriefSchema.parse(data)
  if (
    brief.appointmentId !== appointmentId ||
    (expected?.status && brief.status !== expected.status) ||
    (expected?.sharingStatus && brief.sharingStatus !== expected.sharingStatus)
  ) {
    throw new ApiError({
      code: 'CONSULTATION_BRIEF_CONTRACT_MISMATCH',
      message: 'Consultation brief response identity or state mismatch.',
      status: 502,
    })
  }
  return brief
}

export function createConsultationBriefApi(
  client: AxiosInstance,
): ConsultationBriefApi {
  return {
    async screeningContexts() {
      const response = await client.get(
        '/api/v1/consultation-briefs/screening-contexts',
      )
      return consultationBriefScreeningContextListSchema.parse(response.data)
    },
    async get(appointmentId) {
      const id = z.uuid().parse(appointmentId)
      const response = await client.get(
        `/api/v1/consultation-briefs/${encodeURIComponent(id)}`,
      )
      return parseBrief(response.data, id)
    },
    async save(appointmentId, input, version) {
      const id = z.uuid().parse(appointmentId)
      const draft = consultationBriefDraftRequestSchema.parse(input)
      const response = await client.put(
        `/api/v1/consultation-briefs/${encodeURIComponent(id)}/draft`,
        draft,
        {
          headers: version === undefined ? {} : versionHeader(version),
        },
      )
      return parseBrief(response.data, id, {
        sharingStatus: 'NONE',
        status: 'DRAFT',
      })
    },
    async approve(appointmentId, version) {
      const id = z.uuid().parse(appointmentId)
      const response = await client.post(
        `/api/v1/consultation-briefs/${encodeURIComponent(id)}/approve`,
        undefined,
        { headers: versionHeader(version) },
      )
      return parseBrief(response.data, id, {
        sharingStatus: 'ACTIVE',
        status: 'APPROVED',
      })
    },
    async revoke(appointmentId, version) {
      const id = z.uuid().parse(appointmentId)
      const response = await client.post(
        `/api/v1/consultation-briefs/${encodeURIComponent(id)}/revoke`,
        undefined,
        { headers: versionHeader(version) },
      )
      return parseBrief(response.data, id, {
        sharingStatus: 'REVOKED',
        status: 'APPROVED',
      })
    },
  }
}
