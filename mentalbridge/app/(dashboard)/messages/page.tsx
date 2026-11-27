import SpecialistChatView from '@/features/appointments/components/SpecialistChatView'
import './messages.css'

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
    <div
      className="ref-still"
      data-page-motion="off"
      style={{
        width: '100%',
        height: 'calc(100dvh - 76px)',
        overflow: 'hidden',
      }}
    >
      <SpecialistChatView
        viewerRole="USER"
        initialAppointmentId={appointmentId}
      />
    </div>
  )
}
