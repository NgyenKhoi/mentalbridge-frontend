import type {
  JournalMood,
  JournalSummary,
} from '@/lib/journal/journal-contract'
import {
  emotionOrder,
  emotionPresentation,
} from '@/lib/emotion-check-in/presentation'

export type MoodKey = 'tv' | 'tot' | 'bt' | 'kt' | 'te'

export interface MoodMeta {
  key: MoodKey
  value: JournalMood
  label: string
  color: string
}

export const MOOD_DEFINITIONS: Record<JournalMood, MoodMeta> = {
  GREAT: {
    key: 'tv',
    value: 'GREAT',
    label: emotionPresentation.GREAT.label,
    color: emotionPresentation.GREAT.color,
  },
  GOOD: {
    key: 'tot',
    value: 'GOOD',
    label: emotionPresentation.GOOD.label,
    color: emotionPresentation.GOOD.color,
  },
  OKAY: {
    key: 'bt',
    value: 'OKAY',
    label: emotionPresentation.OKAY.label,
    color: emotionPresentation.OKAY.color,
  },
  LOW: {
    key: 'kt',
    value: 'LOW',
    label: emotionPresentation.LOW.label,
    color: emotionPresentation.LOW.color,
  },
  VERY_LOW: {
    key: 'te',
    value: 'VERY_LOW',
    label: emotionPresentation.VERY_LOW.label,
    color: emotionPresentation.VERY_LOW.color,
  },
}

export const MOOD_ORDER: JournalMood[] = [...emotionOrder]

export const DEFAULT_TAGS = [
  'Công việc',
  'Sức khỏe',
  'Gia đình',
  'Giấc ngủ',
  'Học tập',
  'Các mối quan hệ',
] as const

export interface JournalDateGroup {
  dateKey: string // YYYY-MM-DD
  title: string // Hôm nay / Hôm qua / Thứ 6
  subtitle: string // 30/9
  entries: JournalSummary[]
}

export interface JournalMonthStats {
  monthCount: number
  streakDays: number
  mostFrequentMood: string
  moodCounts: Record<JournalMood, number>
  totalInMonth: number
}
