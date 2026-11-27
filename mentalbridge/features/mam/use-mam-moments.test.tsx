import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { dispatchMamMoment } from './mam-moments'
import { MAM_STAY_MS, useMamMoments } from './use-mam-moments'

const account = '00000000-0000-4000-8000-0000000000aa'
const nav = vi.hoisted(() => ({ pathname: '/dashboard' }))
vi.mock('next/navigation', () => ({ usePathname: () => nav.pathname }))

afterEach(() => {
  localStorage.clear()
  vi.useRealTimers()
  nav.pathname = '/dashboard'
})

describe('useMamMoments', () => {
  it('shows a moment once, after the dock is free, and never again once closed', () => {
    const { result, rerender } = renderHook(
      ({ ready }) => useMamMoments(account, ready),
      {
        initialProps: { ready: false },
      },
    )
    act(() =>
      dispatchMamMoment({ kind: 'booking-confirmed', key: 'confirmed:a1' }),
    )
    expect(result.current.bubble).toBeNull()
    rerender({ ready: true })
    expect(result.current.bubble?.kind).toBe('story')
    expect(result.current.motion).toEqual({ loop: 'happy', shot: 'thumbs_up' })
    act(() => result.current.close())
    expect(result.current.bubble).toBeNull()
    act(() =>
      dispatchMamMoment({ kind: 'booking-confirmed', key: 'confirmed:a1' }),
    )
    expect(result.current.bubble).toBeNull()
  })

  it('keeps the Support Guide moment for the Guide page, then turns "Chỉ Mầm đi" into one lightest activity', () => {
    const { result, rerender } = renderHook(() => useMamMoments(account, true))
    act(() =>
      dispatchMamMoment({
        kind: 'guide-open',
        key: 'guide-open:first',
        activity: { title: 'Thở chậm trong 5 phút', href: '/resources/r1' },
      }),
    )
    // On the journal or the chat it would be out of context: it waits.
    expect(result.current.bubble).toBeNull()
    nav.pathname = '/support-guides/g1'
    rerender()
    const open = result.current.bubble
    if (open?.kind !== 'ask') throw new Error('ask expected')
    const pick = open.actions.find((a) => a.go === 'pick')
    if (!pick) throw new Error('pick expected')
    act(() => result.current.act(pick))
    const next = result.current.bubble
    if (next?.kind !== 'ask') throw new Error('ask expected')
    expect(next.text).toContain('Thở chậm trong 5 phút')
  })

  it('stays beside the user for a while, and "Mai Mầm nhắc mình nhé" comes back on a later day', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-27T03:00:00Z'))
    const first = renderHook(() => useMamMoments(account, true))
    act(() =>
      dispatchMamMoment({
        kind: 'plan-skipped',
        key: 'skipped:o1',
        href: '/support-plan',
      }),
    )
    const skipped = first.result.current.bubble
    if (skipped?.kind !== 'ask') throw new Error('ask expected')
    const remind = skipped.actions.find((a) => a.go === 'remind')
    if (!remind) throw new Error('remind expected')
    act(() => first.result.current.act(remind))
    expect(first.result.current.bubble).toBeNull()
    expect(first.result.current.staying).toBe(true)
    act(() => vi.advanceTimersByTime(MAM_STAY_MS))
    expect(first.result.current.staying).toBe(false)
    first.unmount()

    vi.setSystemTime(new Date('2026-11-28T03:00:00Z'))
    const next = renderHook(() => useMamMoments(account, true))
    act(() => vi.advanceTimersByTime(1))
    const reminder = next.result.current.bubble
    if (reminder?.kind !== 'ask') throw new Error('ask expected')
    expect(reminder.text).toContain('hôm nay mình làm 5 phút thôi')
    expect(reminder.actions[0]?.href).toBe('/support-plan')
  })
})

describe('plan re-ask (Free, owner 2026-11-27)', () => {
  it('asks once more on Home the day after "Để sau" on the plan, then never again', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-28T03:00:00Z'))
    localStorage.setItem(
      `mb:mam-guide:v1:${account}`,
      JSON.stringify({
        version: 1,
        startedAt: '2026-11-27T02:00:00.000Z',
        done: { journal: 'x', chat: 'x', unwind: 'x' },
        declined: {
          plan: { at: '2026-11-27T03:00:00.000Z', reoffered: false },
        },
        pending: null,
        unwindKind: 'relax',
        plan: 'FREE',
        graduatedAt: '2026-11-27T03:01:00.000Z',
      }),
    )
    nav.pathname = '/journal'
    const elsewhere = renderHook(() => useMamMoments(account, true))
    act(() => vi.advanceTimersByTime(1))
    // Only Home asks.
    expect(elsewhere.result.current.bubble).toBeNull()
    elsewhere.unmount()
    nav.pathname = '/dashboard'
    const home = renderHook(() => useMamMoments(account, true))
    act(() => vi.advanceTimersByTime(1))
    const ask = home.result.current.bubble
    if (ask?.kind !== 'ask') throw new Error('ask expected')
    expect(ask.text).toContain('Mầm hỏi lại một lần nha.')
    expect(ask.actions.map((a) => a.label)).toEqual(['Xem thử', 'Thôi, để sau'])
    act(() => home.result.current.close())
    home.unmount()
    const later = renderHook(() => useMamMoments(account, true))
    act(() => vi.advanceTimersByTime(1))
    expect(later.result.current.bubble).toBeNull()
  })
})
