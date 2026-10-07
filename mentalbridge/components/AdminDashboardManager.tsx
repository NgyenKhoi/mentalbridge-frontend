'use client'

import AdminOperationsDashboard from '@/features/dashboard/components/AdminOperationsDashboard'

export default function AdminDashboardManager({
  onNotice,
}: {
  onNotice: (message: string) => void
}) {
  return <AdminOperationsDashboard onNotice={onNotice} />
}
