'use client'

import Link from 'next/link'
import { ArrowLeft, FileWarning } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { ApiError } from '@/lib/api/api-error'
import { getCombinedScreeningMeaning } from '../api/browser-care'
import type { CombinedScreeningMeaning } from '../api/care-contract'
import { CombinedMeaningCard } from './CombinedMeaningCard'
import { MamAnLoadingState } from './MamAnLoadingState'

import styles from './HistoricalCombinedMeaning.module.css'

function message(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401)
      return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại để xem kết quả.'
    if (error.status === 404)
      return 'Không tìm thấy kết quả sàng lọc thuộc tài khoản này.'
    if (error.code === 'COMBINED_SCREENING_MEANING_UNAVAILABLE')
      return 'Bản ghi này thiếu dữ liệu tương thích để hiển thị ý nghĩa tổng hợp. MentalBridge không ghép kết quả từ những lần làm khác.'
    if (
      ['CARE_TIMEOUT', 'CARE_UNAVAILABLE', 'NETWORK_ERROR'].includes(error.code)
    )
      return 'Dịch vụ tạm thời chưa sẵn sàng. Kết quả đã lưu không bị thay đổi.'
  }
  return 'Không thể tải kết quả sàng lọc lúc này. Vui lòng thử lại.'
}

export function HistoricalCombinedMeaning({
  supportEvaluationId,
}: Readonly<{ supportEvaluationId: string }>) {
  const [meaning, setMeaning] = useState<CombinedScreeningMeaning>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>()
  const requestRef = useRef<AbortController | null>(null)

  const load = useCallback(async () => {
    requestRef.current?.abort()
    const controller = new AbortController()
    requestRef.current = controller
    setLoading(true)
    setError(undefined)
    try {
      const nextMeaning = await getCombinedScreeningMeaning(
        supportEvaluationId,
        controller.signal,
      )
      if (controller.signal.aborted) return
      setMeaning(nextMeaning)
    } catch (cause) {
      if (controller.signal.aborted) return
      setMeaning(undefined)
      setError(message(cause))
    } finally {
      if (!controller.signal.aborted) setLoading(false)
      if (requestRef.current === controller) requestRef.current = null
    }
  }, [supportEvaluationId])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => {
      window.clearTimeout(timer)
      requestRef.current?.abort()
    }
  }, [load])

  if (loading) {
    return (
      <main className={styles.page}>
        <MamAnLoadingState
          title="Đang mở đúng kết quả đã lưu"
          description="Mầm An đang đối chiếu cặp PHQ-9 và GAD-7 của lượt này."
          headingLevel="h1"
          preview="meaning"
        />
      </main>
    )
  }

  if (error || !meaning) {
    return (
      <main className={styles.page}>
        <section className={styles.error} role="alert">
          <FileWarning aria-hidden="true" />
          <h1>Chưa thể mở kết quả này</h1>
          <p>{error}</p>
          <div>
            <button type="button" onClick={() => void load()}>
              Thử lại
            </button>
            <Link href="/assessments">
              <ArrowLeft aria-hidden="true" /> Quay lại lịch sử
            </Link>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className={styles.page}>
      <CombinedMeaningCard meaning={meaning} historical />
    </main>
  )
}
