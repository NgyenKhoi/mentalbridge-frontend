'use client'

import React from 'react'
import type { JournalMonthStats } from '../types'

interface JournalStatsProps {
  stats: JournalMonthStats
}

export function JournalStats({ stats }: JournalStatsProps) {
  return (
    <div className="stats" aria-label="Thống kê nhật ký">
      <div className="card st">
        <b>{stats.monthCount}</b>
        <span>nhật ký tháng này</span>
      </div>
      <div className="card st">
        <b>{stats.streakDays} ngày</b>
        <span>viết liên tiếp</span>
      </div>
      <div className="card st">
        <b>{stats.mostFrequentMood}</b>
        <span>cảm xúc hay gặp nhất</span>
      </div>
    </div>
  )
}
