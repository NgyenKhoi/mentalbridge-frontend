'use client'

import { useEffect, useState } from 'react'

import { Disclosure } from '@/components/ui/Disclosure'
import { Skeleton } from '@/components/ui/Skeleton'
import type {
  ScreeningLevel,
  SupportEvaluation,
  SupportTier,
} from '@/features/assessment/api/care-contract'
import { getSupportEvaluationHistory } from '@/features/assessment/api/browser-care'

import styles from './SupportEvaluationHistory.module.css'

const tierLabels: Record<SupportTier, string> = {
  SELF_GUIDED_SUPPORT: 'Có thể bắt đầu với hỗ trợ tự hướng dẫn',
  PROFESSIONAL_SUPPORT_RECOMMENDED: 'Nên cân nhắc hỗ trợ từ chuyên gia',
  SAFETY_FOLLOW_UP_RECOMMENDED: 'Ưu tiên hướng dẫn an toàn và hỗ trợ trực tiếp',
}

const levelLabels: Record<ScreeningLevel, string> = {
  MINIMAL: 'Tối thiểu',
  MILD: 'Nhẹ',
  MODERATE: 'Trung bình',
  MODERATELY_SEVERE: 'Khá nặng',
  SEVERE: 'Nặng',
}

export function SupportEvaluationHistory() {
  const [items, setItems] = useState<SupportEvaluation[]>([])
  const [cursor, setCursor] = useState<string>()
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = async (next?: string) => {
    setLoading(true)
    setError(false)
    try {
      const page = await getSupportEvaluationHistory(next)
      setItems((current) => (next ? [...current, ...page.items] : page.items))
      setCursor(page.nextCursor ?? undefined)
      setHasMore(page.hasMore)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [])

  return (
    <section className={styles.history} aria-labelledby="support-history-title">
      <header className={styles.heading}>
        <div>
          <span>Kết quả tổng hợp</span>
          <h2 id="support-history-title">Các bài tổng hợp đã lưu</h2>
        </div>
        <p>
          Mở lại hướng hỗ trợ, diễn giải PHQ-9 và GAD-7, cùng bước tiếp theo của
          từng lần kiểm tra ban đầu.
        </p>
      </header>

      {error ? (
        <div className={styles.state} role="alert">
          <strong>Chưa thể tải các bài tổng hợp</strong>
          <p>Kết quả đã lưu không bị mất. Bạn có thể thử tải lại.</p>
          <button type="button" onClick={() => void load()}>
            Thử lại
          </button>
        </div>
      ) : items.length === 0 && !loading ? (
        <div className={styles.state}>
          <strong>Chưa có bài tổng hợp</strong>
          <p>
            Hoàn thành kiểm tra ban đầu gồm PHQ-9 và GAD-7 để nhận một hướng hỗ
            trợ tổng thể.
          </p>
        </div>
      ) : (
        <div className={styles.list}>
          {items.map((item) => {
            const evaluatedAt = new Date(item.evaluatedAt).toLocaleString(
              'vi-VN',
            )
            return (
              <Disclosure
                className={styles.summary}
                contentClassName={styles.disclosureContent}
                key={item.supportEvaluationId}
                summaryLabel={`Xem bài tổng hợp ngày ${evaluatedAt}`}
                summary={
                  <div className={styles.summaryLead}>
                    <time dateTime={item.evaluatedAt}>{evaluatedAt}</time>
                    <h3>{tierLabels[item.supportTier]}</h3>
                    <p>
                      Được tổng hợp từ PHQ-9 và GAD-7 trong cùng lượt kiểm tra.
                    </p>
                  </div>
                }
                meta={
                  <span className={styles.summaryAction} aria-hidden="true">
                    <span className={styles.openLabel}>Xem bài tổng hợp</span>
                    <span className={styles.closeLabel}>Thu gọn</span>
                  </span>
                }
              >
                <EvaluationDetails item={item} />
              </Disclosure>
            )
          })}
        </div>
      )}

      {loading && (
        <div className={styles.loading} role="status" aria-live="polite">
          <span className="sr-only">Đang tải các bài tổng hợp…</span>
          <Skeleton width="42%" height={18} />
          <Skeleton width="100%" height={92} />
        </div>
      )}
      {hasMore && !loading && (
        <button
          className={styles.loadMore}
          type="button"
          onClick={() => void load(cursor)}
        >
          Tải thêm bài tổng hợp
        </button>
      )}
    </section>
  )
}

function EvaluationDetails({ item }: Readonly<{ item: SupportEvaluation }>) {
  return (
    <article className={styles.details}>
      <header>
        <span>Hướng hỗ trợ tổng thể</span>
        <h3>{tierLabels[item.supportTier]}</h3>
        <p>
          Đây không phải điểm số chung. MentalBridge xem riêng hai bài sàng lọc
          và thông tin an toàn để gợi ý mức hỗ trợ phù hợp hơn.
        </p>
      </header>

      <div className={styles.meanings}>
        {item.evidence.map((evidence) => (
          <section key={evidence.instrument}>
            <header>
              <h4>
                {evidence.instrument === 'PHQ9'
                  ? 'PHQ-9 · Dấu hiệu liên quan tâm trạng'
                  : 'GAD-7 · Dấu hiệu lo âu'}
              </h4>
              <span>{levelLabels[evidence.screeningLevel]}</span>
            </header>
            <p>{evidence.meaning.text}</p>
            <small>{evidence.meaning.limitation}</small>
          </section>
        ))}
      </div>

      {item.safetyGuidance && (
        <aside className={styles.safety}>
          <strong>Thông tin an toàn cần ưu tiên</strong>
          <p>{item.safetyGuidance}</p>
        </aside>
      )}

      <section className={styles.nextStep}>
        <span>Bước tiếp theo</span>
        <h4>Một lựa chọn bạn có thể cân nhắc</h4>
        <p>{item.nextStep.text}</p>
        <small>{item.nextStep.boundary}</small>
      </section>

      <aside className={styles.disclaimer}>
        <strong>Sàng lọc không phải chẩn đoán</strong>
        <p>{item.disclaimer}</p>
      </aside>
    </article>
  )
}
