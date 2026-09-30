import 'server-only'

import { readRealtimeServerConfig } from '@/lib/config/server'

export class RealtimeServiceError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message)
  }
}

async function call(
  path: string,
  token: string,
  correlationId: string,
  method: 'GET' | 'POST',
) {
  const config = readRealtimeServerConfig()
  let response: Response
  try {
    response = await fetch(new URL(path.replace(/^\//, ''), config.baseUrl), {
      method,
      cache: 'no-store',
      redirect: 'error',
      headers: {
        Accept: 'application/json, application/problem+json',
        Authorization: `Bearer ${token}`,
        'X-Correlation-Id': correlationId,
      },
      signal: AbortSignal.timeout(config.timeoutMs),
    })
  } catch {
    throw new RealtimeServiceError(
      503,
      'REALTIME_UNAVAILABLE',
      'Realtime is unavailable.',
    )
  }
  const value = (await response.json().catch(() => null)) as unknown
  if (!response.ok) {
    const problem = asRecord(value)
    throw new RealtimeServiceError(
      response.status,
      typeof problem?.code === 'string'
        ? problem.code
        : 'REALTIME_DEPENDENCY_FAILED',
      typeof problem?.title === 'string'
        ? problem.title
        : 'Realtime request failed.',
    )
  }
  return value
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

export const realtimeServerClient = {
  async credential(token: string, correlationId: string) {
    const config = readRealtimeServerConfig()
    const value = asRecord(
      await call(
        '/internal/v1/socket-credentials',
        token,
        correlationId,
        'POST',
      ),
    )
    if (
      !value ||
      typeof value.accessToken !== 'string' ||
      value.accessToken.length < 32 ||
      typeof value.expiresAt !== 'string' ||
      Number.isNaN(Date.parse(value.expiresAt))
    )
      throw new RealtimeServiceError(
        502,
        'REALTIME_MALFORMED_RESPONSE',
        'Realtime returned an invalid response.',
      )
    return {
      accessToken: value.accessToken,
      expiresAt: value.expiresAt,
      endpoint: config.publicUrl,
    }
  },
  history(
    token: string,
    correlationId: string,
    conversationId: string,
    query: string,
  ) {
    return call(
      `/api/v1/conversations/${encodeURIComponent(conversationId)}/messages${query}`,
      token,
      correlationId,
      'GET',
    )
  },
}
