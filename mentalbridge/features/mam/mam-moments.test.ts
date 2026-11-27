import { waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Appointment } from '@/lib/consultation/consultation-validation'
import { mockServer } from '@/tests/mocks/server'
import {
  refreshCompanionState,
  resetCompanionStateForTests,
} from './companion-state'
import {
  appointmentMoments,
  lightestActivity,
  markMomentSeen,
  missedDayStreak,
  momentFits,
  momentSeen,
  momentSpec,
  parseMamMoment,
  type MamMomentKind,
} from './mam-moments'

const now = Date.parse('2026-11-27T03:00:00Z')
const hours = (h: number) => new Date(now + h * 3_600_000).toISOString()
const appointment = (patch: Partial<Appointment>): Appointment =>
  ({
    id: 'a1',
    status: 'REQUESTED',
    scheduledStartAt: hours(72),
    scheduledEndAt: hours(73),
    decisionDeadlineAt: hours(24),
    decidedAt: null,
    sessionEndedAt: null,
    sessionSettledAt: null,
    ...patch,
  }) as Appointment

describe('Mầm moments copy (owner 2026-11-27)', () => {
  it('keeps the owner wording and the comfort-first buttons', () => {
    const declined = momentSpec({ kind: 'booking-declined', key: 'k' })
    expect(declined.kind).toBe('ask')
    if (declined.kind !== 'ask') return
    expect(declined.text).toContain('mình tìm lịch khác với nhau nhé')
    expect(declined.text).not.toMatch(/hãy thử đặt lại/)
    expect(declined.actions.map((a) => a.label)).toEqual([
      'Tìm chuyên gia khác',
      'Để Mầm ở đây với bạn 1 chút',
    ])
    expect(declined.actions[0]?.href).toBe('/specialists')
    const skipped = momentSpec({ kind: 'plan-skipped', key: 'k' })
    if (skipped.kind !== 'ask') throw new Error('ask expected')
    expect(skipped.text).toContain('Mai mình làm 5 phút thôi cũng được')
    expect(skipped.text).not.toMatch(/bỏ lỡ|cần cố gắng/)
    // Sits beside the user: no pointing, no standing up.
    expect(skipped.motion).toEqual({ loop: 'sit_hug' })
  })

  it('names one lightest activity, never a list, and says "Hôm nay" for a session later today', () => {
    const pick = momentSpec({
      kind: 'guide-pick',
      key: 'k',
      activity: { title: 'Thở chậm trong 5 phút', href: '/resources/r1' },
    })
    if (pick.kind !== 'ask') throw new Error('ask expected')
    expect(pick.text).toBe(
      'Mầm thấy cái này nhẹ nhất nè: Thở chậm trong 5 phút. Làm 5 phút thôi là xong. Bạn thử cái này với Mầm nhé?',
    )
    expect(pick.actions[0]?.href).toBe('/resources/r1')
    expect(
      momentSpec({ kind: 'session-soon', key: 'k', today: true }).kind,
    ).toBe('ask')
    const soon = momentSpec({ kind: 'session-soon', key: 'k', today: true })
    if (soon.kind !== 'ask') throw new Error('ask expected')
    expect(soon.text.startsWith('Hôm nay bạn gặp chuyên gia')).toBe(true)
    const tomorrow = momentSpec({ kind: 'session-soon', key: 'k' })
    if (tomorrow.kind !== 'ask') throw new Error('ask expected')
    expect(tomorrow.text.startsWith('Mai bạn gặp chuyên gia')).toBe(true)
  })

  it('has a bubble for every kind', () => {
    const kinds: MamMomentKind[] = [
      'booking-requested',
      'booking-confirmed',
      'booking-declined',
      'session-soon',
      'session-done',
      'session-rating',
      'guide-open',
      'guide-pick',
      'plan-skipped',
      'plan-missed-days',
      'plan-reminder',
      'screening-half',
      'result-professional',
    ]
    for (const kind of kinds)
      expect(momentSpec({ kind, key: kind }).kind).not.toBe('consent')
  })

  it('screening-half is a story without buttons, in the owner words', () => {
    expect(momentSpec({ kind: 'screening-half', key: 'k' })).toMatchObject({
      kind: 'story',
      text: 'Xong nửa rồi nè. Còn 7 câu nữa thôi, cứ chọn cái gần nhất với bạn.',
    })
    expect(momentSpec({ kind: 'screening-half', key: 'k' })).not.toHaveProperty(
      'actions',
    )
  })

  it('result-professional keeps the specialist as the main path and the chat as the quiet one, no cheer', () => {
    const spec = momentSpec({ kind: 'result-professional', key: 'k' })
    expect(spec).toMatchObject({
      kind: 'ask',
      text: 'Cảm ơn bạn đã làm xong nè. Kết quả này là lý do tốt để nói chuyện với chuyên gia. Mầm vẫn ở đây với bạn.',
      actions: [
        {
          label: 'Tìm chuyên gia phù hợp',
          tone: 'primary',
          href: '/specialists',
        },
        {
          label: 'Kể cho Mầm nghe trước',
          tone: 'secondary',
          href: '/ai-companion?opening=FROM_RESULT',
        },
      ],
    })
    // No celebration shot on a result that points to a specialist.
    expect(
      (spec as { motion?: { shot?: string } }).motion?.shot,
    ).toBeUndefined()
  })
})

