import type { JournalMood } from '@/lib/journal/journal-contract'

export const JOURNAL_MOODS: ReadonlyArray<{
  value: JournalMood
  emoji: string
  label: string
}> = [
  { value: 'GREAT', emoji: '😊', label: 'Tuyệt vời' },
  { value: 'GOOD', emoji: '🙂', label: 'Tốt' },
  { value: 'OKAY', emoji: '😐', label: 'Bình thường' },
  { value: 'LOW', emoji: '😔', label: 'Không tốt' },
  { value: 'VERY_LOW', emoji: '😢', label: 'Rất tệ' },
]

export const JOURNAL_PROMPTS = [
  'Điều gì đang ở lại trong tâm trí bạn lúc này?',
  'Hôm nay có khoảnh khắc nào khiến bạn thấy nhẹ lòng hơn?',
  'Bạn muốn dành một lời tử tế nào cho chính mình?',
] as const

export const journalMood = (value: JournalMood | null) =>
  JOURNAL_MOODS.find((mood) => mood.value === value)
