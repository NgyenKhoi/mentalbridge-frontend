import AppointmentRequestPanel from '@/features/appointments/components/AppointmentRequestPanel'

export default async function AppointmentDetailPage({
  params,
}: {
  params: Promise<{ appointmentId: string }>
}) {
  const { appointmentId } = await params
  return <AppointmentRequestPanel focusAppointmentId={appointmentId} />
}
