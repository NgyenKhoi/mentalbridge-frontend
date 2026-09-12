import { describe, expect, it } from 'vitest'
import {
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
    expect(parseJournalWrite({ content: { text: 'text' }, mood: 5 })).toBeNull()
    expect(
      parseJournalWrite({ content: { text: 'text' }, tags: ['same', 'same'] }),
    ).toBeNull()
  })
})
