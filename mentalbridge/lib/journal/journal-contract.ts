export type JournalEntry = Readonly<{
  id: string
  ownerAccountId: string
  currentRevision: number
  occurredAt: string
  createdAt: string
  updatedAt: string
  deleted: false
  tags: string[]
  encryption: Readonly<{
    algorithm: 'AES-256-GCM'
    keyId: string
    encryptedAt: string
  }>
  analysisState: 'not_requested' | 'current' | 'stale'
  content: Readonly<{ text: string; byteLength: number }>
}>

export type JournalSummary = Omit<JournalEntry, 'content'> &
  Readonly<{ content: Readonly<{ preview: string; byteLength: number }> }>

export type JournalPage = Readonly<{
  items: JournalSummary[]
  page: Readonly<{ limit: number; hasMore: boolean; nextCursor?: string }>
}>

export type JournalTombstone = Readonly<{
  id: string
  ownerAccountId: string
  deleted: true
  deletedAt: string
}>

export type JournalWrite = Readonly<{
  content: Readonly<{ text: string }>
  tags?: string[]
}>

export type JournalCreate = JournalWrite &
  Readonly<{ clientEntryId: string; occurredAt: string }>
