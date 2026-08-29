import { ApiError } from '@/lib/api/api-error'
import { browserApiClient } from '@/lib/api/browser-client'

import type {
  PublicRegistrationRole,
  RegistrationRequest,
} from './identity-contract'

import {
  isUsableAccount,
  parseCurrentAccountResponse,
  primaryWorkspacePath,
  resolveWorkspaces,
} from '../model/workspace'

export type LoginCredentials = Readonly<{
  email: string
  password: string
}>

export type LogoutMode = 'current' | 'all'

export type RegistrationSubmission = Readonly<{
  email: string
  password: string
  actorType: PublicRegistrationRole
}>

const DEPENDENCY_ERROR_CODES = [
  'IDENTITY_TIMEOUT',
  'IDENTITY_UNAVAILABLE',
  'NETWORK_ERROR',
  'REQUEST_TIMEOUT',
]

function isDependencyFailure(error: unknown) {
  return (
    error instanceof ApiError && DEPENDENCY_ERROR_CODES.includes(error.code)
  )
}

function invalidSession() {
  return new ApiError({
    message: 'The authenticated account response is invalid.',
    code: 'INVALID_SESSION_ACCOUNT',
    status: 401,
  })
}

export async function loginAndResolveWorkspace(credentials: LoginCredentials) {
  await browserApiClient.post('/identity/login', credentials)

  try {
    const response = await browserApiClient.get('/identity/session')
    const account = parseCurrentAccountResponse(response.data)
    const path = account && primaryWorkspacePath(account.roles)

    if (!account || !isUsableAccount(account) || !path) {
      throw invalidSession()
    }

    return {
      account,
      path,
      workspaces: resolveWorkspaces(account.roles) ?? [],
    }
  } catch (error) {
    await browserApiClient.post('/identity/logout').catch(() => undefined)
    throw error
  }
}

export async function terminateSession(mode: LogoutMode) {
  const endpoint = mode === 'all' ? '/identity/logout-all' : '/identity/logout'
  await browserApiClient.post(endpoint)
}

export function createRegistrationIdempotencyKey() {
  return crypto.randomUUID()
}

export async function registerAccount(
  submission: RegistrationSubmission,
  idempotencyKey: string,
) {
  const request: RegistrationRequest = submission

  await browserApiClient.post('/identity/register', request, {
    headers: { 'Idempotency-Key': idempotencyKey },
  })
}

export async function verifyEmailChallenge(challenge: string) {
  await browserApiClient.post('/identity/email-verification', { challenge })
}

export function registrationErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === 'ACCOUNT_ALREADY_EXISTS') {
      return 'Email này đã được dùng cho một tài khoản. Vui lòng đăng nhập hoặc dùng email khác.'
    }
    if (error.code === 'IDEMPOTENCY_KEY_REUSED') {
      return 'Thông tin đăng ký đã thay đổi trong lần gửi lại. Vui lòng kiểm tra và thử lại.'
    }
    if (error.status === 429) {
      return 'Bạn đã thử đăng ký quá nhiều lần. Vui lòng chờ một lúc rồi thử lại.'
    }
  }

  if (isDependencyFailure(error)) {
    return 'Dịch vụ đăng ký tạm thời chưa sẵn sàng. Bạn có thể thử lại với nguyên thông tin đã nhập.'
  }

  return 'Không thể tạo tài khoản. Vui lòng kiểm tra thông tin và thử lại.'
}

export function verificationErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (
      error.code === 'INVALID_CHALLENGE' ||
      error.code === 'VALIDATION_FAILED'
    ) {
      return 'Liên kết xác minh không hợp lệ, đã hết hạn hoặc không còn đủ điều kiện sử dụng.'
    }
    if (error.status === 429) {
      return 'Có quá nhiều yêu cầu xác minh. Vui lòng chờ một lúc rồi thử lại liên kết.'
    }
  }

  if (isDependencyFailure(error)) {
    return 'Dịch vụ xác minh tạm thời chưa sẵn sàng. Vui lòng thử lại liên kết sau.'
  }

  return 'Không thể xác minh email lúc này. Vui lòng thử lại sau.'
}

export function loginErrorMessage(error: unknown) {
  if (isDependencyFailure(error)) {
    return 'Dịch vụ đăng nhập tạm thời chưa sẵn sàng. Vui lòng thử lại sau.'
  }

  return 'Không thể đăng nhập. Vui lòng kiểm tra thông tin hoặc trạng thái tài khoản.'
}
