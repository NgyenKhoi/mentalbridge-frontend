import type { AxiosInstance } from 'axios'

import {
  resourceCatalogueSchema,
  resourceDetailSchema,
  resourceProgressItemSchema,
  resourceProgressListSchema,
  resourceProgressUpdateSchema,
  type ResourceCatalogue,
  type ResourceCategory,
  type ResourceDetail,
  type ResourceProgressItem,
  type ResourceProgressUpdate,
} from './resource-contract'

export interface ResourceApi {
  listResources(request: {
    locale: string
    category?: ResourceCategory
    cursor?: string
    limit: number
  }): Promise<ResourceCatalogue>
  getResource(resourceId: string, locale: string): Promise<ResourceDetail>
  listProgress(from: string, to: string): Promise<ResourceProgressItem[]>
  saveProgress(
    resourceId: string,
    localDate: string,
    update: ResourceProgressUpdate,
  ): Promise<ResourceProgressItem>
}

export function createResourceApi(client: AxiosInstance): ResourceApi {
  return {
    async listResources({ locale, category, cursor, limit }) {
      const response = await client.get('/api/v1/resources', {
        params: {
          locale,
          limit,
          ...(category ? { category } : {}),
          ...(cursor ? { cursor } : {}),
        },
      })
      return resourceCatalogueSchema.parse(response.data)
    },
    async getResource(resourceId, locale) {
      const response = await client.get(
        `/api/v1/resources/${encodeURIComponent(resourceId)}`,
        { params: { locale } },
      )
      return resourceDetailSchema.parse(response.data)
    },
    async listProgress(from, to) {
      const response = await client.get('/api/v1/resource-progress', {
        params: { from, to },
      })
      return resourceProgressListSchema.parse(response.data).items
    },
    async saveProgress(resourceId, localDate, update) {
      const request = resourceProgressUpdateSchema.parse(update)
      const response = await client.put(
        `/api/v1/resource-progress/${encodeURIComponent(resourceId)}/${encodeURIComponent(localDate)}`,
        request,
      )
      return resourceProgressItemSchema.parse(response.data)
    },
  }
}
