import { afterEach, describe, expect, it } from 'vitest'

import { MAM_BANNED_WORDS } from './mam-lines'
import {
  MAM_GUIDE_CRUDE_WORDS,
  actGuide,
  guideHoldMs,
  parseMamGuideEvent,
  readGuide,
  reduceGuide,
  sequenceFor,
  startGuideSession,
  writeGuide,
  type MamGuidePending,
  type MamGuidePlan,
  type MamGuideState,
} from './mam-guide'

const T0 = '2026-11-26T10:00:00.000Z'
const T1 = '2026-11-26T10:05:00.000Z'

const started = () =>
  reduceGuide(null, { type: 'result', tier: 'SELF_GUIDED_SUPPORT' }, T0)!

describe('mam guide state', () => {
  afterEach(() => window.localStorage.clear())

  it('starts on a first mild result with the result sequence pending', () => {
    expect(started().pending).toEqual({ after: 'result', next: 'journal' })
  })

  it('does not start for other tiers or without a result (pre-release accounts)', () => {
    expect(
      reduceGuide(
        null,
        { type: 'result', tier: 'PROFESSIONAL_SUPPORT_RECOMMENDED' },
        T0,
      ),
    ).toBeNull()
    expect(reduceGuide(null, { type: 'journal-created' }, T0)).toBeNull()
  })

  it('marks the first journal once and offers the chat next', () => {
    const once = reduceGuide(
      actGuide(started(), 'journal', T0),
      { type: 'journal-created' },
      T1,
    )!
    expect(once.done.journal).toBe(T1)
    expect(once.pending).toEqual({ after: 'journal', next: 'chat' })
    const twice = reduceGuide(
      { ...once, pending: null },
      { type: 'journal-created' },
      T1,
    )!
    expect(twice.pending).toBeNull()
  })

  it('counts the chat after 3 user turns and keeps the plan', () => {
    const s = started()
    const two = reduceGuide(
      s,
      { type: 'chat-replied', userTurns: 2, plan: 'PLUS' },
      T1,
    )!
    expect(two.done.chat).toBeUndefined()
    expect(two.plan).toBe('PLUS')
    const three = reduceGuide(
      two,
      { type: 'chat-replied', userTurns: 3, plan: 'PLUS' },
      T1,
    )!
    expect(three.done.chat).toBe(T1)
    expect(three.pending).toEqual({ after: 'chat', next: 'journal' })
  })

  it('Free: after the relaxation Mầm tells about the plan once, never sells, and graduates either way', () => {
    let s: MamGuideState = started()
    s = reduceGuide(s, { type: 'journal-created' }, T1)!
    s = reduceGuide(
      s,
      { type: 'chat-replied', userTurns: 3, plan: 'FREE' },
      T1,
    )!
    s = reduceGuide(s, { type: 'resource-done' }, T1)!
    // Not graduated bare: the plan comes first (owner 2026-11-27).
    expect(s.pending).toEqual({ after: 'relax', next: 'plan' })
    const teaser = sequenceFor(s.pending!, s)
    expect(teaser[0]).toMatchObject({
      text: expect.stringContaining('Bạn thấy nhẹ hơn được chút nào chưa?'),
    })
    expect(teaser.at(-1)).toMatchObject({
      kind: 'ask',
      text: expect.stringContaining(
        'xem thôi cũng được, không mua cũng không sao đâu',
      ),
      actions: [
        { label: 'Xem gói Plus', go: 'plus' },
        { label: 'Để sau đi', go: 'decline' },
      ],
    })
    // "Xem gói Plus": back from /subscription, one line, then the Free graduation with the plan in it.
    const viewed = actGuide(s, 'plus', T1)
    expect(viewed.pending).toEqual({ after: 'plus', next: 'graduate' })
    const lines = sequenceFor(viewed.pending!, viewed).map((b) =>
      b.kind === 'consent' ? '' : b.text,
    )
    expect(lines[0]).toContain('Bạn xem xong rồi nè.')
    expect(lines.at(-1)).toContain(
      'Muốn có kế hoạch để Mầm nhắc mỗi ngày thì vào Gói Plus nhé.',
    )
    // "Để sau đi": one gentle line, a single graduate button, never asked again by the walk.
    const later = actGuide(s, 'decline', T1)
    expect(later.declined.plan).toEqual({ at: T1, reoffered: false })
    expect(sequenceFor(later.pending!, later)).toEqual([
      expect.objectContaining({
        kind: 'ask',
        text: expect.stringContaining('Ok, để sau cũng được, không sao đâu.'),
        actions: [{ label: 'Chịu, Mầm ơi', tone: 'primary', go: 'graduate' }],
      }),
    ])
    const graduated = actGuide(later, 'graduate', T1)
    expect(graduated.graduatedAt).toBe(T1)
    expect(reduceGuide(graduated, { type: 'journal-created' }, T1)).toBe(
      graduated,
    )
  })

  it('Plus: after the chat Mầm makes the plan first, practises inside it, then graduates with it', () => {
    let s: MamGuideState = started()
    s = reduceGuide(s, { type: 'journal-created' }, T1)!
    s = reduceGuide(
      s,
      { type: 'chat-replied', userTurns: 3, plan: 'PLUS' },
      T1,
    )!
    expect(s.pending).toEqual({ after: 'chat', next: 'plan' })
    expect(sequenceFor(s.pending!, s).at(-1)).toMatchObject({
      kind: 'ask',
      actions: [
        { label: 'Tạo kế hoạch với Mầm', go: 'plan' },
        { go: 'decline' },
      ],
    })
    s = actGuide(s, 'plan', T1)
    // A separate resource does not count while the new plan waits for its first activity.
    expect(
      reduceGuide({ ...s, planCreatedAt: T1 }, { type: 'resource-done' }, T1),
    ).toEqual({ ...s, planCreatedAt: T1 })
    s = reduceGuide(s, { type: 'plan-created' }, T1)!
    expect(s.pending).toEqual({ after: 'plan-created', next: 'plan' })
    expect(sequenceFor(s.pending!, s).at(-1)).toMatchObject({
      text: expect.stringContaining('Tạo xong rồi nè.'),
      actions: [
        { label: 'Thử việc đầu tiên', go: 'plan-today' },
        { label: 'Để mai làm', go: 'decline' },
      ],
    })
    s = actGuide(s, 'plan-today', T1)
    s = reduceGuide(s, { type: 'plan-activity-done' }, T1)!
    expect(s.pending).toEqual({ after: 'plan', next: 'graduate' })
    expect(s.unwindKind).toBe('plan')
    const lines = sequenceFor(s.pending!, s).map((b) =>
      b.kind === 'consent' ? '' : b.text,
    )
    expect(lines[0]).toContain('5 phút thôi là xong 1 việc trong kế hoạch rồi')
    expect(lines.join(' ')).toContain('rồi làm 1 việc trong kế hoạch')
  })

  it('Free graduated after "Để sau" on the plan is not re-offered the plan by the walk', () => {
    let s: MamGuideState = started()
    s = reduceGuide(s, { type: 'journal-created' }, T1)!
    s = reduceGuide(
      s,
      { type: 'chat-replied', userTurns: 3, plan: 'FREE' },
      T1,
    )!
    s = reduceGuide(s, { type: 'resource-done' }, T1)!
    const later = actGuide(s, 'decline', T1)
    expect(startGuideSession({ ...later, pending: null }).pending).toBeNull()
  })

  it('offers a declined step once more on the next session, never again after that', () => {
    const declined = actGuide(started(), 'decline', T0)
    expect(declined.declined.journal).toEqual({ at: T0, reoffered: false })
    const reoffered = startGuideSession(declined)
    expect(reoffered.pending).toEqual({ after: 'reoffer', next: 'journal' })
    const again = actGuide(reoffered, 'decline', T1)
    expect(startGuideSession(again).pending).toBeNull()
  })

  it('relax first, then the journal: the walk goes on from the side path', () => {
    const relaxing = actGuide(started(), 'relax', T0)
    expect(relaxing.pending).toBeNull()
    // Left half way: the next session picks the walk up at the journal.
    expect(startGuideSession(relaxing).pending).toEqual({
      after: 'reoffer',
      next: 'journal',
    })
    // Finished: Mầm answers the relaxation, then offers the journal.
    const relaxed = reduceGuide(relaxing, { type: 'resource-done' }, T1)!
    expect(relaxed.pending).toEqual({ after: 'relax', next: 'journal' })
    expect(sequenceFor(relaxed.pending!, relaxed).at(-1)).toMatchObject({
      kind: 'ask',
      actions: [
        { go: 'journal', tone: 'primary' },
        { go: 'decline', tone: 'secondary' },
      ],
    })
  })

  it('a step done after a decline clears the decline', () => {
    const declined = actGuide(started(), 'decline', T0)
    const done = reduceGuide(declined, { type: 'journal-created' }, T1)!
    expect(done.declined.journal).toBeUndefined()
  })

  it('round-trips through storage so a reload resumes the pending sequence', () => {
    const s = started()
    writeGuide('acc-1', s)
    expect(readGuide('acc-1')).toEqual(s)
    expect(readGuide('acc-2')).toBeNull()
    window.localStorage.setItem('mb:mam-guide:v1:acc-3', '{oops')
    expect(readGuide('acc-3')).toBeNull()
  })

  it('parses only well-formed events of this account', () => {
    expect(
      parseMamGuideEvent({ type: 'journal-created', accountId: 'a' }, 'a'),
    ).toEqual({
      type: 'journal-created',
    })
    expect(
      parseMamGuideEvent({ type: 'journal-created', accountId: 'b' }, 'a'),
    ).toBeNull()
    expect(
      parseMamGuideEvent(
        { type: 'chat-replied', userTurns: 3, plan: 'GOLD', accountId: 'a' },
        'a',
      ),
    ).toBeNull()
  })
})

