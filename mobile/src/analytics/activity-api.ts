import type { AxiosInstance } from 'axios'
import { z } from 'zod'

export const activityRanges = [7, 30, 90] as const
export type ActivityRange = (typeof activityRanges)[number]

const count = z.number().int().nonnegative()
const source = z.enum(['available', 'empty', 'limited', 'unavailable'])
const day = z.strictObject({
  localDate: z.iso.date(),
  assessments: count,
  journals: count,
  emotions: count,
  emotionLevel: z.number().int().min(1).max(5).nullable(),
  supportCompleted: count,
  supportSkipped: count,
  appointments: count,
  total: count,
})

const dashboard = z.strictObject({
  asOfLocalDate: z.iso.date(),
  startLocalDate: z.iso.date(),
  timezone: z.string().min(1).max(64),
  summary: z.strictObject({
    totalActivities: count,
    activeDays: count,
    assessmentSubmissions: count,
    journalEntries: count,
    journalActiveDays: count,
    emotionCheckIns: count,
    emotionActiveDays: count,
    supportCompleted: count,
    supportSkipped: count,
    appointmentEvents: count,
    currentEmotionStreak: count,
    latestAssessmentInstrument: z.enum(['PHQ9', 'GAD7']).nullable(),
    latestAssessmentSubmittedAt: z.iso.datetime({ offset: true }).nullable(),
  }),
  daily: z.array(day).min(7).max(90),
  sources: z.strictObject({
    assessments: source,
    journals: source,
    emotions: source,
    supportPlans: source,
    appointments: source,
  }),
  partial: z.boolean(),
  bounded: z.strictObject({
    windowDays: z.union([z.literal(7), z.literal(30), z.literal(90)]),
    assessmentLimit: count,
    journalLimit: count,
    emotionLimit: count,
    appointmentLimit: count,
  }),
})

export type ActivityDashboard = z.infer<typeof dashboard>
export type ActivityDay = z.infer<typeof day>

export function createActivityApi(client: AxiosInstance) {
  return async (
    range: ActivityRange,
    timezone: string,
    signal: AbortSignal,
  ) => {
    const response = await client.get('/api/v1/activity-dashboard', {
      params: { range, timezone },
      signal,
    })
    const data = dashboard.parse(response.data)
    const start = Date.parse(data.startLocalDate)
    const total = data.daily.reduce((sum, entry) => sum + entry.total, 0)
    if (
      data.bounded.windowDays !== range ||
      data.daily.length !== range ||
      data.daily.at(-1)?.localDate !== data.asOfLocalDate ||
      total !== data.summary.totalActivities ||
      data.daily.some(
        (entry, index) =>
          Date.parse(entry.localDate) !== start + index * 86_400_000 ||
          (entry.emotionLevel === null) !== (entry.emotions === 0) ||
          entry.total !==
            entry.assessments +
              entry.journals +
              entry.emotions +
              entry.supportCompleted +
              entry.supportSkipped +
              entry.appointments,
      )
    ) {
      throw new Error('Activity dashboard does not match the requested window.')
    }
    return data
  }
}
