import type { JournalApi } from './journal-api'
import type {
  AiAuthorization,
  AiDisclosure,
  AnalysisJob,
  JournalEntry,
  JournalPage,
  TrendJob,
} from './journal-contract'

export const subject = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
export const entry: JournalEntry = {
  id: '22222222-2222-4222-8222-222222222222',
  ownerAccountId: subject,
  currentRevision: 1,
  occurredAt: '2026-10-07T01:00:00.000Z',
  createdAt: '2026-10-07T01:00:00.000Z',
  updatedAt: '2026-10-07T01:00:00.000Z',
  deleted: false,
  tags: ['công việc'],
  mood: 'GOOD',
  encryption: {
    algorithm: 'AES-256-GCM',
    keyId: 'single-key',
    encryptedAt: '2026-10-07T01:00:00.000Z',
  },
  analysisState: 'not_requested',
  content: { text: 'Một ngày bình yên.', byteLength: 23 },
}
export const page = (entries: JournalEntry[] = [entry]): JournalPage => ({
  items: entries.map((item) => ({
    ...item,
    content: {
      preview: item.content.text.slice(0, 160),
      byteLength: item.content.byteLength,
    },
  })),
  page: { limit: 20, hasMore: false },
})
export const disclosure: AiDisclosure = {
  consentType: 'AI_PROCESSING',
  version: 'ai-processing-capstone-v1',
  locale: 'vi-VN',
  title: 'Thông tin xử lý AI',
  content:
    'Nội dung bạn chọn được gửi để phản ánh hỗ trợ, không phải chẩn đoán.',
  capstoneOnly: true,
}
export const granted: AiAuthorization = {
  authorized: true,
  reason: 'GRANTED',
  consentType: 'AI_PROCESSING',
  policyVersion: disclosure.version,
  decidedAt: '2026-10-07T01:00:00.000Z',
}
export const missing: AiAuthorization = {
  ...granted,
  authorized: false,
  reason: 'MISSING',
  policyVersion: null,
  decidedAt: null,
}
export const running: AnalysisJob = {
  jobId: '33333333-3333-4333-8333-333333333333',
  journalId: entry.id,
  journalRevision: 1,
  status: 'RUNNING',
  attemptCount: 0,
  createdAt: entry.createdAt,
  updatedAt: entry.updatedAt,
  completedAt: null,
  terminalReason: null,
  result: null,
}
export const failed: AnalysisJob = {
  ...running,
  status: 'FAILED',
  attemptCount: 2,
  terminalReason: 'PROVIDER_UNAVAILABLE',
  completedAt: entry.updatedAt,
}
export const completed: AnalysisJob = {
  ...running,
  status: 'SUCCEEDED',
  attemptCount: 1,
  completedAt: entry.updatedAt,
  result: {
    summary: 'Bạn đã dành thời gian để ghi lại trải nghiệm của mình.',
    contextSignals: ['công việc'],
    emotionIndicators: ['bình yên'],
    themes: ['nghỉ ngơi'],
    preferenceSignals: [],
    barrierSignals: [],
    suggestedAction: 'NONE',
    provider: 'DETERMINISTIC_FAKE',
    model: 'fixture-v1',
    promptVersion: 'journal-reflection-v1',
    schemaVersion: 1,
    createdAt: entry.createdAt,
  },
}
export const trend: TrendJob = {
  jobId: running.jobId,
  status: 'SUCCEEDED',
  attemptCount: 1,
  createdAt: entry.createdAt,
  updatedAt: entry.updatedAt,
  completedAt: entry.updatedAt,
  terminalReason: null,
  previousPeriod: {
    startAt: '2026-09-23T00:00:00.000Z',
    endAt: '2026-09-30T00:00:00.000Z',
  },
  currentPeriod: {
    startAt: '2026-09-30T00:00:00.000Z',
    endAt: '2026-10-07T00:00:00.000Z',
  },
  sourceJournalRevisions: [
    { journalId: entry.id, journalRevision: 1, period: 'CURRENT' },
  ],
  dataCoverage: {
    previousPeriodJournalEntryCount: 0,
    currentPeriodJournalEntryCount: 1,
    sufficientForComparison: false,
  },
  result: null,
}
trend.result = {
  analysisId: trend.jobId,
  previousPeriod: trend.previousPeriod,
  currentPeriod: trend.currentPeriod,
  sourceJournalRevisions: trend.sourceJournalRevisions,
  dataCoverage: trend.dataCoverage,
  contextSignals: [],
  emotionIndicators: [],
  recurringThemes: [],
  changesComparedWithPreviousPeriod: [
    { signal: 'công việc', direction: 'INSUFFICIENT_DATA' },
  ],
  preferences: [],
  barriers: [],
  helpfulPatterns: [],
  provider: 'DETERMINISTIC_FAKE',
  model: 'fixture-v1',
  promptVersion: 'longitudinal-v1',
  schemaVersion: 1,
  createdAt: entry.createdAt,
}

export function journalApi(overrides: Partial<JournalApi> = {}): JournalApi {
  return {
    list: jest.fn().mockResolvedValue(page()),
    detail: jest.fn().mockResolvedValue(entry),
    create: jest.fn().mockResolvedValue(entry),
    revise: jest.fn().mockResolvedValue({ ...entry, currentRevision: 2 }),
    remove: jest.fn().mockResolvedValue(undefined),
    disclosure: jest.fn().mockResolvedValue(disclosure),
    authorization: jest.fn().mockResolvedValue(missing),
    consent: jest.fn().mockResolvedValue(undefined),
    requestAnalysis: jest.fn().mockResolvedValue(running),
    analysisJob: jest.fn().mockResolvedValue(completed),
    requestTrend: jest.fn().mockResolvedValue(trend),
    trendJob: jest.fn().mockResolvedValue(trend),
    ...overrides,
  }
}
