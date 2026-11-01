import type { Emotion, EmotionCheckIn } from '@/lib/emotion-check-in/contract'

export type HomeEmotionDay = Readonly<{
  localDate: string
  label: string
  today: boolean
  emotion: Emotion | null
}>

const dayLabels = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']

export function homeEmotionWeek(
  asOfLocalDate: string,
  records: readonly EmotionCheckIn[],
): readonly HomeEmotionDay[] {
  const today = Date.parse(`${asOfLocalDate}T00:00:00.000Z`)
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today - (6 - index) * 86_400_000)
    const localDate = date.toISOString().slice(0, 10)
    return {
      localDate,
      label: index === 6 ? 'Nay' : dayLabels[date.getUTCDay()],
      today: index === 6,
      emotion:
        records.find((record) => record.localDate === localDate)?.emotion ??
        null,
    }
  })
}
