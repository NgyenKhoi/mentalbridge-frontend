import type { components } from '../../contracts/content.generated'
import { browserApiClient } from './browser-client'

export type ResourceSummary = components['schemas']['ResourceSummary']
export type ResourceDetail = components['schemas']['AdminResourceDetail']
export type ResourceCategory = components['schemas']['ResourceCategory']
export type ResourceStatus = components['schemas']['ResourceStatus']

export type CreateResourceRequest = {
  category: ResourceCategory
  locale?: string
  title: string
  summary: string
  contentBody?: string | null
  externalUrl?: string | null
  effectiveAt?: string | null
  expiresAt?: string | null
}

export type UpdateResourceRequest = {
  locale?: string
  title?: string
  summary?: string
  contentBody?: string | null
  externalUrl?: string | null
  effectiveAt?: string | null
  expiresAt?: string | null
}

export type PublishResourceRequest = {
  effectiveAt?: string | null
  expiresAt?: string | null
}

export type ListResourcesParams = {
  locale?: string
  category?: ResourceCategory
  status?: ResourceStatus
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

  async listAll(
    params?: Omit<ListResourcesParams, 'cursor'>,
  ): Promise<ResourceListResponse> {
    const data: ResourceSummary[] = []
    let cursor: string | undefined
    for (let page = 0; page < 100; page += 1) {
      const result = await this.list({ ...params, limit: 100, cursor })
      data.push(...result.data)
      if (!result.nextCursor) return { data, count: data.length }
      cursor = result.nextCursor
    }
    throw new Error('Resource pagination exceeded the supported bound')
  },

  async getById(id: string): Promise<ResourceDetail> {
    const response = await browserApiClient.get<ResourceDetail>(
      `/admin/resources/${id}`,
    )
    return response.data
  },

  async create(
    data: CreateResourceRequest,
    idempotencyKey: string,
  ): Promise<ResourceSummary> {
    const response = await browserApiClient.post<ResourceSummary>(
      '/admin/resources',
      data,
      { headers: { 'Idempotency-Key': idempotencyKey } },
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

  async delete(id: string, version: number): Promise<void> {
    await browserApiClient.delete(`/admin/resources/${id}`, {
      params: { version },
    })
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
