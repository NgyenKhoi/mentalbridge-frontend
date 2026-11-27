'use client'

import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react'

import type {
  CreateCompanionCommitmentRequest,
  ResolveCompanionCommitmentRequest,
  UpdateCompanionStateRequest,
} from '@/lib/companion-state/contract'
import {
  createCompanionCommitment,
  loadCompanionState,
  patchCompanionState,
  peekCompanionState,
  refreshCompanionState,
  resolveCompanionCommitment,
  subscribeCompanionState,
} from './companion-state'

/**
 * The signed-in account's companion state: null until the first read lands (or while it fails), then
 * live across every change made in this tab. The actions never throw; they return null on failure.
 */
export function useCompanionState(accountId: string | null) {
  const subscribe = useCallback(
    (listener: () => void) =>
      accountId ? subscribeCompanionState(accountId, listener) : () => {},
    [accountId],
  )
  const state = useSyncExternalStore(
    subscribe,
    () => (accountId ? peekCompanionState(accountId) : null),
    () => null,
  )

  useEffect(() => {
    if (accountId) void loadCompanionState(accountId)
  }, [accountId])

  const actions = useMemo(
    () => ({
      refresh: () =>
        accountId ? refreshCompanionState(accountId) : Promise.resolve(null),
      patch: (body: UpdateCompanionStateRequest) =>
        accountId
          ? patchCompanionState(accountId, body)
          : Promise.resolve(null),
      createCommitment: (body: CreateCompanionCommitmentRequest) =>
        accountId
          ? createCompanionCommitment(accountId, body)
          : Promise.resolve(null),
      resolveCommitment: (
        commitmentId: string,
        status: ResolveCompanionCommitmentRequest['status'],
      ) =>
        accountId
          ? resolveCompanionCommitment(accountId, commitmentId, status)
          : Promise.resolve(null),
    }),
    [accountId],
  )

  return { state, ...actions }
}
