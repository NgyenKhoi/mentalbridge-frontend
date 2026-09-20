import type { ServiceCreditAccount } from '@/lib/consultation/consultation-validation'

export class ServiceCreditsBrowserError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message)
  }
}

export const browserServiceCredits = {
  async get() {
    const response = await fetch('/api/consultation/service-credits', {
      cache: 'no-store',
      headers: { Accept: 'application/json, application/problem+json' },
    })
    const value = (await response.json()) as ServiceCreditAccount & {
      code?: string
      title?: string
    }
    if (!response.ok) {
      throw new ServiceCreditsBrowserError(
        response.status,
        value.code ?? 'CONSULTATION_DEPENDENCY_FAILED',
        value.title ?? 'Không thể tải credit tư vấn.',
      )
    }
    return value
  },
}
