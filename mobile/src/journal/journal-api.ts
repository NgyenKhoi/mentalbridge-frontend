import type { AxiosInstance } from 'axios'

import { ApiError } from '@/api/api-error'

import {
  aiAuthorizationSchema,
  aiDisclosureSchema,
  analysisJobSchema,
  consentDecisionSchema,
  journalCreateSchema,
  journalEntrySchema,
  journalPageSchema,
  journalTombstoneSchema,
  journalWriteSchema,
  trendJobSchema,
  trendRequestSchema,
  type AiAuthorization,
  type AiDisclosure,
  type AnalysisJob,
  type JournalCreate,
  type JournalEntry,
  type JournalPage,
  type JournalWrite,
  type TrendJob,
  type TrendRequest,
} from './journal-contract'

export interface JournalApi {
  list(cursor?: string): Promise<JournalPage>
  detail(id: string): Promise<JournalEntry>
  create(body: JournalCreate, key: string): Promise<JournalEntry>
  revise(
    id: string,
    revision: number,
    body: JournalWrite,
    key: string,
  ): Promise<JournalEntry>
  remove(id: string, key: string): Promise<void>
  disclosure(): Promise<AiDisclosure>
  authorization(): Promise<AiAuthorization>
  consent(
    version: AiDisclosure['version'],
    granted: boolean,
    key: string,
  ): Promise<void>
  requestAnalysis(
    id: string,
    revision: number,
    key: string,
  ): Promise<AnalysisJob>
  analysisJob(id: string): Promise<AnalysisJob>
  requestTrend(body: TrendRequest, key: string): Promise<TrendJob>
  trendJob(id: string): Promise<TrendJob>
}

export function assertJournalOwner<T extends { ownerAccountId: string }>(
  value: T,
  subject: string,
): T {
  if (value.ownerAccountId !== subject)
    throw new ApiError({
      message: 'Journal owner mismatch.',
      code: 'JOURNAL_OWNER_MISMATCH',
      status: 403,
    })
  return value
}

export function createJournalApi(
  client: AxiosInstance,
  subject: string,
): JournalApi {
  const headers = (key: string) => ({ 'Idempotency-Key': key })
  const owned = (value: unknown) =>
    assertJournalOwner(journalEntrySchema.parse(value), subject)
  return {
    async list(cursor) {
      const response = await client.get('/api/v1/journals', {
        params: { limit: 20, ...(cursor ? { cursor } : {}) },
      })
      const page = journalPageSchema.parse(response.data)
      page.items.forEach((item) => assertJournalOwner(item, subject))
      return page
    },
    async detail(id) {
      const response = await client.get(
        `/api/v1/journals/${encodeURIComponent(id)}`,
      )
      const entry = owned(response.data)
      if (entry.id !== id)
        throw new ApiError({
          message: 'Journal identity mismatch.',
          code: 'JOURNAL_IDENTITY_MISMATCH',
          status: 502,
        })
      return entry
    },
    async create(body, key) {
      const response = await client.post(
        '/api/v1/journals',
        journalCreateSchema.parse(body),
        { headers: headers(key) },
      )
      return owned(response.data)
    },
    async revise(id, revision, body, key) {
      const response = await client.patch(
        `/api/v1/journals/${encodeURIComponent(id)}`,
        journalWriteSchema.parse(body),
        { headers: { ...headers(key), 'If-Match-Revision': String(revision) } },
      )
      const entry = owned(response.data)
      if (entry.id !== id || entry.currentRevision !== revision + 1)
        throw new ApiError({
          message: 'Journal revision mismatch.',
          code: 'JOURNAL_REVISION_MISMATCH',
          status: 502,
        })
      return entry
    },
    async remove(id, key) {
      const response = await client.delete(
        `/api/v1/journals/${encodeURIComponent(id)}`,
        { headers: headers(key) },
      )
      const tombstone = assertJournalOwner(
        journalTombstoneSchema.parse(response.data),
        subject,
      )
      if (tombstone.id !== id)
        throw new ApiError({
          message: 'Journal identity mismatch.',
          code: 'JOURNAL_IDENTITY_MISMATCH',
          status: 502,
        })
    },
    async disclosure() {
      return aiDisclosureSchema.parse(
        (
          await client.get('/api/v1/ai-processing-disclosures/current', {
            params: { locale: 'vi-VN' },
          })
        ).data,
      )
    },
    async authorization() {
      return aiAuthorizationSchema.parse(
        (await client.get('/api/v1/consents/ai-processing/authorization')).data,
      )
    },
    async consent(version, granted, key) {
      const response = await client.post(
        '/api/v1/consent-decisions',
        { consentType: 'AI_PROCESSING', policyVersion: version, granted },
        { headers: headers(key) },
      )
      const decision = consentDecisionSchema.parse(response.data)
      if (
        decision.consentType !== 'AI_PROCESSING' ||
        decision.policyVersion !== version ||
        decision.granted !== granted
      )
        throw new ApiError({
          message: 'Consent decision mismatch.',
          code: 'CONSENT_DECISION_MISMATCH',
          status: 502,
        })
    },
    async requestAnalysis(id, revision, key) {
      return analysisJobSchema.parse(
        (
          await client.post(
            `/api/v1/journals/${encodeURIComponent(id)}/revisions/${revision}/analysis-jobs`,
            undefined,
            { headers: headers(key) },
          )
        ).data,
      )
    },
    async analysisJob(id) {
      return analysisJobSchema.parse(
        (await client.get(`/api/v1/analysis-jobs/${encodeURIComponent(id)}`))
          .data,
      )
    },
    async requestTrend(body, key) {
      return trendJobSchema.parse(
        (
          await client.post(
            '/api/v1/longitudinal-analysis-jobs',
            trendRequestSchema.parse(body),
            { headers: headers(key) },
          )
        ).data,
      )
    },
    async trendJob(id) {
      return trendJobSchema.parse(
        (
          await client.get(
            `/api/v1/longitudinal-analysis-jobs/${encodeURIComponent(id)}`,
          )
        ).data,
      )
    },
  }
}
