import AppointmentMessagesWorkspace from '@/features/appointments/components/AppointmentMessagesWorkspace'

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ appointmentId?: string | string[] }>
}) {
  const query = await searchParams
  const appointmentId = Array.isArray(query.appointmentId)
    ? query.appointmentId[0]
    : query.appointmentId
  return (
    <div className="ref-still" data-page-motion="off">
      <AppointmentMessagesWorkspace
        viewerRole="USER"
        initialAppointmentId={appointmentId}
      />
    </div>
  )
}
