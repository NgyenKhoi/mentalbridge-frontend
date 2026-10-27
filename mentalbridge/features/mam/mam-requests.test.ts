import { afterEach, describe, expect, it, vi } from 'vitest'

import { runMamRequest } from './mam-requests'
import { MAM_FALLBACK_TEXT } from './mam-targets'

const fallback = { text: MAM_FALLBACK_TEXT.EXPLAIN }

describe('runMamRequest', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns a validated answer', async () => {
    const result = await runMamRequest(
      'EXPLAIN',
      async () => ({ text: '  Một câu ngắn.  ', focusKind: 'home.next-step' }),
      new AbortController().signal,
    )
    expect(result).toEqual({
      status: 'succeeded',
      answer: { text: 'Một câu ngắn.', focusKind: 'home.next-step' },
    })
  })

  it.each([
    null,
    { text: '' },
    { text: 42 },
    { text: 'x'.repeat(601) },
    { text: 'ok', focusKind: 'https://evil.example' },
  ])('falls back to the template for invalid answer %j', async (value) => {
    const result = await runMamRequest(
      'EXPLAIN',
      async () => value,
      new AbortController().signal,
    )
    expect(result).toEqual({
      status: 'failed',
      reason: 'invalid',
      answer: fallback,
    })
  })

  it('falls back when the source fails', async () => {
    const result = await runMamRequest(
      'EXPLAIN',
      async () => {
        throw new Error('quota')
      },
      new AbortController().signal,
    )
    expect(result).toEqual({
      status: 'failed',
      reason: 'unavailable',
      answer: fallback,
    })
  })

  it('times out, aborts the source and uses the template', async () => {
    vi.useFakeTimers()
    let sourceSignal: AbortSignal | undefined
    const pending = runMamRequest(
      'WHERE_TO_START',
      (signal) => {
        sourceSignal = signal
        return new Promise(() => {})
      },
      new AbortController().signal,
      1000,
    )
    await vi.advanceTimersByTimeAsync(1000)
    await expect(pending).resolves.toEqual({
      status: 'failed',
      reason: 'timeout',
      answer: { text: MAM_FALLBACK_TEXT.WHERE_TO_START },
    })
    expect(sourceSignal?.aborted).toBe(true)
  })

  it('discards a late answer after the caller aborts', async () => {
    const controller = new AbortController()
    let finish: (value: unknown) => void = () => {}
    const pending = runMamRequest(
      'EXPLAIN',
      () => new Promise((resolve) => (finish = resolve)),
      controller.signal,
    )
    controller.abort()
    finish({ text: 'Câu trả lời muộn' })
    await expect(pending).resolves.toEqual({ status: 'aborted' })
  })
})
