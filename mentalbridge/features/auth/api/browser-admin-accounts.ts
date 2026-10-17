import { browserApiClient } from '@/lib/api/browser-client'
import type {
  AccountDetail,
  AccountPage,
  AccountStateChangeRequest,
  AccountStatus,
  IdentityRole,
} from './identity-contract'

export type AccountSearch = Readonly<{
  status?: AccountStatus
  role?: IdentityRole
  email?: string
  cursor?: string
  limit?: number
}>

export const browserAdminAccounts = {
  async search(params: AccountSearch) {
    const response = await browserApiClient.get<AccountPage>(
      '/admin/accounts',
      {
        params,
      },
    )
    return response.data
  },

  async detail(accountId: string) {
    const response = await browserApiClient.get<AccountDetail>(
      `/admin/accounts/${encodeURIComponent(accountId)}`,
    )
    return { data: response.data, etag: response.headers.etag as string }
  },

  async changeState(
    accountId: string,
    request: AccountStateChangeRequest,
    etag: string,
  ) {
    const response = await browserApiClient.put<AccountDetail>(
      `/admin/accounts/${encodeURIComponent(accountId)}/state`,
      request,
      { headers: { 'If-Match': etag } },
    )
    return { data: response.data, etag: response.headers.etag as string }
  },
}
