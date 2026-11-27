import { Manrope } from 'next/font/google'
import { VideoSessionPanel } from './VideoConsultationPanel'
import { SessionNotesPanel } from './SessionNotesPanel'
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
  callWindow = false,
  autoJoin = false,
}: {
  appointmentId: string
  role: 'USER' | 'SPECIALIST'
  /** Standalone call window (no app shell): joins here and adds specialist notes. */
  callWindow?: boolean
  autoJoin?: boolean
}) {
  return (
    <section
      className={`${styles.workspace} ${displayFont.variable}`}
      data-role={role}
      data-call-window={callWindow || undefined}
    >
      <h1 className={styles.visuallyHidden}>Phòng tư vấn video</h1>
      <div className={styles.callLayout}>
        <VideoSessionPanel
          key={`${role}:${appointmentId}`}
          appointmentId={appointmentId}
          role={role}
          callWindow={callWindow}
          autoJoin={autoJoin}
          preparation={
            role === 'SPECIALIST' ? (
              <SpecialistConsultationBrief appointmentId={appointmentId} />
            ) : undefined
          }
        />
        {callWindow && role === 'SPECIALIST' && (
          <SessionNotesPanel appointmentId={appointmentId} />
        )}
      </div>
    </section>
  )
}
