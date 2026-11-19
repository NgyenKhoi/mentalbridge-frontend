import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { VideoConsultationWorkspace } from '@/features/appointments/components/VideoConsultationWorkspace'
import { requireCurrentAccount } from '@/lib/auth/dal'
import { validUuid } from '@/lib/consultation/consultation-validation'

export const metadata: Metadata = {
  title: 'Phòng tư vấn | MentalBridge',
  robots: { index: false },
}

export default async function UserCallWindowPage({
  params,
  searchParams,
}: {
  params: Promise<{ appointmentId: string }>
  searchParams?: Promise<{ join?: string }>
}) {
  const account = await requireCurrentAccount(['USER'])
  const { appointmentId } = await params
  if (!validUuid(appointmentId)) notFound()
  const autoJoin = (await searchParams)?.join === '1'
  return (
    <main key={`${account.accountId}:${appointmentId}`}>
      <VideoConsultationWorkspace
        appointmentId={appointmentId}
        role="USER"
        callWindow
        autoJoin={autoJoin}
      />
    </main>
  )
}
