import type {
  JournalMood,
  JournalSummary,
} from '@/lib/journal/journal-contract'

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
    label: 'Tuyệt vời',
    color: '#3f9b7a',
  },
  GOOD: {
    key: 'tot',
    value: 'GOOD',
    label: 'Tốt',
    color: '#8cb960',
  },
  OKAY: {
    key: 'bt',
    value: 'OKAY',
    label: 'Bình thường',
    color: '#d9a441',
  },
  LOW: {
    key: 'kt',
    value: 'LOW',
    label: 'Không tốt',
    color: '#d9794f',
  },
  VERY_LOW: {
    key: 'te',
    value: 'VERY_LOW',
    label: 'Rất tệ',
    color: '#8b8fc7',
  },
}

export const MOOD_ORDER: JournalMood[] = [
  'GREAT',
  'GOOD',
  'OKAY',
  'LOW',
  'VERY_LOW',
]

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
