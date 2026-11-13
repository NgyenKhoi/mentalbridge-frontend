import { ApiError } from '@/api/api-error'

import type { AxiosInstance } from 'axios'

import {
  careProfileSchema,
  type CareProfile,
  type CareProfileUpdate,
} from './profile-contract'

export interface CareProfileApi {
  getProfile(): Promise<CareProfile>
  putProfile(
    request: CareProfileUpdate,
    version: number | undefined,
  ): Promise<CareProfile>
}

function isMissingProfile(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.status === 404 &&
    error.code === 'PROFILE_NOT_FOUND'
  )
}

export async function loadCareProfile(api: Pick<CareProfileApi, 'getProfile'>) {
  try {
    return await api.getProfile()
  } catch (error) {
    if (isMissingProfile(error)) return null
    throw error
  }
}

export function createCareProfileApi(client: AxiosInstance): CareProfileApi {
  return {
    async getProfile() {
      const response = await client.get('/api/v1/profile')
      return careProfileSchema.parse(response.data)
    },
    async putProfile(request, version) {
      const config =
        version === undefined ? {} : { headers: { 'If-Match': `"${version}"` } }
      const response = await client.put('/api/v1/profile', request, config)
      return careProfileSchema.parse(response.data)
    },
  }
}
