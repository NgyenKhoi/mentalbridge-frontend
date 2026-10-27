import {
  MAM_FALLBACK_TEXT,
  isMamTargetKind,
  type MamAnswer,
  type MamIntent,
} from './mam-targets'

// ADR "Failure and fallback": a failed, slow or invalid answer becomes the
// intent's template; Mầm never shows text it could not validate.
export const MAM_REQUEST_TIMEOUT_MS = 8000
const MAX_ANSWER_LENGTH = 600

export type MamRequestResult =
  | Readonly<{ status: 'succeeded'; answer: MamAnswer }>
  | Readonly<{
      status: 'failed'
      reason: 'timeout' | 'invalid' | 'unavailable'
      answer: MamAnswer
    }>
  | Readonly<{ status: 'aborted' }>

function validAnswer(value: unknown): MamAnswer | null {
  if (!value || typeof value !== 'object') return null
  const { text, focusKind } = value as Record<string, unknown>
  if (typeof text !== 'string') return null
  const trimmed = text.trim()
  if (!trimmed || trimmed.length > MAX_ANSWER_LENGTH) return null
  if (focusKind !== undefined && !isMamTargetKind(focusKind)) return null
  return focusKind === undefined
    ? { text: trimmed }
    : { text: trimmed, focusKind }
}

/**
 * Runs one starter. The caller aborts on dismiss or route change; an aborted
 * request resolves `aborted` and its late answer is never returned.
 */
export async function runMamRequest(
  intent: MamIntent,
  resolve: (signal: AbortSignal) => Promise<unknown>,
  signal: AbortSignal,
  timeoutMs = MAM_REQUEST_TIMEOUT_MS,
): Promise<MamRequestResult> {
  const controller = new AbortController()
  const abort = () => controller.abort()
  if (signal.aborted) return { status: 'aborted' }
  signal.addEventListener('abort', abort, { once: true })
  let timer: ReturnType<typeof setTimeout> | undefined
  const fallback = (reason: 'timeout' | 'invalid' | 'unavailable') =>
    ({
      status: 'failed',
      reason,
      answer: { text: MAM_FALLBACK_TEXT[intent] },
    }) as const
  try {
    const raced = await Promise.race([
      resolve(controller.signal).then(
        (value) => ({ kind: 'value' as const, value }),
        () => ({ kind: 'error' as const }),
      ),
      new Promise<{ kind: 'timeout' }>((done) => {
        timer = setTimeout(() => done({ kind: 'timeout' }), timeoutMs)
      }),
      new Promise<{ kind: 'aborted' }>((done) => {
        controller.signal.addEventListener(
          'abort',
          () => done({ kind: 'aborted' }),
          { once: true },
        )
      }),
    ])
    if (signal.aborted || raced.kind === 'aborted') return { status: 'aborted' }
    if (raced.kind === 'timeout') {
      controller.abort()
      return fallback('timeout')
    }
    if (raced.kind === 'error') return fallback('unavailable')
    const answer = validAnswer(raced.value)
    return answer ? { status: 'succeeded', answer } : fallback('invalid')
  } finally {
    clearTimeout(timer)
    signal.removeEventListener('abort', abort)
  }
}
