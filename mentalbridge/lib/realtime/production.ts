import type { RealtimeTransport } from './transport'

export type BrowserHandshakeDecision =
  | { readonly kind: 'unavailable'; readonly reason: string }
  | {
      readonly kind: 'short-lived-socket-credential'
      readonly architectureDecisionId: string
    }
  | {
      readonly kind: 'same-origin-termination'
      readonly architectureDecisionId: string
    }

export type ProductionRealtimeBoundary =
  | {
      readonly status: 'fail-closed'
      readonly reason: string
      connect(): never
    }
  | {
      readonly status: 'approved'
      readonly decision: BrowserHandshakeDecision
      readonly transport: RealtimeTransport
    }

export function createProductionRealtimeBoundary(
  decision: BrowserHandshakeDecision,
  approvedTransport?: RealtimeTransport,
): ProductionRealtimeBoundary {
  if (decision.kind === 'unavailable' || !approvedTransport) {
    const reason =
      decision.kind === 'unavailable'
        ? decision.reason
        : 'Approved handshake strategy has no server-owned credential adapter.'
    return {
      status: 'fail-closed',
      reason,
      connect(): never {
        throw new Error(reason)
      },
    }
  }
  return { status: 'approved', decision, transport: approvedTransport }
}

export const currentProductionRealtimeBoundary =
  createProductionRealtimeBoundary({
    kind: 'unavailable',
    reason:
      'No approved short-lived socket credential or same-origin termination contract exists.',
  })
