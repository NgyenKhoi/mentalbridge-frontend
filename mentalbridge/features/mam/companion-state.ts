// Mầm's server-held companion state (focus goal, chapters, lời hẹn, guide + seen moments), browser side.
// One cached copy per account for this tab; every change is published on the window so hooks and the pure
// guide/moment code see it. Nothing here throws into the UI: a failed call returns null and keeps the last state.
import { browserApiClient } from '@/lib/api/browser-client'
import { ApiError } from '@/lib/api/api-error'
import type {
  CompanionCommitment,
  CompanionState,
  CreateCompanionCommitmentRequest,
  ResolveCompanionCommitmentRequest,
  UpdateCompanionStateRequest,
} from '@/lib/companion-state/contract'
import {
  MAX_GUIDE_LENGTH,
  MAX_SEEN_ADD,
  SEEN_KEY,
  parseCompanionCommitment,
  parseCompanionState,
} from '@/lib/companion-state/validation'

export const MAM_COMPANION_STATE_EVENT = 'mam:companion-state'
/** Guide and seen-moment writes made within this window go out as one PATCH. */
export const COMPANION_WRITE_DEBOUNCE_MS = 400

type Entry = {
  state: CompanionState | null
  loading: Promise<CompanionState | null> | null
}
const entries = new Map<string, Entry>()
const entry = (accountId: string): Entry => {
  let found = entries.get(accountId)
  if (!found) entries.set(accountId, (found = { state: null, loading: null }))
  return found
}

function publish(accountId: string, state: CompanionState) {
  const cached = entry(accountId).state
  // An answer to an older request (a GET started before a PATCH, PATCHes finishing out of order) must not
  // roll the cache back.
  if (cached && state.revision < cached.revision) return
  entry(accountId).state = state
  if (typeof window !== 'undefined')
    window.dispatchEvent(
      new CustomEvent(MAM_COMPANION_STATE_EVENT, { detail: { accountId } }),
    )
}

/** The cached state of this account, or null until the first successful read. */
export const peekCompanionState = (accountId: string) =>
  entries.get(accountId)?.state ?? null

/** Calls `listener` after every change of this account's state; returns the unsubscribe. */
export function subscribeCompanionState(
  accountId: string,
  listener: () => void,
): () => void {
  const onChange = (event: Event) => {
    if (
      (event as CustomEvent<{ accountId?: string }>).detail?.accountId ===
      accountId
    )
      listener()
  }
  window.addEventListener(MAM_COMPANION_STATE_EVENT, onChange)
  return () => window.removeEventListener(MAM_COMPANION_STATE_EVENT, onChange)
}

const readState = (accountId: string) =>
  browserApiClient
    .get<unknown>('/companion-state')
    .then(({ data }) => {
      const parsed = parseCompanionState(data)
      if (parsed) publish(accountId, parsed)
      return parsed
    })
    .catch(() => null)

/** Reads the state from the server (concurrent calls share one request). Null: the read failed. */
export function refreshCompanionState(
  accountId: string,
): Promise<CompanionState | null> {
  const current = entry(accountId)
  if (current.loading) return current.loading
  const request = readState(accountId).finally(() => {
    current.loading = null
  })
  current.loading = request
  return request
}

/** The cached state, or one read from the server when nothing is cached yet. */
export const loadCompanionState = (accountId: string) =>
  peekCompanionState(accountId)
    ? Promise.resolve(peekCompanionState(accountId))
    : refreshCompanionState(accountId)

/** Merges a partial update (focus, chapter, guide, seenAdd). Returns the new state, or null when it failed. */
export async function patchCompanionState(
  accountId: string,
  body: UpdateCompanionStateRequest,
): Promise<CompanionState | null> {
  try {
    const { data } = await browserApiClient.patch<unknown>(
      '/companion-state',
      body,
    )
    const parsed = parseCompanionState(data)
    if (parsed) publish(accountId, parsed)
    return parsed
  } catch {
    return null
  }
}

