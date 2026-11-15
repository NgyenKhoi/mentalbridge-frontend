import { notFound, redirect } from 'next/navigation'

import AdminWorkspaceShell from '@/features/auth/components/AdminWorkspace'
import { isAdminSection } from '@/features/auth/model/admin-sections'
import { resolveWorkspaces } from '@/features/auth/model/workspace'
import { requireCurrentAccount } from '@/lib/auth/dal'

export default async function AdminWorkspace({
  params,
}: PageProps<'/admin/[[...section]]'>) {
  const account = await requireCurrentAccount(['ADMIN'])
  const { section } = await params
  const sectionKey = section?.[0] || 'dashboard'

  if (
    sectionKey === 'audit' ||
    sectionKey === 'reconciliation' ||
    sectionKey === 'reports' ||
    sectionKey === 'retention'
  ) {
    redirect('/admin/dashboard')
  }

  if (!isAdminSection(sectionKey)) notFound()

  return (
    <AdminWorkspaceShell
      section={sectionKey}
      workspaces={resolveWorkspaces(account.roles) ?? []}
    />
  )
}
