import { isAxiosError } from 'axios'

import { parseProblemDetails, type ProblemDetails } from './problem-details'

type ApiErrorOptions = Readonly<{
  message: string
  code: string
  status?: number
  correlationId?: string
  problem?: ProblemDetails
  cause?: unknown
}>

export class ApiError extends Error {
  readonly code: string
  readonly status: number | undefined
  readonly correlationId: string | undefined
  readonly problem: ProblemDetails | undefined

  constructor(options: ApiErrorOptions) {
    super(options.message, { cause: options.cause })
    this.name = 'ApiError'
    this.code = options.code
    this.status = options.status
    this.correlationId = options.correlationId
    this.problem = options.problem
  }
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error

  if (isAxiosError(error)) {
    const problem = parseProblemDetails(error.response?.data)

    if (problem) {
      return new ApiError({
        message: problem.detail ?? problem.title,
        code: problem.code,
        status: problem.status,
        correlationId: problem.correlationId,
        problem,
        cause: error,
      })
    }

    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return new ApiError({
        message: 'Yêu cầu mất quá nhiều thời gian. Vui lòng thử lại.',
        code: 'REQUEST_TIMEOUT',
        cause: error,
      })
    }

    if (!error.response) {
      return new ApiError({
        message: 'Chưa thể kết nối. Vui lòng kiểm tra mạng và thử lại.',
        code: 'NETWORK_ERROR',
        cause: error,
      })
    }

    return new ApiError({
      message: 'Chưa thể hoàn tất yêu cầu. Vui lòng thử lại.',
      code: `HTTP_${error.response.status}`,
      status: error.response.status,
      cause: error,
    })
  }

  return new ApiError({
    message: 'Đã xảy ra lỗi ngoài dự kiến. Vui lòng thử lại.',
    code: 'UNEXPECTED_ERROR',
    cause: error,
  })
}
