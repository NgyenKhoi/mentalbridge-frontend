import { act, renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockServer } from '@/tests/mocks/server'
import { localToday, shiftLocalDate } from './companion-copy'
import { resetCompanionStateForTests } from './companion-state'
import { resetMamDailyMemory } from './mam-daily'
import { dispatchMamMoment } from './mam-moments'
import { MAM_STAY_MS, useMamMoments } from './use-mam-moments'

const account = '00000000-0000-4000-8000-0000000000aa'
const nav = vi.hoisted(() => ({ pathname: '/dashboard' }))
vi.mock('next/navigation', () => ({ usePathname: () => nav.pathname }))

afterEach(() => {
  localStorage.clear()
  resetMamDailyMemory()
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

describe('"Mai Mầm nhắc mình nhé" and the server lời hẹn', () => {
  it('also makes one PLAN_ACTIVITY lời hẹn of 5 minutes for tomorrow, from the plan skip', async () => {
    let body: unknown = null
    mockServer.use(
      http.post('/api/companion-state/commitments', async ({ request }) => {
        body = await request.json()
        // A full list answers 409; the reminder must not care.
        return HttpResponse.json(
          {
            type: '/problems/commitment_limit',
            title: 'x',
            status: 409,
            code: 'COMMITMENT_LIMIT',
            correlationId: 'c',
          },
          { status: 409 },
        )
      }),
    )
    const { result } = renderHook(() => useMamMoments(account, true))
    act(() =>
      dispatchMamMoment({
        kind: 'plan-skipped',
        key: 'skipped:o2',
        href: '/support-plan',
      }),
    )
    const skipped = result.current.bubble
    if (skipped?.kind !== 'ask') throw new Error('ask expected')
    const remind = skipped.actions.find((a) => a.go === 'remind')
    if (!remind) throw new Error('remind expected')
    act(() => result.current.act(remind))
    await waitFor(() =>
      expect(body).toEqual({
        kind: 'PLAN_ACTIVITY',
        minutes: 5,
        dueOn: shiftLocalDate(localToday(), 1),
        source: 'PLAN_SKIP',
      }),
    )
    expect(result.current.staying).toBe(true)
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

  it('drops a waiting moment the server says was already seen on another device', async () => {
    resetCompanionStateForTests()
    mockServer.use(
      http.get('/api/companion-state', async () => {
        await new Promise((resolve) => setTimeout(resolve, 30))
        return HttpResponse.json({
          focus: null,
          chapters: [],
          commitments: [],
          ui: { guide: null, seen: ['confirmed:other-device'] },
          revision: 1,
        })
      }),
    )
    const { result } = renderHook(() => useMamMoments(account, true))
    act(() =>
      dispatchMamMoment({
        kind: 'booking-confirmed',
        key: 'confirmed:other-device',
      }),
    )
    expect(result.current.bubble?.kind).toBe('story')

    await waitFor(() => expect(result.current.bubble).toBeNull())
  })
})
