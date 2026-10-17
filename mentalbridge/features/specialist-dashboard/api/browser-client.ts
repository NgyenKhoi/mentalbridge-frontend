import { browserApiClient } from '@/lib/api/browser-client'
import type { SpecialistDashboard } from '@/lib/consultation/consultation-validation'

export const specialistDashboardBrowserClient = {
  async get() {
    return (
      await browserApiClient.get<SpecialistDashboard>(
        '/consultation/specialist/dashboard',
      )
    ).data
  },
}
