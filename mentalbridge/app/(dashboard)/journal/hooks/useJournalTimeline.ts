import { useMemo } from 'react'
import type {
  JournalMood,
  JournalSummary,
} from '@/lib/journal/journal-contract'
import {
  DEFAULT_TAGS,
  MOOD_DEFINITIONS,
  MOOD_ORDER,
  type JournalDateGroup,
  type JournalMonthStats,
} from '../types'

export function toDateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function toTimeStr(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0')
  const m = String(date.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

export interface CalendarDayItem {
  day: number
  dateKey: string
  hasEntries: boolean
  latestMoodColor?: string
  isSelected: boolean
}

export function useJournalTimeline({
  entries,
  yearMonth,
  searchQuery,
  selectedMood,
  selectedTag,
  selectedDay,
}: {
  entries: JournalSummary[]
  yearMonth: [number, number] // [year, 0-indexed month]
  searchQuery: string
  selectedMood: 'all' | JournalMood
  selectedTag: string
  selectedDay: string | null
}) {
  const [year, month] = yearMonth

  // 1. Entries in the selected month
  const monthEntries = useMemo(() => {
    return entries.filter((entry) => {
      const d = new Date(entry.occurredAt)
      return d.getFullYear() === year && d.getMonth() === month
    })
  }, [entries, year, month])

  // 2. Stats calculation
  const stats: JournalMonthStats = useMemo(() => {
    const monthCount = monthEntries.length

    // Streak calculation across all entries up to today
    const writtenDays = new Set(
      entries.map((e) => toDateKey(new Date(e.occurredAt))),
    )

    let streakDays = 0
    const now = new Date()
    const checkDate = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      12,
      0,
      0,
    )
    const todayKey = toDateKey(checkDate)

    const yesterday = new Date(checkDate)
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayKey = toDateKey(yesterday)

    let cursorDate = new Date(checkDate)
    if (writtenDays.has(todayKey)) {
      while (writtenDays.has(toDateKey(cursorDate))) {
        streakDays++
        cursorDate.setDate(cursorDate.getDate() - 1)
      }
    } else if (writtenDays.has(yesterdayKey)) {
      cursorDate = yesterday
      while (writtenDays.has(toDateKey(cursorDate))) {
        streakDays++
        cursorDate.setDate(cursorDate.getDate() - 1)
      }
    }

    // Mood counts in the selected month
    const moodCounts: Record<JournalMood, number> = {
      GREAT: 0,
      GOOD: 0,
      OKAY: 0,
      LOW: 0,
      VERY_LOW: 0,
    }

    for (const e of monthEntries) {
      if (e.mood && moodCounts[e.mood] !== undefined) {
        moodCounts[e.mood]++
      }
    }

    let topMood: JournalMood | null = null
    let maxCount = 0
    for (const m of MOOD_ORDER) {
      if (moodCounts[m] > maxCount) {
        maxCount = moodCounts[m]
        topMood = m
      }
    }

    const mostFrequentMood =
      topMood && maxCount > 0 ? MOOD_DEFINITIONS[topMood].label : '—'

    return {
      monthCount,
      streakDays,
      mostFrequentMood,
      moodCounts,
      totalInMonth: monthCount,
    }
  }, [entries, monthEntries])

  // 3. Calendar grid data
  const calendarData = useMemo(() => {
    const firstDay = new Date(year, month, 1)
    const offset = (firstDay.getDay() + 6) % 7 // Monday = 0, Sunday = 6
    const totalDays = new Date(year, month + 1, 0).getDate()

    // Map entries by dateKey for quick lookup
    const dayToEntries = new Map<string, JournalSummary[]>()
    for (const e of monthEntries) {
      const k = toDateKey(new Date(e.occurredAt))
      const list = dayToEntries.get(k) || []
      list.push(e)
      dayToEntries.set(k, list)
    }

    const days: CalendarDayItem[] = []
    for (let d = 1; d <= totalDays; d++) {
      const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      const dayEntries = dayToEntries.get(dateKey) || []
      const hasEntries = dayEntries.length > 0
      const latestMood = hasEntries ? dayEntries[0].mood : null
      const latestMoodColor = latestMood
        ? MOOD_DEFINITIONS[latestMood]?.color
        : undefined

      days.push({
        day: d,
        dateKey,
        hasEntries,
        latestMoodColor,
        isSelected: selectedDay === dateKey,
      })
    }

    return { offset, days }
  }, [year, month, monthEntries, selectedDay])

  // 4. Filtered entries for the timeline
  const filteredEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()

    return monthEntries.filter((entry) => {
      // Day filter
      if (selectedDay) {
        const k = toDateKey(new Date(entry.occurredAt))
        if (k !== selectedDay) return false
      }

      // Mood filter
      if (selectedMood !== 'all') {
        if (entry.mood !== selectedMood) return false
      }

      // Tag filter
      if (selectedTag !== 'all') {
        const hasTag = entry.tags.some(
          (t) => t.toLowerCase() === selectedTag.toLowerCase(),
        )
        if (!hasTag) return false
      }

      // Search query
      if (q) {
        const inPreview = entry.content.preview.toLowerCase().includes(q)
        const inTag = entry.tags.some((t) => t.toLowerCase().includes(q))
        if (!inPreview && !inTag) return false
      }

      return true
    })
  }, [monthEntries, selectedDay, selectedMood, selectedTag, searchQuery])

  // 5. Grouped by day
  const groupedByDate: JournalDateGroup[] = useMemo(() => {
    const groupsMap = new Map<string, JournalSummary[]>()

    // Sort entries descending by occurredAt
    const sorted = [...filteredEntries].sort(
      (a, b) =>
        new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
    )

    for (const e of sorted) {
      const k = toDateKey(new Date(e.occurredAt))
      const list = groupsMap.get(k) || []
      list.push(e)
      groupsMap.set(k, list)
    }

    const now = new Date()
    const today = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      12,
      0,
      0,
    )
    const weekdays = [
      'Chủ nhật',
      'Thứ 2',
      'Thứ 3',
      'Thứ 4',
      'Thứ 5',
      'Thứ 6',
      'Thứ 7',
    ]

    const result: JournalDateGroup[] = []
    groupsMap.forEach((items, dateKey) => {
      const [y, m, d] = dateKey.split('-').map(Number)
      const entryDate = new Date(y, m - 1, d, 12, 0, 0)
      const diffDays = Math.round(
        (today.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24),
      )

      let title = weekdays[entryDate.getDay()]
      if (diffDays === 0) title = 'Hôm nay'
      else if (diffDays === 1) title = 'Hôm qua'

      const subtitle = `${d}/${m}`

      result.push({
        dateKey,
        title,
        subtitle,
        entries: items,
      })
    })

    return result
  }, [filteredEntries])

  // 6. Available tags
  const availableTags = useMemo(() => {
    const tagSet = new Set<string>()
    for (const e of entries) {
      for (const t of e.tags) {
        if (t.trim()) tagSet.add(t.trim())
      }
    }
    for (const dt of DEFAULT_TAGS) {
      tagSet.add(dt)
    }
    return Array.from(tagSet)
  }, [entries])

  return {
    monthEntries,
    stats,
    calendarData,
    filteredEntries,
    groupedByDate,
    availableTags,
  }
}
