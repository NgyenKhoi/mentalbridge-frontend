export type OverviewSource<T> =
  | Readonly<{ state: 'available'; data: T }>
  | Readonly<{ state: 'empty' }>
  | Readonly<{ state: 'unavailable' }>

export type EmotionOverview = Readonly<{
  currentStreak: number
  checkedInDays: number
  windowDays: 30
}>

export type AssessmentOverview = Readonly<{
  count: number
  countIsLowerBound: boolean
  latestSubmittedAt: string | null
  latestInstrument: 'PHQ9' | 'GAD7' | null
}>

export type SupportActivityOverview = Readonly<{
  completedCount: number
  skippedCount: number
  scheduledOrMissedCount: number
  windowDays: 30
}>

export type AppointmentOverview = Readonly<{
  totalCount: number
  activeCount: number
}>

export type AnalyticsOverview = Readonly<{
  asOfLocalDate: string
  timezone: string
  emotion: OverviewSource<EmotionOverview>
  assessments: OverviewSource<AssessmentOverview>
  supportActivities: OverviewSource<SupportActivityOverview>
  appointments: OverviewSource<AppointmentOverview>
}>
