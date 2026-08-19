import { ApiError } from '@/lib/api/api-error'
import { browserApiClient } from '@/lib/api/browser-client'

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

export function loginErrorMessage(error: unknown) {
  if (
    error instanceof ApiError &&
    [
      'IDENTITY_TIMEOUT',
      'IDENTITY_UNAVAILABLE',
      'NETWORK_ERROR',
      'REQUEST_TIMEOUT',
    ].includes(error.code)
  ) {
    return 'Dịch vụ đăng nhập tạm thời chưa sẵn sàng. Vui lòng thử lại sau.'
  }

  return 'Không thể đăng nhập. Vui lòng kiểm tra thông tin hoặc trạng thái tài khoản.'
}
