import { browserApiClient } from '@/lib/api/browser-client'
import type {
  SpecialistDiscoveryItem,
  SpecialistDiscoveryPage,
} from '@/lib/consultation/consultation-validation'

export type DiscoveryFilters = Readonly<{
  supportArea?: 'DEPRESSIVE_SYMPTOMS' | 'ANXIETY_SYMPTOMS'
  language?: 'vi' | 'en'
  timezone?: string
  modality?: 'IN_APP_CHAT' | 'IN_APP_VIDEO'
  cursor?: string
}>

function query(filters: DiscoveryFilters) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters))
    if (value) params.set(key, value)
  return params.size ? `?${params.toString()}` : ''
}

export const specialistDiscoveryBrowserClient = {
  async list(filters: DiscoveryFilters = {}) {
    return (
      await browserApiClient.get<SpecialistDiscoveryPage>(
        `/consultation/specialists${query(filters)}`,
      )
    ).data
  },
  async detail(
    specialistAccountId: string,
    filters: Omit<DiscoveryFilters, 'supportArea' | 'cursor'> = {},
  ) {
    return (
      await browserApiClient.get<SpecialistDiscoveryItem>(
        `/consultation/specialists/${encodeURIComponent(specialistAccountId)}${query(filters)}`,
      )
    ).data
  },
}
