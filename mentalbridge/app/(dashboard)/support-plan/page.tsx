import type { Metadata } from 'next'

import SupportPlanJourney from '@/features/support-plan/components/SupportPlanJourney'

export const metadata: Metadata = {
  title: 'Kế hoạch hỗ trợ — MentalBridge',
}

export default function SupportPlanPage() {
  return <SupportPlanJourney />
}
