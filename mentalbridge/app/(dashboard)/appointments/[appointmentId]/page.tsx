import AppointmentRequestPanel from '@/features/appointments/components/AppointmentRequestPanel'
import { requireCurrentAccount } from '@/lib/auth/dal'

export default async function AppointmentDetailPage({
  params,
}: {
  params: Promise<{ appointmentId: string }>
}) {
  const { appointmentId } = await params
  const account = await requireCurrentAccount(['USER'])
  return (
    <AppointmentRequestPanel
      key={`${account.accountId}:${appointmentId}`}
      focusAppointmentId={appointmentId}
    />
  )
}
