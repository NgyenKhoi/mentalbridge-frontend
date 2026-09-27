import type { components } from '@/contracts/journal.generated'

export type Emotion = components['schemas']['Emotion']
export type EmotionCheckInValue = components['schemas']['EmotionCheckInValue']
export type EmotionCheckInCreate =
  components['schemas']['CreateEmotionCheckInRequest']
export type EmotionCheckIn = components['schemas']['EmotionCheckIn']
export type EmotionCheckInList = components['schemas']['EmotionCheckInList']
export type EmotionCheckInProgress =
  components['schemas']['EmotionCheckInProgress']
export type EmotionProgressWindow =
  components['schemas']['EmotionProgressWindow']
