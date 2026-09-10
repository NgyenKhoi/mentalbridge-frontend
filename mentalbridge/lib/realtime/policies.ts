export type EligibilityOperation = 'subscribe' | 'send' | 'history'
export type EligibilityResult = 'eligible' | 'denied' | 'unavailable'

export interface ConversationEligibility {
  check(
    conversationId: string,
    operation: EligibilityOperation,
  ): Promise<EligibilityResult>
}

export const unavailableConversationEligibility: ConversationEligibility = {
  check: async () => 'unavailable',
}

export type HistoryBoundary = {
  readonly afterEventId?: string
  readonly afterOccurredAt?: string
}
export type HistoryRecoveryResult =
  | {
      readonly status: 'recovered'
      readonly boundary: HistoryBoundary
      readonly count: number
    }
  | { readonly status: 'unavailable'; readonly reason: string }
  | { readonly status: 'failed'; readonly reason: string }

export interface RealtimeHistoryAdapter {
  recover(
    conversationId: string,
    boundary: HistoryBoundary,
  ): Promise<HistoryRecoveryResult>
}

export const unavailableHistoryAdapter: RealtimeHistoryAdapter = {
  recover: async () => ({
    status: 'unavailable',
    reason: 'Realtime REST history is planned and unavailable in production.',
  }),
}
