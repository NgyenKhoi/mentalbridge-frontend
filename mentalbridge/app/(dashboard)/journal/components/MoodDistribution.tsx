'use client'

import React from 'react'
import type { JournalMood } from '@/lib/journal/journal-contract'
import { MOOD_DEFINITIONS, MOOD_ORDER } from '../types'

interface MoodDistributionProps {
  month: number // 0-indexed
  moodCounts: Record<JournalMood, number>
  totalInMonth: number
}

export function MoodDistribution({
  month,
  moodCounts,
  totalInMonth,
}: MoodDistributionProps) {
  return (
    <div className="card dist" aria-label={`Cảm xúc trong tháng ${month + 1}`}>
      <h3>Cảm xúc trong tháng {month + 1}</h3>

      {/* Segmented distribution bar */}
      <div className="seg" role="img" aria-label="Biểu đồ phân bố cảm xúc">
        {totalInMonth === 0 ? (
          <i
            style={{ flex: 1, backgroundColor: 'var(--line)' }}
            aria-hidden="true"
          />
        ) : (
          MOOD_ORDER.map((m) => {
            const count = moodCounts[m] || 0
            if (count === 0) return null
            return (
              <i
                key={m}
                style={{
                  flex: count,
                  backgroundColor: MOOD_DEFINITIONS[m].color,
                }}
                aria-hidden="true"
              />
            )
          })
        )}
      </div>

      {/* Mood rows */}
      <div className="rows-list">
        {MOOD_ORDER.map((m) => {
          const meta = MOOD_DEFINITIONS[m]
          const count = moodCounts[m] || 0
          return (
            <div key={m} className={`row ${count === 0 ? 'zero' : ''}`}>
              <i
                style={{ '--c': meta.color } as React.CSSProperties}
                aria-hidden="true"
              />
              <span>{meta.label}</span>
              <b>{count}</b>
            </div>
          )
        })}
      </div>
    </div>
  )
}
