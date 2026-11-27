// Unsent companion text is sensitive: tab-scoped sessionStorage only, never localStorage.
// Every access is guarded because storage can be missing or throw (private mode, blocked site data).
const ROOT = 'mb.companion.'
const DRAFT = `${ROOT}draft.`
const PENDING = `${ROOT}pending.`

const scoped = (prefix: string, accountId: string, conversationId: string) =>
  `${prefix}${accountId}.${conversationId}`

export function readCompanionDraft(
  accountId: string,
  conversationId: string,
): string {
  try {
    return (
      window.sessionStorage.getItem(scoped(DRAFT, accountId, conversationId)) ??
      ''
    )
  } catch {
    return ''
  }
}

/** An empty or whitespace-only draft removes its key. */
export function writeCompanionDraft(
  accountId: string,
  conversationId: string,
  text: string,
) {
  try {
    const key = scoped(DRAFT, accountId, conversationId)
    if (text.trim()) window.sessionStorage.setItem(key, text)
    else window.sessionStorage.removeItem(key)
  } catch {
    // The draft stays in component state only.
  }
}

export const clearCompanionDraft = (
  accountId: string,
  conversationId: string,
) => writeCompanionDraft(accountId, conversationId, '')

/** A send whose outcome may be unknown: the key is valid only for exactly this text. */
export type CompanionPending = Readonly<{ key: string; text: string }>

export function readCompanionPending(
  accountId: string,
  conversationId: string,
): CompanionPending | null {
  try {
    const raw = window.sessionStorage.getItem(
      scoped(PENDING, accountId, conversationId),
    )
    const value = raw ? (JSON.parse(raw) as Partial<CompanionPending>) : null
    return typeof value?.key === 'string' && typeof value.text === 'string'
      ? { key: value.key, text: value.text }
      : null
  } catch {
    return null
  }
}

export function writeCompanionPending(
  accountId: string,
  conversationId: string,
  pending: CompanionPending,
) {
  try {
    window.sessionStorage.setItem(
      scoped(PENDING, accountId, conversationId),
      JSON.stringify({ key: pending.key, text: pending.text }),
    )
  } catch {
    // The command stays in component state only.
  }
}

export function clearCompanionPending(
  accountId: string,
  conversationId: string,
) {
  try {
    window.sessionStorage.removeItem(scoped(PENDING, accountId, conversationId))
  } catch {
    // Nothing to remove.
  }
}

/** Logout: removes every account's drafts and pending commands in this tab. */
export function clearAllCompanionDrafts() {
  try {
    const storage = window.sessionStorage
    for (let index = storage.length - 1; index >= 0; index -= 1) {
      const key = storage.key(index)
      if (key?.startsWith(ROOT)) storage.removeItem(key)
    }
  } catch {
    // Nothing readable to clear.
  }
}
