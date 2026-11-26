import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { dispatchMamGuide } from './mam-guide'
import { useMamGuide } from './use-mam-guide'

const ACCOUNT = 'acc-1'
const seed = (pending: unknown) =>
  window.localStorage.setItem(
    `mb:mam-guide:v1:${ACCOUNT}`,
    JSON.stringify({
      version: 1,
      startedAt: '2026-11-26T08:00:00.000Z',
      done: {},
      declined: {},
      pending,
      unwindKind: null,
      plan: null,
      graduatedAt: null,
    }),
  )

describe('useMamGuide', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    vi.useRealTimers()
    window.localStorage.clear()
    window.sessionStorage.clear()
  })

  it('plays a stored pending sequence once Mầm is free, and holds it while she is not', () => {
    seed({ after: 'result', next: 'journal' })
    const { result, rerender } = renderHook(
      ({ allowed }) => useMamGuide(ACCOUNT, allowed),
      { initialProps: { allowed: false } },
    )
    act(() => vi.advanceTimersByTime(10))
    expect(result.current.bubble).toBeNull()
    rerender({ allowed: true })
    expect(result.current.bubble).toMatchObject({
      kind: 'story',
      text: expect.stringContaining('Mầm đọc kết quả của bạn rồi nè.'),
      motion: { loop: 'curious', shot: 'nod' },
    })
    expect(result.current.progress).toEqual({ at: 0, total: 4 })
    expect(result.current.motion).toEqual({ loop: 'curious', shot: 'nod' })
    act(() => result.current.next())
    expect(result.current.bubble?.kind).toBe('story')
    expect(result.current.key).toBe('result:1')
  })

  it('resumes at the stored bubble after a reload', () => {
    seed({ after: 'result', next: 'journal' })
    const first = renderHook(() => useMamGuide(ACCOUNT, true))
    act(() => vi.advanceTimersByTime(10))
    act(() => first.result.current.next())
    first.unmount()
    const second = renderHook(() => useMamGuide(ACCOUNT, true))
    act(() => vi.advanceTimersByTime(10))
    expect(second.result.current.step).toBe(1)
  })

  it('a decline closes the sequence and is offered again next session', () => {
    seed({ after: 'result', next: 'journal' })
    const { result } = renderHook(() => useMamGuide(ACCOUNT, true))
    act(() => vi.advanceTimersByTime(10))
    act(() => result.current.close())
    expect(result.current.bubble).toBeNull()
  })

  it('ignores guide events when no layout slot is mounted and no account is given', () => {
    dispatchMamGuide({ type: 'journal-created' })
    expect(window.localStorage.length).toBe(0)
  })
})
