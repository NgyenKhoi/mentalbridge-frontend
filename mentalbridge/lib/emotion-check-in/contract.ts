import type { components } from '@/contracts/journal.generated'

type Schemas = components['schemas']

export type Emotion = Schemas['Emotion']
export type EmotionCheckIn = Readonly<Schemas['EmotionCheckIn']>
export type EmotionCheckInCreate = Readonly<
  Schemas['CreateEmotionCheckInRequest']
>
export type EmotionCheckInValue = Readonly<Schemas['EmotionCheckInValue']>
export type EmotionCheckInList = Readonly<Schemas['EmotionCheckInList']>
export type EmotionCheckInTombstone = Readonly<
  Schemas['EmotionCheckInTombstone']
>