// A commitment answer carries no state revision. Show it at cached + 1 (the write bumped the server by at
// least that) so an older GET cannot wipe it, then read the real state to confirm.
function withCommitment(accountId: string, commitment: CompanionCommitment) {
  const state = peekCompanionState(accountId)
  if (!state) return void refreshCompanionState(accountId)
  publish(accountId, {
    ...state,
    revision: state.revision + 1,
    commitments: [
      ...state.commitments.filter((item) => item.id !== commitment.id),
      commitment,
    ],
  })
  void readState(accountId)
}

const errorCode = (error: unknown) =>
  error instanceof ApiError ? error.code : undefined

/**
 * Makes a lời hẹn. Returns it, `'COMMITMENT_LIMIT'` when three are already open (the picker says so),
 * or null when it failed.
 */
export async function createCompanionCommitment(
  accountId: string,
  body: CreateCompanionCommitmentRequest,
): Promise<CompanionCommitment | 'COMMITMENT_LIMIT' | null> {
  try {
    const { data } = await browserApiClient.post<unknown>(
      '/companion-state/commitments',
      body,
    )
    const commitment = parseCompanionCommitment(data)
    if (commitment) withCommitment(accountId, commitment)
    return commitment
  } catch (error) {
    return errorCode(error) === 'COMMITMENT_LIMIT' ? 'COMMITMENT_LIMIT' : null
  }
}

/**
 * Answers a lời hẹn. Already answered (another tab or device) is not an error: the state is refreshed and
 * the commitment as it is now is returned. Null: it failed and nothing changed.
 */
export async function resolveCompanionCommitment(
  accountId: string,
  commitmentId: string,
  status: ResolveCompanionCommitmentRequest['status'],
): Promise<CompanionCommitment | null> {
  try {
    const { data } = await browserApiClient.patch<unknown>(
      `/companion-state/commitments/${commitmentId}`,
      { status },
    )
    const commitment = parseCompanionCommitment(data)
    if (commitment) withCommitment(accountId, commitment)
    return commitment
  } catch (error) {
    if (errorCode(error) !== 'COMMITMENT_RESOLVED') return null
    const state = await refreshCompanionState(accountId)
    return state?.commitments.find((item) => item.id === commitmentId) ?? null
  }
}

type Pending = {
  timer: number
  guide?: string | null
  seen: Set<string>
}
const pending = new Map<string, Pending>()

function flush(accountId: string) {
  const queued = pending.get(accountId)
  if (!queued) return
  pending.delete(accountId)
  const body: UpdateCompanionStateRequest = {
    ...(queued.guide !== undefined ? { guide: queued.guide } : {}),
    ...(queued.seen.size ? { seenAdd: [...queued.seen] } : {}),
  }
  // Failure keeps the local copy; the next write of the same kind tries again.
  if (Object.keys(body).length) void patchCompanionState(accountId, body)
}

/**
 * Debounced write of the guide state and/or seen-moment keys (one PATCH per 400 ms). A guide over the
 * server limit, or a key the server would refuse, stays local only.
 */
export function queueCompanionWrite(
  accountId: string,
  write: Readonly<{ guide?: string | null; seen?: string }>,
) {
  if (typeof window === 'undefined') return
  const queued = pending.get(accountId) ?? {
    timer: 0,
    seen: new Set<string>(),
  }
  window.clearTimeout(queued.timer)
  if (
    write.guide !== undefined &&
    (write.guide?.length ?? 0) <= MAX_GUIDE_LENGTH
  )
    queued.guide = write.guide
  if (
    write.seen &&
    SEEN_KEY.test(write.seen) &&
    queued.seen.size < MAX_SEEN_ADD
  )
    queued.seen.add(write.seen)
  queued.timer = window.setTimeout(
    () => flush(accountId),
    COMPANION_WRITE_DEBOUNCE_MS,
  )
  pending.set(accountId, queued)
}

/** Accounts whose guide was compared with the server this tab session (see `syncGuideFromServer`). */
export const guideSynced = new Set<string>()

/** Forgets every cached state, queued write and guide sync; sign-out calls it so nothing leaks to the next account. */
export function clearCompanionState() {
  pending.forEach((item) => window.clearTimeout(item.timer))
  pending.clear()
  entries.clear()
  guideSynced.clear()
}

/** Tests only. */
export const resetCompanionStateForTests = clearCompanionState
