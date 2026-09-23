import { describe, expect, it } from 'vitest'
import {
  parseAnalysisJob,
  parseJournalEntry,
  parseJournalPage,
  parseJournalWrite,
} from './journal-validation'

const metadata = {
  id: '11111111-1111-4111-8111-111111111111',
  ownerAccountId: '22222222-2222-4222-8222-222222222222',
  currentRevision: 1,
  occurredAt: '2026-09-10T10:00:00.000Z',
  createdAt: '2026-09-10T10:00:00.000Z',
  updatedAt: '2026-09-10T10:00:00.000Z',
  deleted: false,
  tags: ['riêng tư'],
  mood: 'GOOD',
  encryption: {
    algorithm: 'AES-256-GCM',
    keyId: 'test-v1',
    encryptedAt: '2026-09-10T10:00:00.000Z',
  },
  analysisState: 'not_requested',
} as const

describe('Journal boundary validation', () => {
  it('accepts an exact entry and list response', () => {
    expect(
      parseJournalEntry({
        ...metadata,
        content: { text: 'Xin chào', byteLength: 9 },
      }),
    ).not.toBeNull()
    expect(
      parseJournalPage({
        items: [
          { ...metadata, content: { preview: 'Xin chào', byteLength: 9 } },
        ],
        page: { limit: 20, hasMore: false },
      }),
    ).not.toBeNull()
  })
  it('fails closed for extra fields, invalid timestamps, and byte mismatch', () => {
    expect(
      parseJournalEntry({
        ...metadata,
        occurredAt: '2026-09-10',
        content: { text: 'text', byteLength: 4 },
      }),
    ).toBeNull()
    expect(
      parseJournalEntry({
        ...metadata,
        content: { text: 'text', byteLength: 3 },
        mood: 5,
      }),
    ).toBeNull()
  })
  it('rejects unsupported persisted fields in writes', () => {
    expect(
      parseJournalWrite({ content: { text: 'text' }, mood: 'GOOD' }),
    ).not.toBeNull()
    expect(parseJournalWrite({ content: { text: 'text' }, mood: 5 })).toBeNull()
    expect(
      parseJournalWrite({ content: { text: '   ' }, mood: 'GOOD' }),
    ).toBeNull()
    expect(
      parseJournalWrite({ content: { text: 'text' }, tags: ['same', 'same'] }),
    ).toBeNull()
  })

  it('accepts only contract-consistent analysis job states', () => {
    const job = {
      jobId: '33333333-3333-4333-8333-333333333333',
      journalId: metadata.id,
      journalRevision: 1,
      status: 'RUNNING',
      attemptCount: 0,
      terminalReason: null,
      result: null,
      createdAt: metadata.createdAt,
      updatedAt: metadata.updatedAt,
      completedAt: null,
    }
    expect(parseAnalysisJob(job)).toEqual(job)
    expect(
      parseAnalysisJob({
        ...job,
        status: 'SUCCEEDED',
        completedAt: metadata.updatedAt,
        result: {
          summary: 'Một phản ánh phi lâm sàng.',
          contextSignals: ['công việc'],
          emotionIndicators: ['căng thẳng'],
          themes: ['nghỉ ngơi'],
          preferenceSignals: [],
          barrierSignals: [],
          suggestedAction: 'GUIDE_APPROVED_ACTIVITY',
          workload: 'EXACT_REVISION',
          servicePlan: 'FREE',
          provider: 'DETERMINISTIC_FAKE',
          model: 'deterministic-reflection-v1',
          promptVersion: 'exact-revision-v1',
          schemaVersion: 1,
          createdAt: metadata.updatedAt,
        },
      }),
    ).not.toBeNull()
    expect(
      parseAnalysisJob({
        ...job,
        status: 'FAILED',
        terminalReason: 'PROVIDER_TIMEOUT',
        completedAt: metadata.updatedAt,
        result: { diagnosis: 'unsupported' },
      }),
    ).toBeNull()
    expect(
      parseAnalysisJob({
        ...job,
        status: 'SUCCEEDED',
        completedAt: metadata.updatedAt,
        result: null,
      }),
    ).toBeNull()
  })
})
