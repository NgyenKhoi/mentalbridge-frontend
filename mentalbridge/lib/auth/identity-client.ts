import 'server-only'

import { ApiError } from '@/lib/api/api-error'
import { isProblemDetails } from '@/lib/api/problem-details'
import type {
  AccountDetail,
  AccountSummary,
  ChallengeRequest,
  EmailRequest,
  LoginRequest,
  RegistrationRequest,
  RegistrationResponse,
  TokenPair,
  PasswordResetRequest,
  PasswordChangeRequest,
} from '@/features/auth/api/identity-contract'
import { readIdentityServerConfig } from '@/lib/config/server'

import {
  parseAccountDetail,
  parseAccountSummary,
  parseRegistrationResponse,
  parseTokenPair,
} from './identity-validation'

type RequestOptions<T> = Readonly<{
  method: 'GET' | 'POST' | 'PUT'
  path: string
  expectedStatus: number
  correlationId: string
  authorization?: string
  idempotencyKey?: string
  body?: unknown
  parseSuccess?: (value: unknown) => T | null
  emptySuccess?: boolean
}>

const MAX_IDENTITY_RESPONSE_BYTES = 64 * 1_024

function upstreamUrl(baseUrl: string, path: string) {
  return new URL(path.replace(/^\//, ''), baseUrl)
}

async function readJson(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? ''
  const contentLength = Number(response.headers.get('content-length'))

  if (!contentType.toLowerCase().includes('json')) {
    throw new ApiError({
      message: 'Identity returned an invalid response.',
      code: 'IDENTITY_MALFORMED_RESPONSE',
      status: 502,
    })
  }

  if (
    Number.isFinite(contentLength) &&
    contentLength > MAX_IDENTITY_RESPONSE_BYTES
  ) {
    throw new ApiError({
      message: 'Identity returned an oversized response.',
      code: 'IDENTITY_MALFORMED_RESPONSE',
      status: 502,
    })
  }

  try {
    const text = await response.text()

    if (
      new TextEncoder().encode(text).byteLength > MAX_IDENTITY_RESPONSE_BYTES
    ) {
      throw new ApiError({
        message: 'Identity returned an oversized response.',
        code: 'IDENTITY_MALFORMED_RESPONSE',
        status: 502,
      })
    }

    return JSON.parse(text) as unknown
  } catch (cause) {
    if (cause instanceof ApiError) throw cause

    throw new ApiError({
      message: 'Identity returned an invalid response.',
      code: 'IDENTITY_MALFORMED_RESPONSE',
      status: 502,
      cause,
    })
  }
}

async function identityRequest<T>(options: RequestOptions<T>): Promise<T> {
  const config = readIdentityServerConfig()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs)

  try {
    const response = await fetch(upstreamUrl(config.baseUrl, options.path), {
      method: options.method,
      cache: 'no-store',
      redirect: 'error',
      signal: controller.signal,
      headers: {
        Accept: 'application/json, application/problem+json',
        'X-Correlation-Id': options.correlationId,
        ...(options.body === undefined
          ? {}
          : { 'Content-Type': 'application/json' }),
        ...(options.authorization === undefined
          ? {}
          : { Authorization: `Bearer ${options.authorization}` }),
        ...(options.idempotencyKey === undefined
          ? {}
          : { 'Idempotency-Key': options.idempotencyKey }),
      },
      ...(options.body === undefined
        ? {}
        : { body: JSON.stringify(options.body) }),
    })

    if (!response.ok) {
      const body = await readJson(response)

      if (isProblemDetails(body)) {
        throw new ApiError({
          message: body.title,
          code: body.code,
          status: response.status,
          correlationId: body.correlationId,
          problem: body,
        })
      }

      throw new ApiError({
        message: 'Identity returned an invalid error response.',
        code: 'IDENTITY_MALFORMED_RESPONSE',
        status: 502,
      })
    }

    if (response.status !== options.expectedStatus) {
      throw new ApiError({
        message: 'Identity returned an unexpected success status.',
        code: 'IDENTITY_MALFORMED_RESPONSE',
        status: 502,
      })
    }

    if (response.status === 204 || options.emptySuccess) return undefined as T

    const body = await readJson(response)
    const parsed = options.parseSuccess?.(body)

    if (parsed === null || parsed === undefined) {
      throw new ApiError({
        message: 'Identity returned an invalid response.',
        code: 'IDENTITY_MALFORMED_RESPONSE',
        status: 502,
      })
    }

    return parsed
  } catch (error) {
    if (error instanceof ApiError) throw error

    if (controller.signal.aborted) {
      throw new ApiError({
        message: 'Identity timed out.',
        code: 'IDENTITY_TIMEOUT',
        status: 504,
        cause: error,
      })
    }

    throw new ApiError({
      message: 'Identity is unavailable.',
      code: 'IDENTITY_UNAVAILABLE',
      status: 503,
      cause: error,
    })
  } finally {
    clearTimeout(timeout)
  }
}

export const identityClient = {
  register(
    request: RegistrationRequest,
    idempotencyKey: string,
    correlationId: string,
  ) {
    return identityRequest<RegistrationResponse>({
      method: 'POST',
      path: '/api/v1/auth/registrations',
      expectedStatus: 201,
      correlationId,
      idempotencyKey,
      body: request,
      parseSuccess: parseRegistrationResponse,
    })
  },

  verifyEmail(request: ChallengeRequest, correlationId: string) {
    return identityRequest<AccountSummary>({
      method: 'POST',
      path: '/api/v1/auth/email-verifications',
      expectedStatus: 200,
      correlationId,
      body: request,
      parseSuccess: parseAccountSummary,
    })
  },

  requestEmailVerification(request: EmailRequest, correlationId: string) {
    return identityRequest<void>({
      method: 'POST',
      path: '/api/v1/auth/email-verification-requests',
      expectedStatus: 202,
      correlationId,
      body: request,
      emptySuccess: true,
    })
  },

  requestPasswordRecovery(request: EmailRequest, correlationId: string) {
    return identityRequest<void>({
      method: 'POST',
      path: '/api/v1/auth/password-recovery-requests',
      expectedStatus: 202,
      correlationId,
      body: request,
      emptySuccess: true,
    })
  },

  resetPassword(request: PasswordResetRequest, correlationId: string) {
    return identityRequest<void>({
      method: 'POST',
      path: '/api/v1/auth/password-resets',
      expectedStatus: 204,
      correlationId,
      body: request,
    })
  },

  changePassword(
    accessToken: string,
    request: PasswordChangeRequest,
    correlationId: string,
  ) {
    return identityRequest<void>({
      method: 'PUT',
      path: '/api/v1/account/password',
      expectedStatus: 204,
      correlationId,
      authorization: accessToken,
      body: request,
    })
  },

  login(request: LoginRequest, correlationId: string) {
    return identityRequest<TokenPair>({
      method: 'POST',
      path: '/api/v1/auth/login',
      expectedStatus: 200,
      correlationId,
      body: request,
      parseSuccess: parseTokenPair,
    })
  },

  refresh(refreshToken: string, idempotencyKey: string, correlationId: string) {
    return identityRequest<TokenPair>({
      method: 'POST',
      path: '/api/v1/auth/refresh',
      expectedStatus: 200,
      correlationId,
      idempotencyKey,
      body: { refreshToken },
      parseSuccess: parseTokenPair,
    })
  },

  logout(accessToken: string, refreshToken: string, correlationId: string) {
    return identityRequest<void>({
      method: 'POST',
      path: '/api/v1/auth/logout',
      expectedStatus: 204,
      correlationId,
      authorization: accessToken,
      body: { refreshToken },
    })
  },

  logoutAll(accessToken: string, correlationId: string) {
    return identityRequest<void>({
      method: 'POST',
      path: '/api/v1/auth/logout-all',
      expectedStatus: 204,
      correlationId,
      authorization: accessToken,
    })
  },

  getOwnAccount(accessToken: string, correlationId: string) {
    return identityRequest<AccountDetail>({
      method: 'GET',
      path: '/api/v1/account',
      expectedStatus: 200,
      correlationId,
      authorization: accessToken,
      parseSuccess: parseAccountDetail,
    })
  },
}
