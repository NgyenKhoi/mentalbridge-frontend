import type {
  Emotion,
  EmotionCheckIn,
  EmotionInfluenceFactor,
} from './emotion-contract'

export const emotions: readonly {
  value: Emotion
  emoji: string
  label: string
}[] = [
  { value: 'GREAT', emoji: '😄', label: 'Rất tốt' },
  { value: 'GOOD', emoji: '😊', label: 'Tốt' },
  { value: 'OKAY', emoji: '😌', label: 'Bình thường' },
  { value: 'LOW', emoji: '🥱', label: 'Không tốt' },
  { value: 'VERY_LOW', emoji: '😟', label: 'Rất không tốt' },
]

export const emotionByValue = new Map(
  emotions.map((item) => [item.value, item]),
)

export const influenceFactors: readonly {
  value: EmotionInfluenceFactor
  label: string
}[] = [
  { value: 'sleep', label: 'Giấc ngủ' },
  { value: 'work', label: 'Công việc' },
  { value: 'study', label: 'Học tập' },
  { value: 'family', label: 'Gia đình' },
  { value: 'friends', label: 'Bạn bè' },
  { value: 'health', label: 'Sức khỏe' },
  { value: 'other', label: 'Điều khác' },
]

export type Draft = Readonly<{
  emotion: Emotion | null
  intensity: number | null
  factors: readonly EmotionInfluenceFactor[]
  note: string
}>

export const emptyDraft: Draft = {
  emotion: null,
  intensity: null,
  factors: [],
  note: '',
}

export const savedDraft = (checkIn: EmotionCheckIn): Draft => ({
  emotion: checkIn.emotion,
  intensity: checkIn.intensity,
  factors: checkIn.factors,
  note: checkIn.note ?? '',
})
