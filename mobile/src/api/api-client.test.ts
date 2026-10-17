import {
  AxiosError,
  AxiosHeaders,
  isAxiosError,
  type AxiosAdapter,
  type InternalAxiosRequestConfig,
} from 'axios'

import type { RuntimeConfig } from '@/config/runtime-config'

import { createApiClient } from './api-client'
import { ApiError, toApiError } from './api-error'

const config: RuntimeConfig = {
  apiBaseUrl: 'https://api.test.mentalbridge',
  apiTimeoutMs: 2500,
}

describe('mobile API client', () => {
  it('adds bearer credentials and a caller correlation ID', async () => {
    let request: InternalAxiosRequestConfig | undefined
    const adapter: AxiosAdapter = async (received) => {
      request = received
      return {
        config: received,
        data: {},
        headers: {},
        status: 200,
        statusText: 'OK',
      }
    }
    const client = createApiClient({
      adapter,
      config,
      createCorrelationId: () => '22222222-2222-4222-8222-222222222222',
      getBearerToken: async () => 'synthetic-access-token',
    })

    await client.get('/health')

    expect(request?.headers.get('Authorization')).toBe(
      'Bearer synthetic-access-token',
    )
    expect(request?.headers.get('X-Correlation-Id')).toBe(
      '22222222-2222-4222-8222-222222222222',
    )
    expect(request?.timeout).toBe(2500)
  })

  it('does not add an Authorization header without a credential', async () => {
    let request: InternalAxiosRequestConfig | undefined
    const adapter: AxiosAdapter = async (received) => {
      request = received
      return {
        config: received,
        data: {},
        headers: {},
        status: 200,
        statusText: 'OK',
      }
    }
    const client = createApiClient({
      adapter,
      config,
      getBearerToken: async () => null,
    })

    await client.get('/public')

    expect(request?.headers.has('Authorization')).toBe(false)
  })

  it('normalizes RFC 9457 Problem Details and preserves extensions', () => {
    const request = {
      headers: new AxiosHeaders(),
    } as InternalAxiosRequestConfig
    const problem = {
      type: 'https://api.test.mentalbridge/problems/validation',
      title: 'Validation failed',
      status: 422,
      code: 'VALIDATION_FAILED',
      correlationId: '33333333-3333-4333-8333-333333333333',
      retryable: false,
    }
    const error = new AxiosError(
      'Request failed',
      'ERR_BAD_REQUEST',
      request,
      undefined,
      {
        config: request,
        data: problem,
        headers: {},
        status: 422,
        statusText: 'Unprocessable Entity',
      },
    )

    expect(toApiError(error)).toMatchObject({
      code: 'VALIDATION_FAILED',
      correlationId: '33333333-3333-4333-8333-333333333333',
      problem: { retryable: false },
      status: 422,
    })
  })

  it('maps timeouts to a stable safe error', () => {
    const error = new AxiosError('timeout', 'ECONNABORTED')

    expect(toApiError(error)).toMatchObject<ApiError>({
      code: 'REQUEST_TIMEOUT',
      message: 'Yêu cầu mất quá nhiều thời gian. Vui lòng thử lại.',
      name: 'ApiError',
      correlationId: undefined,
      problem: undefined,
      status: undefined,
    })
  })

  it('returns existing normalized errors unchanged', () => {
    const error = new ApiError({
      code: 'KNOWN_ERROR',
      message: 'Known safe message',
    })

    expect(toApiError(error)).toBe(error)
    expect(isAxiosError(error)).toBe(false)
  })
})