describe('mam guide sequences', () => {
  const afters: MamGuidePending['after'][] = [
    'result',
    'journal',
    'chat',
    'call',
    'relax',
    'reoffer',
  ]
  const nexts: MamGuidePending['next'][] = [
    'journal',
    'chat',
    'unwind',
    'graduate',
    null,
  ]
  const plans: (MamGuidePlan | null)[] = [null, 'FREE', 'PLUS', 'PREMIUM']
  const all = afters.flatMap((after) =>
    nexts.flatMap((next) =>
      plans.map((plan) =>
        sequenceFor({ after, next }, { plan, unwindKind: 'call' }),
      ),
    ),
  )

  it('every sequence needs at most 2 clicks', () => {
    for (const bubbles of all)
      expect(
        bubbles.filter((b) => b.kind !== 'story').length,
      ).toBeLessThanOrEqual(2)
  })

  it('the FREE plan is never offered a call', () => {
    for (const plan of [null, 'FREE'] as const) {
      const ask = sequenceFor(
        { after: 'chat', next: 'unwind' },
        { plan, unwindKind: null },
      ).at(-1)
      expect(
        ask?.kind === 'ask' && ask.actions.some((a) => a.go === 'call'),
      ).toBe(false)
    }
    const plus = sequenceFor(
      { after: 'chat', next: 'unwind' },
      { plan: 'PLUS', unwindKind: null },
    ).at(-1)
    expect(plus?.kind === 'ask' && plus.actions[0].go).toBe('call')
  })

  it('every line is short, clean and never clinical', () => {
    const texts = all
      .flat()
      .flatMap((b) =>
        b.kind === 'story'
          ? [b.text, b.withContext ?? '']
          : b.kind === 'ask'
            ? [b.text]
            : [],
      )
    for (const text of texts.filter(Boolean)) {
      expect(text.split(/[.?!]+\s/).length).toBeLessThanOrEqual(5)
      const lower = text.toLowerCase()
      for (const word of [...MAM_BANNED_WORDS, ...MAM_GUIDE_CRUDE_WORDS])
        expect(lower.split(/[\s,.:?!]+/)).not.toContain(word)
      expect(lower).not.toMatch(/thôi[.!]?$/)
    }
  })

  it('every ask bubble offers a way out except graduation', () => {
    for (const bubbles of all)
      for (const b of bubbles)
        if (b.kind === 'ask' && !b.actions.some((a) => a.go === 'graduate'))
          expect(b.actions.some((a) => a.go === 'decline')).toBe(true)
  })

  it('stories hold 4 to 5 seconds', () => {
    expect(guideHoldMs('Nè')).toBe(4000)
    expect(guideHoldMs('x'.repeat(120))).toBe(8000)
    expect(guideHoldMs('x'.repeat(400))).toBe(9000)
  })
})
