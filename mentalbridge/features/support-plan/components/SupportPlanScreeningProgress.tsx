'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ApiError } from '@/lib/api/api-error'
import {
  getAssessmentHistory,
  getAssessmentProgress,
} from '@/features/assessment/api/browser-care'
import type {
  AssessmentProgress,
  AssessmentSummary,
} from '@/features/assessment/api/care-contract'
import { levelLabels } from '@/features/assessment/components/assessment-meanings'
import SupportPlanIcon from './SupportPlanIcon'

type Instrument = 'GAD7' | 'PHQ9'
type Comparison = AssessmentProgress | 'INSUFFICIENT' | 'UNAVAILABLE' | null

const metricDetails: Record<Instrument, { label: string; max: number }> = {
  GAD7: { label: 'Chỉ số Lo âu (GAD-7)', max: 21 },
  PHQ9: { label: 'Tâm trạng & Trầm cảm (PHQ-9)', max: 27 },
}

function ScreeningMetric({
  instrument,
  result,
  comparison,
}: {
  instrument: Instrument
  result: AssessmentSummary
  comparison: Comparison
}) {
  const { label, max } = metricDetails[instrument]
  const score = result.result.totalScore
  const progress =
    comparison && typeof comparison !== 'string' ? comparison : null
  const previous = progress?.previous ?? null
  const direction = progress?.scoreDirection ?? null

  return (
    <div className="support-plan-metric-item">
      <div className="support-plan-metric-label-row">
        <span>{label}</span>
        <span className="support-plan-metric-value">
          {score} / {max} ({levelLabels[result.result.screeningLevel]})
        </span>
      </div>
      <div
        className="support-plan-metric-track"
        role="progressbar"
        aria-label={label}
        aria-valuenow={score}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        <div
          className="support-plan-metric-fill"
          style={{
            width: `${Math.min(100, Math.max(0, (score / max) * 100))}%`,
          }}
        />
      </div>
      <div className="support-plan-metric-subtext-row">
        <span>
          {previous
            ? `Lần trước (${new Date(previous.submittedAt).toLocaleDateString('vi-VN')}): ${previous.totalScore}/${max}`
            : comparison === 'UNAVAILABLE'
              ? 'Chưa tải được so sánh'
              : 'Chưa đủ kết quả để so sánh'}
        </span>
        {previous && direction && progress ? (
          <span className="support-plan-metric-delta">
            {direction === 'DECREASED'
              ? `Điểm giảm ${Math.abs(progress.rawDelta)}`
              : direction === 'INCREASED'
                ? `Điểm tăng ${Math.abs(progress.rawDelta)}`
                : 'Điểm không đổi'}
          </span>
        ) : null}
      </div>
    </div>
  )
}

export default function SupportPlanScreeningProgress() {
  const [results, setResults] = useState<
    Partial<Record<Instrument, AssessmentSummary>>
  >({})
  const [comparisons, setComparisons] = useState<
    Partial<Record<Instrument, Comparison>>
  >({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true

    async function load() {
      try {
        const page = await getAssessmentHistory()
        const gad7 = page.items.find((item) => item.instrument === 'GAD7')
        const phq9 = page.items.find((item) => item.instrument === 'PHQ9')
        const comparisonFor = async (
          item?: AssessmentSummary,
        ): Promise<Comparison> => {
          if (!item) return null
          try {
            return await getAssessmentProgress(item.assessmentId)
          } catch (reason) {
            return reason instanceof ApiError &&
              reason.code === 'INSUFFICIENT_COMPARABLE_DATA'
              ? 'INSUFFICIENT'
              : 'UNAVAILABLE'
          }
        }
        const [gad7Comparison, phq9Comparison] = await Promise.all([
          comparisonFor(gad7),
          comparisonFor(phq9),
        ])
        if (!active) return
        setResults({ GAD7: gad7, PHQ9: phq9 })
        setComparisons({ GAD7: gad7Comparison, PHQ9: phq9Comparison })
        setError(false)
      } catch {
        if (active) setError(true)
      } finally {
        if (active) setLoading(false)
      }
    }

    void load()
    return () => {
      active = false
    }
  }, [attempt])

  return (
    <section
      className="support-plan-side-card"
      aria-labelledby="support-plan-screening-title"
    >
      <div className="support-plan-side-card-header">
        <div className="support-plan-side-card-icon-tile" aria-hidden="true">
          <SupportPlanIcon name="show_chart" size={20} />
        </div>
        <div className="support-plan-side-card-heading">
          <h4
            id="support-plan-screening-title"
            className="support-plan-side-card-title"
          >
            Chỉ số tiến triển tâm lý
          </h4>
          <span className="support-plan-side-card-subtitle">
            Kết quả sàng lọc gần nhất
          </span>
        </div>
      </div>

      {loading ? (
        <p role="status">Đang tải kết quả sàng lọc…</p>
      ) : error ? (
        <div role="alert">
          <p>Chưa tải được kết quả sàng lọc.</p>
          <button
            type="button"
            className="support-plan-side-link-btn"
            onClick={() => {
              setLoading(true)
              setAttempt((value) => value + 1)
            }}
          >
            Thử lại
          </button>
        </div>
      ) : results.GAD7 || results.PHQ9 ? (
        <div className="support-plan-metrics-list">
          {results.GAD7 ? (
            <ScreeningMetric
              instrument="GAD7"
              result={results.GAD7}
              comparison={comparisons.GAD7 ?? null}
            />
          ) : (
            <p>Chưa có kết quả GAD-7 gần đây.</p>
          )}
          {results.PHQ9 ? (
            <ScreeningMetric
              instrument="PHQ9"
              result={results.PHQ9}
              comparison={comparisons.PHQ9 ?? null}
            />
          ) : (
            <p>Chưa có kết quả PHQ-9 gần đây.</p>
          )}
        </div>
      ) : (
        <p>Chưa có kết quả sàng lọc gần đây.</p>
      )}

      <div className="support-plan-side-card-footer">
        <Link href="/assessments" className="support-plan-side-link-btn">
          <span>Xem chi tiết báo cáo sàng lọc</span>
          <SupportPlanIcon name="arrow_right_alt" size={16} />
        </Link>
      </div>
    </section>
  )
}
