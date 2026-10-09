import 'server-only'

import { createHash } from 'node:crypto'

import { ApiError } from '@/lib/api/api-error'
import { isProblemDetails } from '@/lib/api/problem-details'
import type {
  AccountDetail,
  AccountPage,
  AccountStateChangeRequest,
  AccountSummary,
  ChallengeRequest,
  EmailRequest,
  LoginRequest,
  RegistrationRequest,
  RegistrationResponse,
  TokenPair,
  PasswordResetRequest,
  PasswordChangeRequest,
  PlatformReport,
  PlatformReportPage,
  PlatformReportRequest,
  PlatformReportType,
  ProductJourneyMetrics,
} from '@/features/auth/api/identity-contract'
import { readIdentityServerConfig } from '@/lib/config/server'

import {
  parseAccountDetail,
  parseAccountPage,
  parseAccountSummary,
  parseRegistrationResponse,
  parseTokenPair,
  parsePlatformReport,
  parsePlatformReportCatalogue,
  parsePlatformReportPage,
  parseProductJourneyMetrics,
} from './identity-validation'

type RequestOptions<T> = Readonly<{
  method: 'GET' | 'POST' | 'PUT'
  path: string
  expectedStatus: number
  correlationId: string
  authorization?: string
  idempotencyKey?: string
  ifMatch?: string
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
        ...(options.ifMatch === undefined
          ? {}
          : { 'If-Match': options.ifMatch }),
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

async function identityArtifactRequest(
  accessToken: string,
  reportId: string,
  correlationId: string,
) {
  const config = readIdentityServerConfig()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs)
  try {
    const response = await fetch(
      upstreamUrl(
        config.baseUrl,
        `/api/v1/admin/platform-reports/${encodeURIComponent(reportId)}/artifact`,
      ),
      {
        cache: 'no-store',
        redirect: 'error',
        signal: controller.signal,
        headers: {
          Accept: 'application/json, application/problem+json',
          Authorization: `Bearer ${accessToken}`,
          'X-Correlation-Id': correlationId,
        },
      },
    )
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
    const contentLength = Number(response.headers.get('content-length'))
    if (
      !Number.isFinite(contentLength) ||
      contentLength < 1 ||
      contentLength > 1_048_576
    ) {
      throw new ApiError({
        message: 'Identity returned an invalid artifact.',
        code: 'IDENTITY_MALFORMED_RESPONSE',
        status: 502,
      })
    }
    const content = new Uint8Array(await response.arrayBuffer())
    if (content.byteLength !== contentLength) {
      throw new ApiError({
        message: 'Identity returned an invalid artifact.',
        code: 'IDENTITY_MALFORMED_RESPONSE',
        status: 502,
      })
    }
    const sha256 = response.headers.get('x-content-sha256')
    const retainedUntil = response.headers.get('x-retained-until')
    if (
      !sha256?.match(/^[0-9a-f]{64}$/) ||
      !retainedUntil ||
      Number.isNaN(Date.parse(retainedUntil))
    ) {
      throw new ApiError({
        message: 'Identity returned invalid artifact provenance.',
        code: 'IDENTITY_MALFORMED_RESPONSE',
        status: 502,
      })
    }
    const actualSha256 = createHash('sha256').update(content).digest('hex')
    if (actualSha256 !== sha256) {
      throw new ApiError({
        message: 'Identity returned an artifact with invalid integrity.',
        code: 'IDENTITY_MALFORMED_RESPONSE',
        status: 502,
      })
    }
    return {
      content,
      contentType: response.headers.get('content-type') ?? 'application/json',
      contentDisposition: response.headers.get('content-disposition'),
      sha256,
      retainedUntil,
    }
  } catch (error) {
    if (error instanceof ApiError) throw error
    const timedOut = controller.signal.aborted
    throw new ApiError({
      message: timedOut ? 'Identity timed out.' : 'Identity is unavailable.',
      code: timedOut ? 'IDENTITY_TIMEOUT' : 'IDENTITY_UNAVAILABLE',
      status: timedOut ? 504 : 503,
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

  searchAccounts(
    accessToken: string,
    params: {
      status?: string
      role?: string
      email?: string
      cursor?: string
      limit?: number
    },
    correlationId: string,
  ) {
    const query = new URLSearchParams()
    if (params.status) query.set('status', params.status)
    if (params.role) query.set('role', params.role)
    if (params.email) query.set('email', params.email)
    if (params.cursor) query.set('cursor', params.cursor)
    if (params.limit !== undefined) query.set('limit', String(params.limit))
    const queryString = query.toString()
    const path = `/api/v1/admin/accounts${queryString ? `?${queryString}` : ''}`
    return identityRequest<AccountPage>({
      method: 'GET',
      path,
      expectedStatus: 200,
      correlationId,
      authorization: accessToken,
      parseSuccess: parseAccountPage,
    })
  },

  getAccountById(
    accessToken: string,
    accountId: string,
    correlationId: string,
  ) {
    return identityRequest<AccountDetail>({
      method: 'GET',
      path: `/api/v1/admin/accounts/${encodeURIComponent(accountId)}`,
      expectedStatus: 200,
      correlationId,
      authorization: accessToken,
      parseSuccess: parseAccountDetail,
    })
  },

  changeAccountState(
    accessToken: string,
    accountId: string,
    request: AccountStateChangeRequest,
    ifMatch: string,
    correlationId: string,
  ) {
    const formattedIfMatch =
      ifMatch.startsWith('"') && ifMatch.endsWith('"')
        ? ifMatch
        : `"${ifMatch}"`
    return identityRequest<AccountDetail>({
      method: 'PUT',
      path: `/api/v1/admin/accounts/${encodeURIComponent(accountId)}/state`,
      expectedStatus: 200,
      correlationId,
      authorization: accessToken,
      ifMatch: formattedIfMatch,
      body: request,
      parseSuccess: parseAccountDetail,
    })
  },

  platformReportCatalogue(accessToken: string, correlationId: string) {
    return identityRequest<PlatformReportType[]>({
      method: 'GET',
      path: '/api/v1/admin/platform-reports/catalogue',
      expectedStatus: 200,
      correlationId,
      authorization: accessToken,
      parseSuccess: parsePlatformReportCatalogue,
    })
  },

  productJourneyMetrics(
    accessToken: string,
    params: { from: string; to: string },
    correlationId: string,
  ) {
    const query = new URLSearchParams({ from: params.from, to: params.to })
    return identityRequest<ProductJourneyMetrics>({
      method: 'GET',
      path: `/api/v1/admin/product-journey-metrics?${query.toString()}`,
      expectedStatus: 200,
      correlationId,
      authorization: accessToken,
      parseSuccess: (value) => {
        const parsed = parseProductJourneyMetrics(value)
        return parsed?.window.from === params.from &&
          parsed.window.to === params.to
          ? parsed
          : null
      },
    })
  },

  platformReportHistory(
    accessToken: string,
    params: { cursor?: string; limit?: number },
    correlationId: string,
  ) {
    const query = new URLSearchParams()
    if (params.cursor) query.set('cursor', params.cursor)
    if (params.limit !== undefined) query.set('limit', String(params.limit))
    const suffix = query.toString()
    return identityRequest<PlatformReportPage>({
      method: 'GET',
      path: `/api/v1/admin/platform-reports${suffix ? `?${suffix}` : ''}`,
      expectedStatus: 200,
      correlationId,
      authorization: accessToken,
      parseSuccess: parsePlatformReportPage,
    })
  },

  requestPlatformReport(
    accessToken: string,
    request: PlatformReportRequest,
    idempotencyKey: string,
    correlationId: string,
  ) {
    return identityRequest<PlatformReport>({
      method: 'POST',
      path: '/api/v1/admin/platform-reports',
      expectedStatus: 202,
      correlationId,
      authorization: accessToken,
      idempotencyKey,
      body: request,
      parseSuccess: parsePlatformReport,
    })
  },

  retryPlatformReport(
    accessToken: string,
    reportId: string,
    idempotencyKey: string,
    correlationId: string,
  ) {
    return identityRequest<PlatformReport>({
      method: 'POST',
      path: `/api/v1/admin/platform-reports/${encodeURIComponent(reportId)}/retries`,
      expectedStatus: 202,
      correlationId,
      authorization: accessToken,
      idempotencyKey,
      parseSuccess: parsePlatformReport,
    })
  },

  downloadPlatformReport(
    accessToken: string,
    reportId: string,
    correlationId: string,
  ) {
    return identityArtifactRequest(accessToken, reportId, correlationId)
  },
}
