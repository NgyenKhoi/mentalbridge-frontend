import type { components } from '@/contracts/journal.generated'

type JournalSchemas = components['schemas']

export type JournalEntry = Readonly<JournalSchemas['JournalEntry']>
export type JournalMood = JournalSchemas['JournalMood']
export type JournalSummary = Readonly<JournalSchemas['JournalEntrySummary']>
export type JournalPage = Readonly<JournalSchemas['JournalListResponse']>
export type JournalTombstone = Readonly<JournalSchemas['JournalTombstone']>
export type JournalWrite = Readonly<JournalSchemas['ReviseJournalRequest']>
export type JournalCreate = Readonly<JournalSchemas['CreateJournalRequest']>
export type AnalysisJob = Readonly<JournalSchemas['AnalysisJob']>
export type AnalysisResult = Readonly<
  JournalSchemas['NormalizedAnalysisResult']
>
export type AnalysisTerminalReason = JournalSchemas['AnalysisTerminalReason']
export type SuggestedAction = AnalysisResult['suggestedAction']
