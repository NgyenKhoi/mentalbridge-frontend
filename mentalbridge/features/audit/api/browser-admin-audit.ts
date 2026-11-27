import { browserApiClient } from '@/lib/api/browser-client'
import type {
  AdministrationAuditEventPage,
  AuditActorType,
  AuditDomain,
  AuditResult,
  AuditSourceService,
} from '@/features/auth/api/identity-contract'

export type AuditSearch = Readonly<{
  from?: string
  to?: string
  sourceService?: AuditSourceService
  domain?: AuditDomain
  actorType?: AuditActorType
  action?: string
  result?: AuditResult
  targetIdentifier?: string
  cursor?: string
  limit?: number
}>

export const browserAdminAudit = {
  async browse(params: AuditSearch) {
    const response = await browserApiClient.get<AdministrationAuditEventPage>(
      '/admin/audit',
      { params },
    )
    return response.data
  },

  async exportCsv(params: Omit<AuditSearch, 'cursor' | 'limit'>) {
    const response = await browserApiClient.get<Blob>('/admin/audit/export', {
      params,
      responseType: 'blob',
      headers: { Accept: 'text/csv' },
    })
    const disposition = String(response.headers['content-disposition'] ?? '')
    const filename =
      /filename="?([A-Za-z0-9._-]+)"?/.exec(disposition)?.[1] ??
      'mentalbridge-audit.csv'
    const url = URL.createObjectURL(response.data)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    anchor.click()
    URL.revokeObjectURL(url)
  },
}
