import type { AxiosInstance } from 'axios'
import { z } from 'zod'

import {
  assessmentHistorySchema,
  safetyStatusSchema,
  screeningEpisodeSchema,
  screeningLevelSchema,
} from './assessment-contract'
import { combinedScreeningMeaningSchema } from './combined-meaning-contract'

const evidence = z
  .object({
    state: z.enum(['AVAILABLE', 'MISSING', 'UNAVAILABLE']),
    assessmentId: z.uuid().nullable(),
    totalScore: z.number().int().min(0).max(27).nullable(),
    screeningLevel: screeningLevelSchema.nullable(),
    safetyStatus: safetyStatusSchema.nullable(),
  })
  .strict()

const dateTime = z.iso.datetime({ offset: true })
const episode = screeningEpisodeSchema
  .pick({ episodeId: true, purpose: true, status: true })
  .extend({
    startedAt: dateTime,
    updatedAt: dateTime,
    completedAt: dateTime.nullable(),
    presentationEvaluationId: z.uuid().nullable(),
    meaningState: z.enum(['AVAILABLE', 'INCOMPLETE', 'UNAVAILABLE']),
    evidence: z.tuple([
      evidence.extend({ instrument: z.literal('PHQ9') }),
      evidence.extend({
        instrument: z.literal('GAD7'),
        totalScore: z.number().int().min(0).max(21).nullable(),
      }),
    ]),
    meaning: combinedScreeningMeaningSchema.nullable(),
  })
  .strict()
  .transform((row) => {
    const { meaning } = row
    if (
      row.meaningState === 'AVAILABLE' &&
      meaning &&
      meaning.episodeId === row.episodeId &&
      meaning.supportEvaluationId === row.presentationEvaluationId &&
      meaning.evidence.every(
        (record, index) =>
          record.assessmentId === row.evidence[index]?.assessmentId,
      )
    )
      return row
    return { ...row, meaning: null }
  })

const history = assessmentHistorySchema.extend({
  items: z.array(episode).max(50),
})

export type ScreeningHistoryEpisode = z.infer<typeof episode>

export function createAssessmentHistoryApi(client: AxiosInstance) {
  async function list<T>(
    path: string,
    schema: z.ZodType<T>,
    cursor: string | undefined,
    signal: AbortSignal,
  ) {
    const response = await client.get(path, {
      params: { limit: 10, cursor },
      signal,
    })
    return schema.parse(response.data)
  }
  return {
    episodes: (cursor: string | undefined, signal: AbortSignal) =>
      list('/api/v1/screening-episodes/history', history, cursor, signal),
    assessments: (cursor: string | undefined, signal: AbortSignal) =>
      list('/api/v1/assessments', assessmentHistorySchema, cursor, signal),
  }
}