describe('momentFits on the screening', () => {
  it('speaks the screening moments there only, and keeps every other moment out of it', () => {
    const half = { kind: 'screening-half', key: 'h' } as const
    const result = { kind: 'result-professional', key: 'r' } as const
    const reminder = { kind: 'plan-reminder', key: 'p' } as const
    expect(momentFits(half, '/initial-check')).toBe(true)
    expect(momentFits(result, '/initial-check')).toBe(true)
    expect(momentFits(half, '/dashboard')).toBe(false)
    expect(momentFits(result, '/support-guides/g1')).toBe(false)
    expect(momentFits(reminder, '/initial-check')).toBe(false)
    expect(momentFits(reminder, '/dashboard')).toBe(true)
  })

  it('parses the two new kinds', () => {
    expect(parseMamMoment({ kind: 'screening-half', key: 'k' })).toEqual({
      kind: 'screening-half',
      key: 'k',
    })
    expect(parseMamMoment({ kind: 'result-professional', key: 'k' })).toEqual({
      kind: 'result-professional',
      key: 'k',
    })
  })
})

describe('appointmentMoments', () => {
  it('comforts a fresh decline first, then a session within a day, then a fresh confirmation', () => {
    const moments = appointmentMoments(
      [
        appointment({ id: 'c', status: 'CONFIRMED', decidedAt: hours(-2) }),
        appointment({
          id: 's',
          status: 'CONFIRMED',
          scheduledStartAt: hours(5),
          decidedAt: hours(-100),
        }),
        appointment({ id: 'r', status: 'REJECTED', decidedAt: hours(-1) }),
      ],
      now,
    )
    expect(moments.map((m) => m.key)).toEqual([
      'declined:r',
      'soon:s',
      'confirmed:c',
    ])
  })

  it('treats an expired request like a decline and leaves old news quiet', () => {
    expect(
      appointmentMoments(
        [
          appointment({
            id: 'e',
            status: 'EXPIRED',
            decisionDeadlineAt: hours(-3),
          }),
        ],
        now,
      ),
    ).toEqual([{ kind: 'booking-declined', key: 'declined:e' }])
    expect(
      appointmentMoments(
        [
          appointment({
            id: 'old',
            status: 'REJECTED',
            decidedAt: hours(-200),
          }),
          appointment({
            id: 'done',
            status: 'COMPLETED',
            sessionSettledAt: hours(-200),
          }),
        ],
        now,
      ),
    ).toEqual([])
  })

  it('follows a completed session with the rating nudge only where rating is on screen', () => {
    const done = [
      appointment({
        id: 'd',
        status: 'COMPLETED',
        sessionSettledAt: hours(-1),
      }),
    ]
    expect(appointmentMoments(done, now).map((m) => m.kind)).toEqual([
      'session-done',
    ])
    expect(
      appointmentMoments(done, now, { withRating: true }).map((m) => m.kind),
    ).toEqual(['session-done', 'session-rating'])
  })
})

