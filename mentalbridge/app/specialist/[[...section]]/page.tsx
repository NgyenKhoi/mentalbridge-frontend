import RoleWorkspace from '@/components/RoleWorkspace'
import { resolveWorkspaces } from '@/features/auth/model/workspace'
import { requireCurrentAccount } from '@/lib/auth/dal'

export default async function SpecialistWorkspace({
  params,
}: PageProps<'/specialist/[[...section]]'>) {
  const account = await requireCurrentAccount(['SPECIALIST'])
  const { section } = await params
  return (
    <RoleWorkspace
      role="specialist"
      sectionKey={section?.[0] || 'dashboard'}
      workspaces={resolveWorkspaces(account.roles) ?? []}
    />
  )
}
