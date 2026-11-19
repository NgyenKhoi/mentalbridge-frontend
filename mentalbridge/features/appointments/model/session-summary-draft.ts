// In-call notes live only in this browser until the specialist publishes the
// summary (owner decision: local draft, no server draft endpoint). localStorage
// is shared with the call window, which is a separate browser window.
export type SummaryDraft = {
  topics: string
  progress: string
  note: string
  steps: string
  savedAt: number
}

export const DRAFT_MAX_AGE_MS = 48 * 60 * 60 * 1000
const key = (appointmentId: string) => `mb.summaryDraft.${appointmentId}`
const fields = ['topics', 'progress', 'note', 'steps'] as const

export function readSummaryDraft(
  appointmentId: string,
  now = Date.now(),
): SummaryDraft | null {
  try {
    const raw = window.localStorage.getItem(key(appointmentId))
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    const draft = parsed as Partial<SummaryDraft> | null
    if (
      !draft ||
      typeof draft.savedAt !== 'number' ||
      now - draft.savedAt > DRAFT_MAX_AGE_MS ||
      fields.some((field) => typeof draft[field] !== 'string')
    ) {
      window.localStorage.removeItem(key(appointmentId))
      return null
    }
    return draft as SummaryDraft
  } catch {
    return null
  }
}

/** Returns false when the browser refuses storage. Empty notes remove the draft. */
export function writeSummaryDraft(
  appointmentId: string,
  values: Omit<SummaryDraft, 'savedAt'>,
  now = Date.now(),
): boolean {
  try {
    if (fields.every((field) => !values[field].trim()))
      window.localStorage.removeItem(key(appointmentId))
    else
      window.localStorage.setItem(
        key(appointmentId),
        JSON.stringify({ ...values, savedAt: now }),
      )
    return true
  } catch {
    return false
  }
}

export function clearSummaryDraft(appointmentId: string) {
  try {
    window.localStorage.removeItem(key(appointmentId))
  } catch {
    // Storage blocked: nothing was saved, so nothing to clear.
  }
}
