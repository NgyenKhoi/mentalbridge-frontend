import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { VideoConsultationWorkspace } from '@/features/appointments/components/VideoConsultationWorkspace'
import { requireCurrentAccount } from '@/lib/auth/dal'
import { validUuid } from '@/lib/consultation/consultation-validation'

export const metadata: Metadata = {
  title: 'Phòng tư vấn | MentalBridge',
  robots: { index: false },
}

export default async function SpecialistCallWindowPage({
  params,
  searchParams,
}: {
  params: Promise<{ appointmentId: string }>
  searchParams?: Promise<{ join?: string }>
}) {
  const account = await requireCurrentAccount(['SPECIALIST'])
  const { appointmentId } = await params
  if (!validUuid(appointmentId)) notFound()
  const autoJoin = (await searchParams)?.join === '1'
  return (
    <main key={`${account.accountId}:${appointmentId}`}>
      <VideoConsultationWorkspace
        appointmentId={appointmentId}
        role="SPECIALIST"
        callWindow
        autoJoin={autoJoin}
      />
    </main>
  )
}
