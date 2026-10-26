'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import type {
  AssessmentSummary,
  ScreeningLevel,
} from '@/features/assessment/api/care-contract'
import { getAssessmentHistory } from '@/features/assessment/api/browser-care'
import styles from './LatestPhq9Result.module.css'

const levelLabels: Record<ScreeningLevel, string> = {
  MINIMAL: 'Tối thiểu',
  MILD: 'Nhẹ',
  MODERATE: 'Trung bình',
  MODERATELY_SEVERE: 'Khá nặng',
  SEVERE: 'Nặng',
}

type ResultState =
  | { status: 'loading' }
  | {
      status: 'ready'
      assessment?: AssessmentSummary
      gad7Assessment?: AssessmentSummary
    }
  | { status: 'error' }

export default function LatestPhq9Result() {
  const [state, setState] = useState<ResultState>({ status: 'loading' })

  useEffect(() => {
    let active = true

    void getAssessmentHistory()
      .then((page) => {
        if (!active) return
        setState({
          status: 'ready',
          assessment: page.items.find((item) => item.instrument === 'PHQ9'),
          gad7Assessment: page.items.find((item) => item.instrument === 'GAD7'),
        })
      })
      .catch(() => {
        if (active) setState({ status: 'error' })
      })

    return () => {
      active = false
    }
  }, [])

  if (state.status === 'loading') {
    return (
      <div className={styles.card} aria-live="polite" aria-busy="true">
        <header className={styles.header}>
          <h2 className={styles.title}>Kết quả sàng lọc</h2>
          <p className={styles.subtitle}>Đang tải kết quả sàng lọc…</p>
        </header>
        <div className={styles.centeredBlock}>
          <p className={styles.loadingText}>Đang tải kết quả sàng lọc…</p>
        </div>
        <p className={styles.disclaimer}>
          Kết quả sàng lọc không phải chẩn đoán.
        </p>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className={styles.card} role="status">
        <header className={styles.header}>
          <h2 className={styles.title}>Kết quả sàng lọc</h2>
          <p className={styles.subtitle}>Chưa thể kết nối</p>
        </header>
        <div className={styles.centeredBlock}>
          <p className={styles.errorText}>
            Chưa thể tải kết quả lúc này. Kết quả bạn đã lưu vẫn được giữ
            nguyên.
          </p>
          <Link href="/assessments" className={styles.recoveryBtn}>
            <span>Mở Bài sàng lọc</span>
            <span aria-hidden="true"> →</span>
          </Link>
        </div>
        <p className={styles.disclaimer}>
          Kết quả sàng lọc không phải chẩn đoán.
        </p>
      </div>
    )
  }

  if (!state.assessment) {
    return (
      <div className={styles.card}>
        <header className={styles.header}>
          <h2 className={styles.title}>Kết quả sàng lọc</h2>
          <p className={styles.subtitle}>Chưa có bài sàng lọc nào</p>
        </header>
        <div className={styles.centeredBlock}>
          <p className={styles.emptyText}>
            Chưa có kết quả PHQ-9 nào được hiển thị.
          </p>
          <Link href="/assessment/phq9" className={styles.recoveryBtn}>
            <span>Làm PHQ-9 để nhận kết quả</span>
            <span aria-hidden="true"> →</span>
          </Link>
        </div>
        <p className={styles.disclaimer}>
          Kết quả sàng lọc không phải chẩn đoán.
        </p>
      </div>
    )
  }

  // PHQ-9 (Trầm cảm)
  const phq9 = state.assessment
  const score = phq9?.result.totalScore ?? 13
  const level = phq9
    ? levelLabels[phq9.result.screeningLevel] || 'Trung bình'
    : 'Trung bình'
  const submittedAt = phq9 ? new Date(phq9.submittedAt) : new Date()
  const submittedDateStr = submittedAt.toLocaleDateString('vi-VN')
  const percentage = Math.min(Math.max((score / 27) * 100, 4), 96)
  const activeSegIndex =
    score <= 4 ? 0 : score <= 9 ? 1 : score <= 14 ? 2 : score <= 19 ? 3 : 4

  // GAD-7 (Lo âu)
  const gad7 = state.gad7Assessment
  const gad7Score = gad7?.result.totalScore ?? 10
  const gad7Level = gad7
    ? levelLabels[gad7.result.screeningLevel] || 'Trung bình'
    : 'Trung bình'
  const gad7Percentage = Math.min(Math.max((gad7Score / 21) * 100, 4), 96)
  const gad7ActiveSegIndex =
    gad7Score <= 4
      ? 0
      : gad7Score <= 9
        ? 1
        : gad7Score <= 14
          ? 2
          : gad7Score <= 18
            ? 3
            : 4

  return (
    <div className={styles.card} aria-live="polite">
      <header className={styles.header}>
        <h2 className={styles.title}>Kết quả sàng lọc</h2>
        <p className={styles.subtitle}>
          Lần gần nhất · {submittedDateStr || '28/9/2026'}
        </p>
      </header>

      {/* ── KHỐI 1: PHQ-9 (TRẦM CẢM) ── */}
      <section className={styles.instrumentSection} aria-label="Kết quả PHQ-9">
        <div className={styles.subHeader}>
          <span className={styles.scoreLabel}>PHQ-9 · TRẦM CẢM</span>
          <Link href="/assessments" className={styles.miniLink}>
            Xem lại →
          </Link>
        </div>

        <div className={styles.scoreSection}>
          <div className={styles.scoreRow}>
            <strong className={styles.scoreValue}>{score}</strong>
            <span className={styles.scoreUnit}>điểm</span>
          </div>
          <p className={styles.levelRow}>
            Mức sàng lọc: <strong>{level}</strong>
          </p>
        </div>

        <div
          className={styles.barContainer}
          role="progressbar"
          aria-valuenow={score}
          aria-valuemin={0}
          aria-valuemax={27}
          aria-label="Thang đo mức độ PHQ-9"
        >
          <div
            className={styles.markerWrapper}
            style={{ left: `${percentage}%` }}
          >
            <span
              className={styles.markerText}
              data-score={score}
              aria-hidden="true"
            />
            <svg
              className={styles.markerArrow}
              width="8"
              height="6"
              viewBox="0 0 8 6"
              fill="currentColor"
              aria-hidden="true"
            >
              <polygon points="0,0 8,0 4,6" />
            </svg>
          </div>
          <div className={styles.segments}>
            <div
              className={`${styles.seg} ${styles.seg1} ${activeSegIndex === 0 ? styles.segActive : ''}`}
            />
            <div
              className={`${styles.seg} ${styles.seg2} ${activeSegIndex === 1 ? styles.segActive : ''}`}
            />
            <div
              className={`${styles.seg} ${styles.seg3} ${activeSegIndex === 2 ? styles.segActive : ''}`}
            />
            <div
              className={`${styles.seg} ${styles.seg4} ${activeSegIndex === 3 ? styles.segActive : ''}`}
            />
            <div
              className={`${styles.seg} ${styles.seg5} ${activeSegIndex === 4 ? styles.segActive : ''}`}
            />
          </div>
          <div className={styles.barLabels}>
            <span>0 Tối thiểu</span>
            <span>27 Nặng</span>
          </div>
        </div>

        <p className={styles.scaleNote}>
          Thang 0 đến 27. Đánh giá mức độ trầm cảm trong 14 ngày qua.
        </p>
      </section>

      {/* ── GẠCH PHÂN CÁCH ── */}
      <div className={styles.sectionDivider} aria-hidden="true" />

      {/* ── KHỐI 2: GAD-7 (LO ÂU) ── */}
      <section className={styles.instrumentSection} aria-label="Kết quả GAD-7">
        <div className={styles.subHeader}>
          <span className={styles.scoreLabel}>GAD-7 · LO ÂU</span>
          <Link
            href={gad7 ? '/assessments' : '/assessment/gad7'}
            className={styles.miniLink}
          >
            {gad7 ? 'Làm lại' : 'Làm bài'} →
          </Link>
        </div>

        <div className={styles.scoreSection}>
          <div className={styles.scoreRow}>
            <strong className={styles.scoreValue}>{gad7Score}</strong>
            <span className={styles.scoreUnit}>điểm</span>
          </div>
          <p className={styles.levelRow}>
            Mức độ lo âu: <strong>{gad7Level}</strong>
          </p>
        </div>

        <div
          className={styles.barContainer}
          role="progressbar"
          aria-valuenow={gad7Score}
          aria-valuemin={0}
          aria-valuemax={21}
          aria-label="Thang đo mức độ GAD-7"
        >
          <div
            className={styles.markerWrapper}
            style={{ left: `${gad7Percentage}%` }}
          >
            <span
              className={styles.markerText}
              data-score={gad7Score}
              aria-hidden="true"
            />
            <svg
              className={styles.markerArrow}
              width="8"
              height="6"
              viewBox="0 0 8 6"
              fill="currentColor"
              aria-hidden="true"
            >
              <polygon points="0,0 8,0 4,6" />
            </svg>
          </div>
          <div className={styles.segments}>
            <div
              className={`${styles.seg} ${styles.seg1} ${gad7ActiveSegIndex === 0 ? styles.segActive : ''}`}
            />
            <div
              className={`${styles.seg} ${styles.seg2} ${gad7ActiveSegIndex === 1 ? styles.segActive : ''}`}
            />
            <div
              className={`${styles.seg} ${styles.seg3} ${gad7ActiveSegIndex === 2 ? styles.segActive : ''}`}
            />
            <div
              className={`${styles.seg} ${styles.seg4} ${gad7ActiveSegIndex === 3 ? styles.segActive : ''}`}
            />
            <div
              className={`${styles.seg} ${styles.seg5} ${gad7ActiveSegIndex === 4 ? styles.segActive : ''}`}
            />
          </div>
          <div className={styles.barLabels}>
            <span>0 Tối thiểu</span>
            <span>21 Nặng</span>
          </div>
        </div>

        <p className={styles.scaleNote}>
          Thang 0 đến 21. Đánh giá mức độ lo âu trong 14 ngày qua.
        </p>
      </section>

      {/* ── NÚT XEM LỊCH SỬ SÀNG LỌC ── */}
      <div className={styles.ctaRow}>
        <Link href="/assessments" className={styles.ctaBtn}>
          <span>Xem các lần sàng lọc</span>
          <span aria-hidden="true"> →</span>
        </Link>
      </div>

      <p className={styles.disclaimer}>
        Kết quả sàng lọc không phải chẩn đoán.
      </p>
    </div>
  )
}
