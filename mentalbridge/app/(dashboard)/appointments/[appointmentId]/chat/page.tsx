import AppointmentChatPanel from '@/features/appointments/components/AppointmentChatPanel'

export default async function AppointmentChatPage({
  params,
}: {
  params: Promise<{ appointmentId: string }>
}) {
  const { appointmentId } = await params
  return <AppointmentChatPanel appointmentId={appointmentId} />
}
