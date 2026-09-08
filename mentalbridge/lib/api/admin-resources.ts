import type { components } from '../../contracts/content.generated'
import { browserApiClient } from './browser-client'

export type ResourceSummary = components['schemas']['ResourceSummary']
export type ResourceDetail = components['schemas']['ResourceDetail']
export type ResourceCategory = components['schemas']['ResourceCategory']
export type ResourceStatus = components['schemas']['ResourceStatus']

export type CreateResourceRequest = {
  category: ResourceCategory
  locale?: string
  title: string
  summary: string
  contentBody?: string | null
  externalUrl?: string | null
}

export type UpdateResourceRequest = {
  title?: string
  summary?: string
  contentBody?: string | null
  externalUrl?: string | null
}

export type PublishResourceRequest = {
  effectiveAt?: string | null
  expiresAt?: string | null
}

export type ListResourcesParams = {
  locale?: string
  category?: ResourceCategory
  limit?: number
  cursor?: string
}

export type ResourceListResponse = {
  data: ResourceSummary[]
  count: number
  nextCursor?: string
}

export const adminResourcesApi = {
  async list(params?: ListResourcesParams): Promise<ResourceListResponse> {
    const response = await browserApiClient.get<ResourceListResponse>(
      '/admin/resources',
      { params },
    )
    return response.data
  },

  async getById(id: string): Promise<ResourceDetail> {
    const response = await browserApiClient.get<ResourceDetail>(
      `/admin/resources/${id}`,
    )
    return response.data
  },

  async create(data: CreateResourceRequest): Promise<ResourceSummary> {
    const response = await browserApiClient.post<ResourceSummary>(
      '/admin/resources',
      data,
    )
    return response.data
  },

  async update(
    id: string,
    version: number,
    data: UpdateResourceRequest,
  ): Promise<ResourceSummary> {
    const response = await browserApiClient.patch<ResourceSummary>(
      `/admin/resources/${id}`,
      data,
      {
        params: { version },
      },
    )
    return response.data
  },

  async delete(id: string): Promise<void> {
    await browserApiClient.delete(`/admin/resources/${id}`)
  },

  async publish(
    id: string,
    version: number,
    data?: PublishResourceRequest,
  ): Promise<ResourceSummary> {
    const response = await browserApiClient.post<ResourceSummary>(
      `/admin/resources/${id}/publish`,
      data || {},
      {
        params: { version },
      },
    )
    return response.data
  },

  async archive(id: string, version: number): Promise<ResourceSummary> {
    const response = await browserApiClient.post<ResourceSummary>(
      `/admin/resources/${id}/archive`,
      {},
      {
        params: { version },
      },
    )
    return response.data
  },
}
