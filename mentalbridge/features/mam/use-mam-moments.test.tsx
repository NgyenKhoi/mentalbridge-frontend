import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { dispatchMamMoment } from './mam-moments'
import { MAM_STAY_MS, useMamMoments } from './use-mam-moments'

const account = '00000000-0000-4000-8000-0000000000aa'

afterEach(() => {
  localStorage.clear()
  vi.useRealTimers()
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

  it('turns "Chỉ Mầm đi" into the one lightest activity', () => {
    const { result } = renderHook(() => useMamMoments(account, true))
    act(() =>
      dispatchMamMoment({
        kind: 'guide-open',
        key: 'guide-open:first',
        activity: { title: 'Thở chậm trong 5 phút', href: '/resources/r1' },
      }),
    )
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
