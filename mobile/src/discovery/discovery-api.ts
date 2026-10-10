import type { AxiosInstance } from 'axios'
import { z } from 'zod'

import { ApiError } from '@/api/api-error'

import {
  discoveryCriteriaSchema,
  discoveryItemSchema,
  discoveryPageSchema,
  type DiscoveryCriteria,
  type DiscoveryItem,
  type DiscoveryPage,
} from './discovery-contract'

export interface DiscoveryApi {
  list(criteria: DiscoveryCriteria, cursor?: string): Promise<DiscoveryPage>
  detail(id: string, criteria: DiscoveryCriteria): Promise<DiscoveryItem>
}

export function createDiscoveryApi(client: AxiosInstance): DiscoveryApi {
  return {
    async list(criteria, cursor) {
      const params = {
        ...discoveryCriteriaSchema.parse(criteria),
        limit: 20,
        ...(cursor
          ? { cursor: z.string().min(1).max(2048).parse(cursor) }
          : {}),
      }
      return discoveryPageSchema.parse(
        (await client.get('/api/v1/specialists', { params })).data,
      )
    },
    async detail(id, criteria) {
      const expectedId = z.uuid().parse(id)
      const { supportArea: _area, ...params } =
        discoveryCriteriaSchema.parse(criteria)
      const item = discoveryItemSchema.parse(
        (
          await client.get(
            `/api/v1/specialists/${encodeURIComponent(expectedId)}`,
            { params },
          )
        ).data,
      )
      if (item.specialistAccountId !== expectedId)
        throw new ApiError({
          code: 'DISCOVERY_CONTRACT_MISMATCH',
          message: 'Public specialist identity mismatch.',
          status: 502,
        })
      return item
    },
  }
}
