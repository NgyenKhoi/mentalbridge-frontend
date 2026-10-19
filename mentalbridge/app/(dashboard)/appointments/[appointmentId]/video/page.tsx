import { notFound } from 'next/navigation'
import { VideoConsultationWorkspace } from '@/features/appointments/components/VideoConsultationWorkspace'
import { requireCurrentAccount } from '@/lib/auth/dal'
import { validUuid } from '@/lib/consultation/consultation-validation'

export default async function AppointmentVideoPage({
  params,
}: {
  params: Promise<{ appointmentId: string }>
}) {
  const account = await requireCurrentAccount(['USER'])
  const { appointmentId } = await params
  if (!validUuid(appointmentId)) notFound()
  return (
    <VideoConsultationWorkspace
      key={`${account.accountId}:${appointmentId}`}
      appointmentId={appointmentId}
      role="USER"
    />
  )
}
