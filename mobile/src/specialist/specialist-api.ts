import type { AxiosInstance } from 'axios'
import { z } from 'zod'

import {
  availabilitySlotListSchema,
  availabilitySlotSchema,
  publishAvailabilityRequestSchema,
  specialistProfileRequestSchema,
  specialistProfileSchema,
  type AvailabilitySlot,
  type AvailabilitySlotList,
  type PublishAvailabilityRequest,
  type SpecialistProfile,
  type SpecialistProfileRequest,
} from './specialist-contract'

const credentialSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  issuer: z.string(),
  issueYear: z.number(),
  verificationStatus: z.enum(['PENDING', 'VERIFIED', 'REJECTED']),
})

export interface SpecialistApi {
  listCredentials?(): Promise<z.infer<typeof credentialSummarySchema>[]>
  getProfile(): Promise<SpecialistProfile>
  saveProfile(
    request: SpecialistProfileRequest,
    version: number | undefined,
  ): Promise<SpecialistProfile>
  submitProfile(profile: SpecialistProfile): Promise<SpecialistProfile>
  resubmitProfile(profile: SpecialistProfile): Promise<SpecialistProfile>
  listAvailability(
    window?: Readonly<{ from: string; to: string }>,
  ): Promise<AvailabilitySlotList>
  publishAvailability(
    request: PublishAvailabilityRequest,
    idempotencyKey: string,
  ): Promise<AvailabilitySlot>
  withdrawAvailability(slot: AvailabilitySlot): Promise<AvailabilitySlot>
}

export function createSpecialistApi(client: AxiosInstance): SpecialistApi {
  return {
    async listCredentials() {
      const response = await client.get('/api/v1/specialist-profile/documents')
      return credentialSummarySchema.array().parse(response.data)
    },
    async getProfile() {
      const response = await client.get('/api/v1/specialist-profile')
      return specialistProfileSchema.parse(response.data)
    },
    async saveProfile(request, version) {
      const body = specialistProfileRequestSchema.parse(request)
      const response = await client.put('/api/v1/specialist-profile', body, {
        ...(version === undefined
          ? {}
          : { headers: { 'If-Match': `"${version}"` } }),
      })
      return specialistProfileSchema.parse(response.data)
    },
    async submitProfile(profile) {
      const response = await client.post(
        '/api/v1/specialist-profile/submit',
        undefined,
        { headers: { 'If-Match': `"${profile.version}"` } },
      )
      return specialistProfileSchema.parse(response.data)
    },
    async resubmitProfile(profile) {
      const response = await client.post(
        '/api/v1/specialist-profile/resubmit',
        undefined,
        { headers: { 'If-Match': `"${profile.version}"` } },
      )
      return specialistProfileSchema.parse(response.data)
    },
    async listAvailability(window) {
      const response = await client.get('/api/v1/availability-slots', {
        params: { includeWithdrawn: true, ...window },
      })
      return availabilitySlotListSchema.parse(response.data)
    },
    async publishAvailability(request, idempotencyKey) {
      const body = publishAvailabilityRequestSchema.parse(request)
      const response = await client.post('/api/v1/availability-slots', body, {
        headers: { 'Idempotency-Key': idempotencyKey },
      })
      return availabilitySlotSchema.parse(response.data)
    },
    async withdrawAvailability(slot) {
      const response = await client.delete(
        `/api/v1/availability-slots/${encodeURIComponent(slot.id)}`,
        { headers: { 'If-Match': `"${slot.version}"` } },
      )
      return availabilitySlotSchema.parse(response.data)
    },
  }
}
