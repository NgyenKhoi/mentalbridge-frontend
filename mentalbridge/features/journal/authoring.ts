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

export const MOOD_PROMPTS = {
  positive: [
    'Điều gì đã khiến bạn mỉm cười hoặc cảm thấy biết ơn hôm nay?',
    'Một điều nhỏ bé bạn vừa hoàn thành khiến bạn thấy tự hào là gì?',
    'Khoảnh khắc nào mang lại cho bạn sự an tâm và năng lượng nhất?',
    'Bạn muốn lưu giữ cảm xúc tuyệt vời này như thế nào?',
    'Ai hoặc điều gì đã tiếp thêm niềm vui và động lực cho bạn?',
    'Điều gì bạn đang mong chờ nhất trong những ngày tới?',
  ],
  neutral: [
    'Điều gì đang ở lại trong tâm trí bạn lúc này?',
    'Hôm nay có điều gì bình thường nhưng bạn thấy dễ chịu không?',
    'Có việc gì đang chiếm nhiều suy nghĩ của bạn trong ngày hôm nay?',
    'Bạn muốn dành một khoảnh khắc tĩnh lặng này để ghi nhận điều gì?',
    'Nhịp sống hôm nay của bạn diễn ra như thế nào?',
    'Nếu được chọn một việc nhỏ để chăm sóc bản thân tối nay, bạn sẽ làm gì?',
  ],
  low: [
    'Bạn đang cảm thấy thế nào trong cơ thể và cảm xúc lúc này?',
    'Điều gì đang làm bạn thấy mệt mỏi, nặng lòng hoặc quá tải nhất?',
    'Nếu có thể nói một lời dịu dàng với chính mình bây giờ, bạn sẽ nói gì?',
    'Điều nhỏ nhất có thể giúp bạn thấy an toàn và dễ thở hơn lúc này là gì?',
    'Có áp lực nào bạn có thể cho phép mình tạm gác lại hôm nay không?',
    'Điều gì từng giúp bạn thấy nhẹ lòng hơn trong những lúc tương tự?',
  ],
} as const

export function getMoodCategory(
  mood: JournalMood | null,
): 'positive' | 'neutral' | 'low' {
  if (mood === 'GREAT' || mood === 'GOOD') return 'positive'
  if (mood === 'LOW' || mood === 'VERY_LOW') return 'low'
  return 'neutral'
}

export const journalMood = (value: JournalMood | null) =>
  JOURNAL_MOODS.find((mood) => mood.value === value)
