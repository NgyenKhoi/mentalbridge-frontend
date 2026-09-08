import axios from 'axios'

import { isProblemDetails, type ProblemDetails } from './problem-details'

type ApiErrorOptions = {
  message: string
  code: string
  status?: number
  correlationId?: string
  problem?: ProblemDetails
  retryAfterSeconds?: number
  cause?: unknown
}

export class ApiError extends Error {
  readonly code: string
  readonly status?: number
  readonly correlationId?: string
  readonly problem?: ProblemDetails
  readonly retryAfterSeconds?: number

  constructor(options: ApiErrorOptions) {
    super(options.message, { cause: options.cause })
    this.name = 'ApiError'
    this.code = options.code
    this.status = options.status
    this.correlationId = options.correlationId
    this.problem = options.problem
    this.retryAfterSeconds = options.retryAfterSeconds
  }
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error

  if (axios.isAxiosError(error)) {
    const problem = error.response?.data

    if (isProblemDetails(problem)) {
      return new ApiError({
        message: problem.detail ?? problem.title,
        code: problem.code,
        status: problem.status,
        correlationId: problem.correlationId,
        problem,
        retryAfterSeconds: parseRetryAfter(
          error.response?.headers?.['retry-after'],
        ),
        cause: error,
      })
    }

    if (error.code === 'ECONNABORTED') {
      return new ApiError({
        message: 'The request timed out.',
        code: 'REQUEST_TIMEOUT',
        cause: error,
      })
    }

    if (!error.response) {
      return new ApiError({
        message: 'The service is unavailable.',
        code: 'NETWORK_ERROR',
        cause: error,
      })
    }

    return new ApiError({
      message: 'The service returned an unexpected response.',
      code: `HTTP_${error.response.status}`,
      status: error.response.status,
      cause: error,
    })
  }

  return new ApiError({
    message: 'An unexpected error occurred.',
    code: 'UNEXPECTED_ERROR',
    cause: error,
  })
}

function parseRetryAfter(value: unknown) {
  const seconds = typeof value === 'string' ? Number(value) : Number.NaN
  return Number.isInteger(seconds) && seconds > 0 ? seconds : undefined
}
