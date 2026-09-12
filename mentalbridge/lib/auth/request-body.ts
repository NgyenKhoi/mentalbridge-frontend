import 'server-only'

import type { ValidationViolation } from './identity-validation'

const MAX_AUTH_BODY_BYTES = 4_096

export class RequestBodyError extends Error {
  readonly status: number
  readonly code: string
  readonly violations?: readonly ValidationViolation[]

  constructor(
    status: number,
    code: string,
    message: string,
    violations?: readonly ValidationViolation[],
  ) {
    super(message)
    this.name = 'RequestBodyError'
    this.status = status
    this.code = code
    this.violations = violations
  }
}

export async function readBoundedJson(
  request: Request,
  maxBytes = MAX_AUTH_BODY_BYTES,
): Promise<unknown> {
  const contentType = request.headers.get('content-type')?.toLowerCase() ?? ''

  if (!contentType.startsWith('application/json')) {
    throw new RequestBodyError(
      415,
      'UNSUPPORTED_MEDIA_TYPE',
      'Content-Type must be application/json.',
    )
  }

  const contentLength = Number(request.headers.get('content-length'))

  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new RequestBodyError(
      413,
      'PAYLOAD_TOO_LARGE',
      'Request body is too large.',
    )
  }

  const text = await request.text()

  if (new TextEncoder().encode(text).byteLength > maxBytes) {
    throw new RequestBodyError(
      413,
      'PAYLOAD_TOO_LARGE',
      'Request body is too large.',
    )
  }

  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new RequestBodyError(
      400,
      'INVALID_JSON',
      'Request body must be valid JSON.',
    )
  }
}
