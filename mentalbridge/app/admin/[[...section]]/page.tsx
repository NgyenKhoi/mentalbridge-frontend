import { notFound } from 'next/navigation'

import AdminWorkspaceShell, {
  isAdminSection,
} from '@/features/auth/components/AdminWorkspace'
import { resolveWorkspaces } from '@/features/auth/model/workspace'
import { requireCurrentAccount } from '@/lib/auth/dal'

export default async function AdminWorkspace({
  params,
}: {
  params: Promise<{ section?: string[] }>
}) {
  const account = await requireCurrentAccount(['ADMIN'])
  const { section } = await params
  const sectionKey = section?.[0] || 'dashboard'

  if (!isAdminSection(sectionKey)) notFound()

  return (
    <AdminWorkspaceShell
      section={sectionKey}
      workspaces={resolveWorkspaces(account.roles) ?? []}
    />
  )
}
