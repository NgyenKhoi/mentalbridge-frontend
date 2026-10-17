import type { Metadata } from 'next'

import type { SafetyDirectoryTrigger } from '@/features/assessment/api/care-contract'
import SafetyDirectoryFlow from '@/features/safety-directory/components/SafetyDirectoryFlow'

export const metadata: Metadata = {
  title: 'Hỗ trợ an toàn theo khu vực | MentalBridge',
}

export default async function SafetyDirectoryPage({
  searchParams,
}: {
  searchParams: Promise<{ trigger?: string | string[] }>
}) {
  const query = await searchParams
  const trigger: SafetyDirectoryTrigger =
    query.trigger === 'positive-item-9' ? 'POSITIVE_ITEM_9' : 'HELP_NOW'

  return <SafetyDirectoryFlow trigger={trigger} />
}
