import RoleWorkspace from '@/components/RoleWorkspace'
import { resolveWorkspaces } from '@/features/auth/model/workspace'
import { requireCurrentAccount } from '@/lib/auth/dal'
import { redirect } from 'next/navigation'

export default async function SpecialistWorkspace({
  params,
  searchParams,
}: PageProps<'/specialist/[[...section]]'>) {
  const account = await requireCurrentAccount(['SPECIALIST'])
  const { section } = await params
  const query = await searchParams
  const appointmentChatId =
    section?.[0] === 'appointments' && section[2] === 'chat'
      ? section[1]
      : undefined
  if (appointmentChatId) {
    redirect(
      `/specialist/messages?appointmentId=${encodeURIComponent(appointmentChatId)}`,
    )
  }
  const requestedAppointmentId = query.appointmentId
  const selectedAppointmentId = Array.isArray(requestedAppointmentId)
    ? requestedAppointmentId[0]
    : requestedAppointmentId
  return (
    <RoleWorkspace
      role="specialist"
      sectionKey={section?.[0] || 'dashboard'}
      workspaces={resolveWorkspaces(account.roles) ?? []}
      selectedAppointmentId={selectedAppointmentId}
    />
  )
}
