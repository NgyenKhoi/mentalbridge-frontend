import { Manrope } from 'next/font/google'
import { VideoSessionPanel } from './VideoConsultationPanel'
import { SpecialistConsultationBrief } from './SpecialistConsultationBrief'
import styles from './VideoConsultation.module.css'

const displayFont = Manrope({
  subsets: ['latin', 'vietnamese'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-video-display',
  display: 'swap',
})

export function VideoConsultationWorkspace({
  appointmentId,
  role,
}: {
  appointmentId: string
  role: 'USER' | 'SPECIALIST'
}) {
  return (
    <section
      className={`${styles.workspace} ${displayFont.variable}`}
      data-role={role}
    >
      <h1 className={styles.visuallyHidden}>Phòng tư vấn video</h1>
      <VideoSessionPanel
        key={`${role}:${appointmentId}`}
        appointmentId={appointmentId}
        role={role}
        preparation={
          role === 'SPECIALIST' ? (
            <SpecialistConsultationBrief appointmentId={appointmentId} />
          ) : undefined
        }
      />
    </section>
  )
}
