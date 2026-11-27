import type { Emotion, EmotionInfluenceFactor } from './contract'

export const emotionOrder = [
  'GREAT',
  'GOOD',
  'OKAY',
  'LOW',
  'VERY_LOW',
] as const satisfies readonly Emotion[]

export const emotionPresentation: Readonly<
  Record<
    Emotion,
    Readonly<{
      emoji: string
      label: string
      color: string
      background: string
    }>
  >
> = {
  GREAT: {
    emoji: '😄',
    label: 'Rất tốt',
    color: '#D99B2B',
    background: '#FDF3DC',
  },
  GOOD: {
    emoji: '😊',
    label: 'Tốt',
    color: '#3D7A6E',
    background: '#DDF3F0',
  },
  OKAY: {
    emoji: '😌',
    label: 'Bình thường',
    color: '#6C9BD2',
    background: '#E3EDF8',
  },
  LOW: {
    emoji: '🥱',
    label: 'Không tốt',
    color: '#B96747',
    background: '#F5DED2',
  },
  VERY_LOW: {
    emoji: '😟',
    label: 'Rất không tốt',
    color: '#68639A',
    background: '#E5E3F1',
  },
}

export const emotionOptions = emotionOrder.map((value) => ({
  value,
  ...emotionPresentation[value],
}))

export const emotionInfluenceOptions: readonly Readonly<{
  value: EmotionInfluenceFactor
  label: string
}>[] = [
  { value: 'sleep', label: 'Giấc ngủ' },
  { value: 'work', label: 'Công việc' },
  { value: 'study', label: 'Học tập' },
  { value: 'family', label: 'Gia đình' },
  { value: 'friends', label: 'Bạn bè' },
  { value: 'health', label: 'Sức khỏe' },
  { value: 'other', label: 'Điều khác' },
]

export function localDateInTimeZone(now: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

export function formatEmotionLocalDate(localDate: string) {
  const [year, month, day] = localDate.split('-')
  return `${day}/${month}/${year}`
}
