import { create, type AxiosAdapter, type AxiosInstance } from 'axios'
import { randomUUID } from 'expo-crypto'

import type { RuntimeConfig } from '@/config/runtime-config'

import { toApiError } from './api-error'

export type BearerTokenProvider = () => Promise<string | null>

type ApiClientOptions = Readonly<{
  config: RuntimeConfig
  getBearerToken: BearerTokenProvider
  createCorrelationId?: () => string
  adapter?: AxiosAdapter
}>

export function createApiClient({
  config,
  getBearerToken,
  createCorrelationId = randomUUID,
  adapter,
}: ApiClientOptions): AxiosInstance {
  const client = create({
    baseURL: config.apiBaseUrl,
    timeout: config.apiTimeoutMs,
    ...(adapter ? { adapter } : {}),
    headers: {
      Accept: 'application/json, application/problem+json',
    },
  })

  client.interceptors.request.use(async (request) => {
    if (!request.headers.has('X-Correlation-Id')) {
      request.headers.set('X-Correlation-Id', createCorrelationId())
    }

    const bearerToken = await getBearerToken()
    if (bearerToken) {
      request.headers.set('Authorization', `Bearer ${bearerToken}`)
    }

    return request
  })
  client.interceptors.response.use(
    (response) => response,
    (error: unknown) => Promise.reject(toApiError(error)),
  )

  return client
}
