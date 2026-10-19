import { notFound } from 'next/navigation'
import RoleWorkspace from '@/components/RoleWorkspace'
import { resolveWorkspaces } from '@/features/auth/model/workspace'
import { requireCurrentAccount } from '@/lib/auth/dal'
import { validUuid } from '@/lib/consultation/consultation-validation'

export default async function SpecialistVideoPage({
  params,
}: {
  params: Promise<{ appointmentId: string }>
}) {
  const account = await requireCurrentAccount(['SPECIALIST'])
  const { appointmentId } = await params
  if (!validUuid(appointmentId)) notFound()
  return (
    <RoleWorkspace
      key={`${account.accountId}:${appointmentId}`}
      role="specialist"
      sectionKey="appointments"
      workspaces={resolveWorkspaces(account.roles) ?? []}
      videoAppointmentId={appointmentId}
    />
  )
}
