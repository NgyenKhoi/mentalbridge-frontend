import RoleWorkspace from '@/components/RoleWorkspace'
import { resolveWorkspaces } from '@/features/auth/model/workspace'
import { requireCurrentAccount } from '@/lib/auth/dal'

export default async function SpecialistWorkspace({
  params,
}: PageProps<'/specialist/[[...section]]'>) {
  const account = await requireCurrentAccount(['SPECIALIST'])
  const { section } = await params
  const appointmentChatId =
    section?.[0] === 'appointments' && section[2] === 'chat'
      ? section[1]
      : undefined
  return (
    <RoleWorkspace
      role="specialist"
      sectionKey={
        appointmentChatId ? 'appointment-chat' : section?.[0] || 'dashboard'
      }
      workspaces={resolveWorkspaces(account.roles) ?? []}
      appointmentChatId={appointmentChatId}
    />
  )
}
