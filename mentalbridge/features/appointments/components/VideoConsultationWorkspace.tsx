import Link from 'next/link'
import { ArrowLeft, FileText } from 'lucide-react'
import { VideoSessionPanel } from './VideoConsultationPanel'
import { SpecialistConsultationBrief } from './SpecialistConsultationBrief'
import styles from './VideoConsultation.module.css'

export function VideoConsultationWorkspace({
  appointmentId,
  role,
}: {
  appointmentId: string
  role: 'USER' | 'SPECIALIST'
}) {
  const appointmentHref =
    role === 'USER'
      ? `/appointments/${encodeURIComponent(appointmentId)}`
      : `/specialist/appointments?appointmentId=${encodeURIComponent(appointmentId)}`
  return (
    <section className={styles.workspace} data-role={role}>
      <header className={styles.workspaceHeading}>
        <Link href={appointmentHref} className={styles.backLink}>
          <ArrowLeft size={18} aria-hidden="true" /> Trở về lịch hẹn
        </Link>
        <h1>Phòng tư vấn video</h1>
        <p>Không gian riêng cho buổi tư vấn của bạn.</p>
      </header>
      <VideoSessionPanel
        key={`${role}:${appointmentId}`}
        appointmentId={appointmentId}
        role={role}
      />
      <div className={styles.preparation}>
        {role === 'SPECIALIST' ? (
          <SpecialistConsultationBrief appointmentId={appointmentId} />
        ) : (
          <Link href={appointmentHref}>
            <FileText size={18} aria-hidden="true" /> Xem nội dung chuẩn bị
            trong lịch hẹn
          </Link>
        )}
      </div>
    </section>
  )
}
