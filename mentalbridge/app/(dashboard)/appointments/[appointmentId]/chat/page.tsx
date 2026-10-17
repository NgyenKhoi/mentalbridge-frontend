import { redirect } from 'next/navigation'

export default async function AppointmentChatPage({
  params,
}: {
  params: Promise<{ appointmentId: string }>
}) {
  const { appointmentId } = await params
  redirect(`/messages?appointmentId=${encodeURIComponent(appointmentId)}`)
}
