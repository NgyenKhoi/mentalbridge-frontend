import 'server-only'

import { ApiError } from '@/lib/api/api-error'
import { isProblemDetails } from '@/lib/api/problem-details'
import { readJournalServerConfig } from '@/lib/config/server'

type Method = 'GET' | 'POST'

function dependencyError(message: string, code: string, status = 502) {
  return new ApiError({ message, code, status })
}

async function responseJson(response: Response) {
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().includes('json'))
    throw dependencyError(
      'Benchmark service returned an invalid response.',
      'BENCHMARK_MALFORMED_RESPONSE',
    )
  const text = await response.text()
  if (new TextEncoder().encode(text).byteLength > 512 * 1024)
    throw dependencyError(
      'Benchmark response exceeded the safe boundary.',
      'BENCHMARK_MALFORMED_RESPONSE',
    )
  try {
    return JSON.parse(text) as unknown
  } catch (cause) {
    throw new ApiError({
      message: 'Benchmark service returned malformed JSON.',
      code: 'BENCHMARK_MALFORMED_RESPONSE',
      status: 502,
      cause,
    })
  }
}

export async function benchmarkRequest(
  options: Readonly<{
    method: Method
    path: string
    accessToken: string
    correlationId: string
    idempotencyKey?: string
    body?: unknown
  }>,
) {
  const configuration = readJournalServerConfig()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), configuration.timeoutMs)
  try {
    const response = await fetch(
      new URL(options.path.replace(/^\//, ''), configuration.baseUrl),
      {
        method: options.method,
        cache: 'no-store',
        redirect: 'error',
        signal: controller.signal,
        headers: {
          Accept: 'application/json, application/problem+json',
          Authorization: `Bearer ${options.accessToken}`,
          'X-Correlation-Id': options.correlationId,
          ...(options.idempotencyKey
            ? { 'Idempotency-Key': options.idempotencyKey }
            : {}),
          ...(options.body === undefined
            ? {}
            : { 'Content-Type': 'application/json' }),
        },
        ...(options.body === undefined
          ? {}
          : { body: JSON.stringify(options.body) }),
      },
    )
    const body = await responseJson(response)
    if (!response.ok) {
      if (isProblemDetails(body))
        throw new ApiError({
          message: body.title,
          code: body.code,
          status: response.status,
          correlationId: body.correlationId,
          problem: body,
        })
      throw dependencyError(
        'Benchmark service rejected the request.',
        'BENCHMARK_UPSTREAM_ERROR',
        response.status,
      )
    }
    if (body === null || typeof body !== 'object')
      throw dependencyError(
        'Benchmark service returned an invalid response.',
        'BENCHMARK_MALFORMED_RESPONSE',
      )
    return body
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError({
      message: 'Benchmark service is unavailable.',
      code: 'BENCHMARK_UNAVAILABLE',
      status: 503,
      cause: error,
    })
  } finally {
    clearTimeout(timeout)
  }
}
