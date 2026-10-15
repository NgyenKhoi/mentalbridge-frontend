import type { SpecialistProfileInput } from '@/lib/consultation/consultation-validation'
import { profileAreaLabels, profileLanguageLabels } from './ProfileFields'
import styles from './ProfileAmendment.module.css'

export default function ProfileSnapshot({
  value,
  title,
}: {
  value: SpecialistProfileInput
  title: string
}) {
  return (
    <section className={styles.snapshot} aria-label={title}>
      <span className={styles.eyebrow}>{title}</span>
      <h2>{value.displayName}</h2>
      <p className={styles.bio}>{value.bio}</p>
      <dl>
        <div>
          <dt>Lĩnh vực hỗ trợ</dt>
          <dd>
            {value.supportAreas
              .map((area) => profileAreaLabels[area])
              .join(', ')}
          </dd>
        </div>
        <div>
          <dt>Ngôn ngữ</dt>
          <dd>
            {value.languages
              .map((language) => profileLanguageLabels[language] ?? language)
              .join(', ')}
          </dd>
        </div>
        <div>
          <dt>Kinh nghiệm</dt>
          <dd>{value.yearsOfExperience} năm</dd>
        </div>
        <div>
          <dt>Múi giờ</dt>
          <dd>{value.timezone}</dd>
        </div>
      </dl>
    </section>
  )
}