describe('missedDayStreak', () => {
  it('counts planned days before today with nothing done, stopping at a done day', () => {
    const days = [
      { localDate: '2026-11-27', planned: 1, completed: 0 },
      { localDate: '2026-11-26', planned: 2, completed: 0 },
      { localDate: '2026-11-25', planned: 0, completed: 0 },
      { localDate: '2026-11-24', planned: 1, completed: 0 },
      { localDate: '2026-11-23', planned: 1, completed: 1 },
      { localDate: '2026-11-22', planned: 1, completed: 0 },
    ]
    expect(missedDayStreak(days, '2026-11-27')).toBe(2)
    expect(missedDayStreak([], '2026-11-27')).toBe(0)
  })
})

describe('lightestActivity', () => {
  it('prefers a short practice over reading', () => {
    expect(
      lightestActivity([
        {
          resourceId: 'a',
          contentVersion: '1',
          category: 'ARTICLE',
          title: 'Bài đọc',
        },
        {
          resourceId: 'b',
          contentVersion: '2',
          category: 'BREATHING',
          title: 'Thở chậm',
        },
      ]),
    ).toEqual({ title: 'Thở chậm', href: '/resources/b?contentVersion=2' })
    expect(lightestActivity([])).toBeNull()
  })
})

describe('parseMamMoment', () => {
  it('accepts only known kinds and same-site paths', () => {
    expect(
      parseMamMoment({ kind: 'plan-skipped', key: 'k', href: '/support-plan' }),
    ).toEqual({
      kind: 'plan-skipped',
      key: 'k',
      href: '/support-plan',
    })
    expect(
      parseMamMoment({
        kind: 'plan-skipped',
        key: 'k',
        href: 'javascript:alert(1)',
      }),
    ).toEqual({
      kind: 'plan-skipped',
      key: 'k',
    })
    expect(
      parseMamMoment({
        kind: 'guide-open',
        key: 'k',
        activity: { title: 'x', href: 'https://evil.test' },
      }),
    ).toEqual({ kind: 'guide-open', key: 'k' })
    expect(parseMamMoment({ kind: 'nope', key: 'k' })).toBeNull()
    expect(parseMamMoment({ kind: 'plan-skipped', key: '' })).toBeNull()
  })
})

describe('moment seen keys and the server copy', () => {
  const state = (seen: string[]) => ({
    focus: null,
    chapters: [],
    commitments: [],
    ui: { guide: null, seen },
    revision: 1,
  })

  beforeEach(() => {
    resetCompanionStateForTests()
    localStorage.clear()
  })

  it('reads a key as seen when only the server has it', async () => {
    mockServer.use(
      http.get('/api/companion-state', () =>
        HttpResponse.json(state(['confirmed:a1'])),
      ),
    )
    expect(momentSeen('acc-seen', 'confirmed:a1')).toBe(false)

    await refreshCompanionState('acc-seen')

    expect(momentSeen('acc-seen', 'confirmed:a1')).toBe(true)
    expect(momentSeen('acc-seen', 'confirmed:a2')).toBe(false)
    expect(momentSeen('acc-other', 'confirmed:a1')).toBe(false)
  })

  it('marks a key seen locally at once and sends it to the server once, debounced', async () => {
    const bodies: unknown[] = []
    mockServer.use(
      http.patch('/api/companion-state', async ({ request }) => {
        bodies.push(await request.json())
        return HttpResponse.json(state(['confirmed:a1']))
      }),
    )

    markMomentSeen('acc-mark', 'confirmed:a1')
    markMomentSeen('acc-mark', 'confirmed:a1')

    expect(momentSeen('acc-mark', 'confirmed:a1')).toBe(true)
    expect(bodies).toHaveLength(0)
    await waitFor(() => expect(bodies).toHaveLength(1))
    expect(bodies[0]).toEqual({ seenAdd: ['confirmed:a1'] })
  })
})
