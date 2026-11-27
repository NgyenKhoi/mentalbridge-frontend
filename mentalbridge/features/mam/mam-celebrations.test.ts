import { describe, expect, it } from 'vitest'

import type {
  AchievementCollection,
  ResourceBingoBoard,
} from '@/lib/content/content-validation'

import {
  achievementKey,
  awardsFromAchievements,
  awardsFromBingo,
  bingoKey,
  emptyMamRecord,
  interruptMamAppearance,
  mamAppearanceText,
  mamRetryAt,
  nextMamAppearance,
  observeMamAwardRead,
  observeMamRead,
  parseMamAwardRead,
  parseMamRecord,
  pruneMamRecord,
  reserveMamAppearance,
  reserveMamNext,
  returnMamAppearance,
  takeMamNote,
  takeMamNoteFor,
  type MamAward,
  type MamAwardRead,
  type MamCelebrationEnv,
  type MamRecord,
} from './mam-celebrations'

const MIN = 60_000
const HOUR = 60 * MIN
const NOW = new Date(2026, 9, 27, 10, 0, 0).getTime()
const SESSION = 'session-1'

const achievement = (id: string, at: number, title = `Thành tựu ${id}`) =>
  ({
    key: achievementKey(id, new Date(at).toISOString()),
    kind: 'achievement',
    at,
    title,
  }) satisfies MamAward
const bingo = (position: number, at: number) =>
  ({
    key: bingoKey('2026-10-26', 'Asia/Ho_Chi_Minh', position, 'r', 'v1'),
    kind: 'bingo',
    at,
  }) satisfies MamAward

const read = (
  scope: string,
  awards: MamAward[],
  patch: Partial<MamAwardRead> = {},
): MamAwardRead => ({
  scope,
  available: true,
  visible: true,
  readAt: NOW,
  awards,
  ...patch,
})
const WINDOW = 10_000
const T0 = NOW - WINDOW
const JOURNAL = 'achievements:JOURNAL'
const BOARD = 'bingo:2026-10-26:Asia/Ho_Chi_Minh'

/** A baselined record whose awards were queued one coalescing window before `now`. */
function queued(awards: MamAward[], now = NOW, scope = JOURNAL) {
  const t = now - WINDOW
  const record = emptyMamRecord()
  observeMamRead(record, read(scope, [], { readAt: t }), t, SESSION)
  observeMamRead(record, read(scope, awards, { readAt: t }), t, SESSION)
  touch(record, t)
  return record
}

/** What `withRecord` does before it prunes: the caller's tab is live. */
const touch = (record: MamRecord, now: number, id = SESSION) => {
  record.sessions[id] = now
}

describe('keys', () => {
  it('builds the ADR presentation keys', () => {
    expect(achievementKey('d1', '2026-10-27T01:00:00Z')).toBe(
      'achievement:d1:2026-10-27T01:00:00Z',
    )
    expect(bingoKey('2026-10-26', 'Asia/Ho_Chi_Minh', 3, 'res', 'v2')).toBe(
      'bingo:2026-10-26:Asia/Ho_Chi_Minh:3:res:v2',
    )
  })
})

describe('mapping owner reads', () => {
  const item = (
    definitionId: string,
    status: string,
    unlockedAt: string | null,
    domain = 'JOURNAL',
  ) => ({
    definitionId,
    domain,
    status,
    unlockedAt,
    title: `T ${definitionId}`,
  })
  const collection = (
    items: ReturnType<typeof item>[],
    patch: Record<string, unknown> = {},
  ) =>
    ({
      visibilityState: 'VISIBLE',
      sources: [
        { domain: 'JOURNAL', availability: 'AVAILABLE' },
        { domain: 'RESOURCE', availability: 'UNAVAILABLE' },
      ],
      items,
      ...patch,
    }) as unknown as AchievementCollection

  it('keeps only EARNED items with unlockedAt, per available domain', () => {
    const reads = awardsFromAchievements(
      collection([
        item('a', 'EARNED', '2026-10-27T01:00:00Z'),
        item('b', 'GRANDFATHERED', '2026-10-27T01:00:00Z'),
        item('c', 'DEFERRED', null),
        item('d', 'SOURCE_UNAVAILABLE', null),
        item('e', 'UNEARNED', null),
        item('f', 'EARNED', null),
        item('g', 'EARNED', '2026-10-27T02:00:00Z', 'RESOURCE'),
      ]),
      NOW,
      true,
    )
    expect(reads.map((value) => [value.scope, value.available])).toEqual([
      ['achievements:JOURNAL', true],
      ['achievements:RESOURCE', false],
    ])
    expect(reads[0].awards).toEqual([
      {
        key: 'achievement:a:2026-10-27T01:00:00Z',
        kind: 'achievement',
        at: Date.parse('2026-10-27T01:00:00Z'),
        title: 'T a',
      },
    ])
    expect(reads[1].awards).toEqual([])
  })

  it('treats hidden rewards as unavailable', () => {
    const [journal] = awardsFromAchievements(
      collection([item('a', 'EARNED', '2026-10-27T01:00:00Z')], {
        visibilityState: 'HIDDEN',
      }),
      NOW,
      true,
    )
    expect(journal).toMatchObject({ available: false, awards: [] })
  })

  it('keeps only CONTENT_VERIFIED Bingo items, scoped to the board', () => {
    const board = {
      weekStart: '2026-10-26',
      timeZone: 'Asia/Ho_Chi_Minh',
      items: ['NONE', 'SELF_CONFIRMED', 'CONTENT_VERIFIED'].map(
        (evidence, position) => ({
          position,
          resourceId: 'r',
          contentVersion: 'v1',
          evidence,
          verifiedAt:
            evidence === 'CONTENT_VERIFIED' ? '2026-10-27T01:00:00Z' : null,
        }),
      ),
    } as unknown as ResourceBingoBoard
    const value = awardsFromBingo(board, NOW, false)
    expect(value).toMatchObject({
      scope: BOARD,
      available: true,
      visible: false,
    })
    expect(value.awards.map((award) => award.key)).toEqual([
      'bingo:2026-10-26:Asia/Ho_Chi_Minh:2:r:v1',
    ])
  })
})

describe('untrusted event detail', () => {
  const valid = read(JOURNAL, [achievement('a', NOW)])

  it('accepts a well-formed read', () => {
    expect(parseMamAwardRead(JSON.parse(JSON.stringify(valid)))).toEqual(valid)
  })

  it.each([
    ['null', null],
    ['an array', []],
    ['a foreign scope', { ...valid, scope: 'other:x' }],
    ['a missing flag', { ...valid, available: undefined }],
    ['a non-finite time', { ...valid, readAt: Infinity }],
    [
      'a title-less achievement',
      { ...valid, awards: [{ ...valid.awards[0], title: '' }] },
    ],
    [
      'a bingo key in an achievement scope',
      { ...valid, awards: [bingo(1, NOW)] },
    ],
    ['a non-array awards', { ...valid, awards: {} }],
    ['too many awards', { ...valid, awards: Array(201).fill(valid.awards[0]) }],
  ])('drops %s', (_name, detail) => {
    expect(parseMamAwardRead(detail)).toBeNull()
  })
})

describe('observing reads', () => {
  it('seeds the first available read silently, per scope', () => {
    const record = emptyMamRecord()
    const old = achievement('old', NOW - 2 * HOUR)
    observeMamRead(record, read(JOURNAL, [old]), NOW, SESSION)
    expect(record.queue).toEqual([])
    expect(record.seen[old.key]).toBe(old.at)
    // Another domain has its own baseline: its first read is silent too.
    const fresh = achievement('res', NOW - MIN)
    observeMamRead(record, read('achievements:RESOURCE', [fresh]), NOW, SESSION)
    expect(record.queue).toEqual([])
    // Same scope again: a new award now queues.
    const next = achievement('new', NOW - MIN)
    observeMamRead(record, read(JOURNAL, [old, next]), NOW, SESSION)
    expect(record.queue.map((entry) => entry.key)).toEqual([next.key])
  })

  it('seeds a new Bingo week silently', () => {
    const record = emptyMamRecord()
    observeMamRead(record, read(BOARD, [bingo(1, NOW)]), NOW, SESSION)
    observeMamRead(
      record,
      read(BOARD, [bingo(1, NOW), bingo(2, NOW)]),
      NOW,
      SESSION,
    )
    expect(record.queue.map((entry) => entry.key)).toEqual([bingo(2, NOW).key])
    const week2 = 'bingo:2026-11-02:Asia/Ho_Chi_Minh'
    observeMamRead(record, read(week2, [bingo(1, NOW)]), NOW, SESSION)
    expect(record.queue).toHaveLength(1)
  })

  it('never seeds from an unavailable or hidden-document read', () => {
    const record = emptyMamRecord()
    const award = achievement('a', NOW - MIN)
    observeMamRead(
      record,
      read(JOURNAL, [], { available: false }),
      NOW,
      SESSION,
    )
    observeMamRead(
      record,
      read(JOURNAL, [award], { visible: false }),
      NOW,
      SESSION,
    )
    expect(record.baselined).toEqual({})
    expect(record.seen).toEqual({})
    // The first visible, available read is still the silent seed.
    observeMamRead(record, read(JOURNAL, [award]), NOW, SESSION)
    expect(record.queue).toEqual([])
    expect(record.baselined[JOURNAL]).toBe(true)
  })

  it('does not replay seen keys on a repeated identical read', () => {
    const award = achievement('a', NOW - MIN)
    const record = queued([award])
    reserveMamAppearance(record, nextMamAppearance(record, NOW)!, NOW)
    observeMamRead(record, read(JOURNAL, [award]), NOW + HOUR, SESSION)
    expect(record.queue).toEqual([])
  })

  it('applies the 24 h cut-off at observation', () => {
    const stale = achievement('stale', NOW - 25 * HOUR)
    const edge = achievement('edge', NOW - 23 * HOUR)
    expect(queued([stale, edge]).queue.map((entry) => entry.key)).toEqual([
      edge.key,
    ])
  })

  it('drops a queued award that aged past 24 h before the next read', () => {
    const aging = achievement('aging', NOW - 23 * HOUR)
    const record = queued([aging])
    expect(record.queue).toHaveLength(1)
    const later = NOW + 2 * HOUR
    observeMamRead(
      record,
      read(JOURNAL, [aging], { readAt: later }),
      later,
      SESSION,
    )
    expect(record.lastReads[JOURNAL].eligible).toEqual([])
    expect(record.queue).toEqual([])
    expect(nextMamAppearance(record, later)).toBeNull()
  })

  it('drops queued entries the owner no longer lists', () => {
    const award = achievement('a', NOW - MIN)
    const record = queued([award])
    observeMamRead(record, read(JOURNAL, []), NOW, SESSION)
    expect(record.queue).toEqual([])
    expect(nextMamAppearance(record, NOW)).toBeNull()
  })

  it('drops all entries of a kind while the document is hidden, and when unavailable', () => {
    const record = queued([achievement('a', NOW - MIN)])
    observeMamRead(record, read(JOURNAL, [], { visible: false }), NOW, SESSION)
    expect(record.queue).toEqual([])
    const again = queued([achievement('a', NOW - MIN)])
    observeMamRead(again, read(JOURNAL, [], { available: false }), NOW, SESSION)
    expect(again.queue).toEqual([])
  })

  it('does not queue the same key twice', () => {
    const award = achievement('a', NOW - MIN)
    const record = queued([award])
    observeMamRead(record, read(JOURNAL, [award]), NOW, SESSION)
    expect(record.queue).toHaveLength(1)
  })
})

describe('release and budget', () => {
  it('waits for a read that is at most 5 minutes old and lists the key', () => {
    const record = queued([achievement('a', NOW - MIN)])
    expect(nextMamAppearance(record, T0 + 5 * MIN)).not.toBeNull()
    expect(nextMamAppearance(record, T0 + 5 * MIN + 1)).toBeNull()
  })

  it('allows one appearance per 30 minutes, from the reservation time', () => {
    const first = achievement('a', NOW - MIN)
    const record = queued([first])
    reserveMamAppearance(record, nextMamAppearance(record, NOW)!, NOW)
    const later = NOW + 10 * MIN
    const second = achievement('b', later - MIN)
    observeMamRead(
      record,
      read(JOURNAL, [first, second], { readAt: later }),
      later,
      SESSION,
    )
    expect(nextMamAppearance(record, later)).toBeNull()
    const after = NOW + 30 * MIN
    observeMamRead(
      record,
      read(JOURNAL, [first, second], { readAt: after }),
      after,
      SESSION,
    )
    expect(nextMamAppearance(record, after)?.oneShot).toBe('celebrate_soft')
  })

  it('plays hero first, then soft, and no more than 3 a day', () => {
    const awards = ['a', 'b', 'c', 'd'].map((id) => achievement(id, NOW - MIN))
    const record = emptyMamRecord()
    observeMamRead(record, read(JOURNAL, []), NOW, SESSION)
    const tiers: (string | undefined)[] = []
    for (let step = 0; step < 4; step += 1) {
      const now = NOW + step * 31 * MIN
      const t = now - WINDOW
      observeMamRead(
        record,
        read(JOURNAL, awards.slice(0, step + 1), { readAt: t }),
        t,
        SESSION,
      )
      touch(record, now)
      const appearance = nextMamAppearance(record, now)
      tiers.push(appearance?.oneShot)
      if (appearance) reserveMamAppearance(record, appearance, now)
    }
    expect(tiers).toEqual([
      'celebrate_hero',
      'celebrate_soft',
      'celebrate_soft',
      undefined,
    ])
  })

  it('resets the daily budget at the local midnight', () => {
    const lateNight = new Date(2026, 9, 27, 23, 50).getTime()
    const record = emptyMamRecord()
    for (const hero of [true, false, false])
      record.reservations.push({ atMs: lateNight - 40 * MIN, hero })
    const next = new Date(2026, 9, 28, 0, 20).getTime()
    // 40+ minutes ago, a different local day: every counter is fresh.
    const award = achievement('a', next - MIN)
    const t = next - WINDOW
    observeMamRead(record, read(JOURNAL, [], { readAt: t }), t, SESSION)
    observeMamRead(record, read(JOURNAL, [award], { readAt: t }), t, SESSION)
    touch(record, next)
    pruneMamRecord(record, next)
    expect(nextMamAppearance(record, next)?.oneShot).toBe('celebrate_hero')
  })

  it('keeps a reservation across midnight for the 30 minute cooldown', () => {
    const before = new Date(2026, 9, 27, 23, 50).getTime()
    const record = emptyMamRecord()
    record.reservations.push({ atMs: before, hero: true })
    const next = new Date(2026, 9, 28, 0, 5).getTime()
    const t = next - WINDOW
    observeMamRead(record, read(JOURNAL, [], { readAt: t }), t, SESSION)
    observeMamRead(
      record,
      read(JOURNAL, [achievement('a', next - MIN)], { readAt: t }),
      t,
      SESSION,
    )
    touch(record, next)
    pruneMamRecord(record, next)
    expect(nextMamAppearance(record, next)).toBeNull()
  })

  it('plays a verified Bingo as light_success and counts it', () => {
    const record = emptyMamRecord()
    observeMamRead(record, read(BOARD, [], { readAt: T0 }), T0, SESSION)
    observeMamRead(
      record,
      read(BOARD, [bingo(1, NOW - MIN)], { readAt: T0 }),
      T0,
      SESSION,
    )
    const appearance = nextMamAppearance(record, NOW)!
    expect(appearance.oneShot).toBe('light_success')
    expect(mamAppearanceText(appearance.entries)).toBeNull()
    reserveMamAppearance(record, appearance, NOW)
    expect(record.reservations).toEqual([{ atMs: NOW, hero: false }])
  })

  it('coalesces entries queued within 10 s into one hero with a count', () => {
    const awards = ['a', 'b', 'c'].map((id) => achievement(id, NOW - MIN))
    const record = queued(awards)
    const appearance = nextMamAppearance(record, NOW)!
    expect(appearance.oneShot).toBe('celebrate_hero')
    expect(appearance.entries).toHaveLength(3)
    expect(mamAppearanceText(appearance.entries)).toBe(
      'Bạn vừa ghi nhận “Thành tựu a” và 2 thành tựu khác.',
    )
    expect(mamAppearanceText(appearance.entries.slice(0, 1))).toBe(
      'Bạn vừa ghi nhận “Thành tựu a”.',
    )
  })

  it('leaves entries queued more than 10 s later for another appearance', () => {
    const record = queued([achievement('a', NOW - MIN)])
    const later = NOW + 11_000
    observeMamRead(
      record,
      read(
        JOURNAL,
        [achievement('a', NOW - MIN), achievement('b', later - MIN)],
        { readAt: later },
      ),
      later,
      SESSION,
    )
    expect(nextMamAppearance(record, later)?.entries).toHaveLength(1)
  })

  it('adds no copy and no effect for Bingo entries inside an achievement group', () => {
    const record = queued([achievement('a', NOW - MIN)])
    observeMamRead(record, read(BOARD, [], { readAt: T0 }), T0, SESSION)
    observeMamRead(
      record,
      read(BOARD, [bingo(1, NOW - MIN)], { readAt: T0 }),
      T0,
      SESSION,
    )
    const appearance = nextMamAppearance(record, NOW)!
    expect(appearance.oneShot).toBe('celebrate_hero')
    expect(mamAppearanceText(appearance.entries)).toBe(
      'Bạn vừa ghi nhận “Thành tựu a”.',
    )
  })

  it('reserves the keys as seen and removes them from the queue', () => {
    const award = achievement('a', NOW - MIN)
    const record = queued([award])
    reserveMamAppearance(record, nextMamAppearance(record, NOW)!, NOW)
    expect(record.queue).toEqual([])
    expect(record.seen[award.key]).toBe(award.at)
  })
})

describe('interruption', () => {
  it('returns the slot and requeues the entries, bypassing the seen check', () => {
    const award = achievement('a', NOW - MIN)
    const record = queued([award])
    const appearance = nextMamAppearance(record, NOW)!
    reserveMamAppearance(record, appearance, NOW)
    interruptMamAppearance(record, appearance, NOW, SESSION)
    expect(record.reservations).toEqual([])
    expect(record.queue.map((entry) => entry.key)).toEqual([award.key])
    expect(record.seen[award.key]).toBe(award.at)
    expect(nextMamAppearance(record, NOW + MIN)?.oneShot).toBe('celebrate_hero')
  })
})

describe('reduced motion or muted note', () => {
  it('shows the fresh achievement sentence once and marks it seen', () => {
    const record = queued([
      achievement('a', NOW - MIN),
      achievement('b', NOW - MIN),
    ])
    observeMamRead(record, read(BOARD, []), NOW, SESSION)
    observeMamRead(record, read(BOARD, [bingo(1, NOW - MIN)]), NOW, SESSION)
    expect(takeMamNote(record, NOW)).toBe(
      'Bạn vừa ghi nhận “Thành tựu a” và 1 thành tựu khác.',
    )
    expect(takeMamNote(record, NOW)).toBeNull()
    expect(record.reservations).toEqual([])
    expect(record.queue.map((entry) => entry.kind)).toEqual(['bingo'])
  })
})

describe('record storage', () => {
  it('resets a malformed record', () => {
    for (const raw of [null, '', '{', '[]', '{"v":2}', '{"v":1,"seen":1}'])
      expect(parseMamRecord(raw)).toEqual(emptyMamRecord())
  })

  it('resets the whole record when any seen entry is malformed', () => {
    const record = parseMamRecord(
      JSON.stringify({
        v: 1,
        seen: { ok: 1, bad: 'x' },
        baselined: { s: true },
        lastReads: {},
        queue: [],
        reservations: [{ atMs: 5, hero: true }],
        sessions: {},
      }),
    )
    expect(record).toEqual(emptyMamRecord())
  })

  it('drops other malformed parts but keeps the rest', () => {
    const record = parseMamRecord(
      JSON.stringify({
        v: 1,
        seen: { ok: 1 },
        baselined: { s: true, t: 'no' },
        lastReads: { s: { at: 1, eligible: ['k'] }, t: { at: 'x' } },
        queue: [{ key: 'nope' }],
        reservations: [{ atMs: 5, hero: true }, { hero: true }],
        sessions: { a: 3, b: 'x' },
      }),
    )
    expect(record.seen).toEqual({ ok: 1 })
    expect(record.sessions).toEqual({ a: 3 })
    expect(record.baselined).toEqual({ s: true })
    expect(Object.keys(record.lastReads)).toEqual(['s'])
    expect(record.queue).toEqual([])
    expect(record.reservations).toEqual([{ atMs: 5, hero: true }])
  })

  it('prunes old seen keys and day-old queue entries, and retires entries whose tabs are gone', () => {
    const record = emptyMamRecord()
    record.seen = { old: NOW - 49 * HOUR, recent: NOW - 47 * HOUR }
    record.sessions = {
      live: NOW - 29 * MIN,
      gone: NOW - 31 * MIN,
      ancient: NOW - 25 * HOUR,
    }
    const entry = {
      ...achievement('a', NOW),
      scope: JOURNAL,
      queuedAt: NOW,
      sessions: ['live'],
    }
    const retired = { ...entry, key: 'achievement:b:x', sessions: ['gone'] }
    record.queue = [
      entry,
      retired,
      { ...entry, key: 'achievement:c:x', queuedAt: NOW - 25 * HOUR },
      { ...entry, key: 'achievement:d:x', sessions: ['live', 'gone'] },
    ]
    pruneMamRecord(record, NOW)
    expect(Object.keys(record.seen).sort()).toEqual([
      'achievement:b:x',
      'achievement:c:x',
      'recent',
    ])
    expect(record.queue.map((item) => item.key)).toEqual([
      entry.key,
      'achievement:d:x',
    ])
    expect(Object.keys(record.sessions).sort()).toEqual(['gone', 'live'])
  })

  it('does not release before the coalescing window, and says when to retry', () => {
    const record = queued([achievement('a', NOW - MIN)], NOW + WINDOW)
    expect(nextMamAppearance(record, NOW + 9_999)).toBeNull()
    expect(mamRetryAt(record, NOW + 9_999)).toBe(NOW + WINDOW)
    expect(nextMamAppearance(record, NOW + WINDOW)).not.toBeNull()
  })

  it('retries at the budget deadline while the evidence is fresh, and not after it expires', () => {
    const record = queued([achievement('a', NOW - MIN)])
    record.reservations.push({ atMs: NOW - 29 * MIN, hero: true })
    expect(nextMamAppearance(record, NOW)).toBeNull()
    expect(mamRetryAt(record, NOW)).toBe(NOW + MIN)
    record.reservations = [{ atMs: NOW - 20 * MIN, hero: true }]
    // Opens at NOW + 10 min, after the read (NOW - 10 s) is more than 5 min old.
    expect(mamRetryAt(record, NOW)).toBeNull()
    record.reservations = []
    expect(mamRetryAt(queued([]), NOW)).toBeNull()
  })

  it('has no retry once the day is full', () => {
    const record = queued([achievement('a', NOW - MIN)])
    record.reservations = [-3, -2, -1].map((hours) => ({
      atMs: NOW + hours * 60_000,
      hero: false,
    }))
    expect(mamRetryAt(record, NOW)).toBeNull()
  })
})

class FakeStorage {
  items = new Map<string, string>()
  getItem(key: string) {
    return this.items.get(key) ?? null
  }
  setItem(key: string, value: string) {
    this.items.set(key, value)
  }
}

function env(patch: Partial<MamCelebrationEnv> = {}, clock = { now: NOW }) {
  const storage = new FakeStorage()
  const held: string[] = []
  const value: MamCelebrationEnv = {
    now: () => clock.now,
    storage,
    sessionId: SESSION,
    locks: {
      request: ((name: string, callback: () => unknown) => {
        held.push(name)
        return Promise.resolve(callback())
      }) as unknown as LockManager['request'],
    },
    ...patch,
  }
  return { value, storage, held, clock }
}

describe('locked operations', () => {
  const baseline = (e: MamCelebrationEnv, id = 'u1') =>
    observeMamAwardRead(id, read(JOURNAL, []), e)

  it('takes the per-account lock, seeds, queues, reserves once', async () => {
    const { value, held, clock } = env()
    await baseline(value)
    await observeMamAwardRead(
      'u1',
      read(JOURNAL, [achievement('a', NOW - MIN)]),
      value,
    )
    clock.now += WINDOW
    const reserved = await reserveMamNext('u1', value)
    expect(reserved?.reservation?.appearance.oneShot).toBe('celebrate_hero')
    expect((await reserveMamNext('u1', value))?.reservation).toBeNull()
    expect(new Set(held)).toEqual(new Set(['mentalbridge-mam-celebrations:u1']))
  })

  /** Two tabs: shared storage and clock, distinct session ids, one serialized lock. */
  function tabs() {
    const shared = env()
    let queue = Promise.resolve<unknown>(undefined)
    const locks = {
      request: ((_name: string, callback: () => unknown) => {
        const run = queue.then(callback)
        queue = run.catch(() => undefined)
        return run
      }) as unknown as LockManager['request'],
    }
    return {
      a: { ...shared.value, locks, sessionId: 'tab-a' },
      b: { ...shared.value, locks, sessionId: 'tab-b' },
      clock: shared.clock,
      storage: shared.storage,
    }
  }

  it('lets exactly one of two independent tabs play (distinct sessions, interleaved)', async () => {
    const { a, b, clock } = tabs()
    const award = read(JOURNAL, [achievement('a', NOW - MIN)])
    await baseline(a)
    await baseline(b)
    await observeMamAwardRead('u1', award, a)
    await observeMamAwardRead('u1', award, b)
    clock.now += WINDOW
    const results = await Promise.all([
      reserveMamNext('u1', a),
      reserveMamNext('u1', b),
    ])
    expect(results.filter((result) => result?.reservation)).toHaveLength(1)
    // The entry survived both tabs' pruning and is now seen: nothing is left to play.
    expect((await reserveMamNext('u1', a))?.reservation).toBeNull()
  })

  it('keeps an entry observed by one live tab for the other to play', async () => {
    const { a, b, clock } = tabs()
    await baseline(a)
    await observeMamAwardRead(
      'u1',
      read(JOURNAL, [achievement('a', NOW - MIN)]),
      a,
    )
    clock.now += WINDOW
    expect((await reserveMamNext('u1', b))?.reservation).not.toBeNull()
  })

  it('does not requeue an award after its tabs ended, on the next identical read', async () => {
    const { a, b, clock } = tabs()
    const award = read(JOURNAL, [achievement('a', NOW - MIN)])
    await baseline(a)
    await observeMamAwardRead('u1', award, a)
    // Tab A goes quiet past the liveness window; tab B opens and reads the same snapshot.
    clock.now += 31 * MIN
    await observeMamAwardRead('u1', { ...award, readAt: clock.now }, b)
    clock.now += WINDOW
    expect((await reserveMamNext('u1', b))?.reservation).toBeNull()
  })

  it('coalesces staggered reads across scopes into one appearance', async () => {
    const { value, clock } = env()
    await baseline(value)
    await observeMamAwardRead('u1', read(BOARD, []), value)
    await observeMamAwardRead(
      'u1',
      read(JOURNAL, [achievement('a', NOW - MIN)]),
      value,
    )
    clock.now += 5_000
    await observeMamAwardRead(
      'u1',
      read(BOARD, [bingo(1, NOW - MIN)], { readAt: clock.now }),
      value,
    )
    clock.now += 4_000
    const early = await reserveMamNext('u1', value)
    expect(early).toEqual({ reservation: null, retryAt: NOW + WINDOW })
    clock.now = NOW + WINDOW
    const due = await reserveMamNext('u1', value)
    expect(due?.reservation?.appearance.oneShot).toBe('celebrate_hero')
    expect(
      due?.reservation?.appearance.entries.map((entry) => entry.kind),
    ).toEqual(['achievement', 'bingo'])
  })

  it('returns a reservation to the budget', async () => {
    const { value, clock } = env()
    await baseline(value)
    await observeMamAwardRead(
      'u1',
      read(JOURNAL, [achievement('a', NOW - MIN)]),
      value,
    )
    clock.now += WINDOW
    const { reservation } = (await reserveMamNext('u1', value))!
    await returnMamAppearance(
      'u1',
      reservation!.appearance,
      reservation!.reservedAt,
      value,
    )
    expect(
      (await reserveMamNext('u1', value))?.reservation?.appearance.entries,
    ).toHaveLength(1)
  })

  it('never plays without the Web Locks API, storage, a session or an account', async () => {
    for (const patch of [
      { locks: null },
      { storage: null },
      { sessionId: null },
    ]) {
      const { value } = env(patch)
      await baseline(value)
      expect(await reserveMamNext('u1', value)).toBeNull()
    }
    const { value } = env()
    expect(await baseline(value, '')).toBeNull()
    expect(await reserveMamNext(null, value)).toBeNull()
  })

  it('stays silent when storage throws', async () => {
    const { value } = env({
      storage: {
        getItem: () => {
          throw new Error('blocked')
        },
        setItem: () => undefined,
      },
    })
    expect(await baseline(value)).toBeNull()
  })

  it('resets a corrupt stored record instead of failing', async () => {
    const { value, storage } = env()
    storage.setItem('mentalbridge_mam_celebrations:u1', '{not json')
    expect(await baseline(value)).toBeUndefined()
    expect(
      parseMamRecord(storage.getItem('mentalbridge_mam_celebrations:u1'))
        .baselined,
    ).toEqual({ [JOURNAL]: true })
  })

  it('rebaselines silently after a corrupt seen entry, with an intact baseline', async () => {
    const { value, storage, clock } = env()
    await baseline(value)
    await observeMamAwardRead(
      'u1',
      read(JOURNAL, [achievement('a', NOW - MIN)]),
      value,
    )
    clock.now += WINDOW
    expect((await reserveMamNext('u1', value))?.reservation).not.toBeNull()
    const key = 'mentalbridge_mam_celebrations:u1'
    const stored = JSON.parse(storage.getItem(key)!)
    for (const seenKey of Object.keys(stored.seen)) stored.seen[seenKey] = 'x'
    storage.setItem(key, JSON.stringify(stored))
    clock.now += 31 * MIN
    // The identical read after the corruption seeds silently instead of replaying.
    await observeMamAwardRead(
      'u1',
      read(JOURNAL, [achievement('a', NOW - MIN)], { readAt: clock.now }),
      value,
    )
    clock.now += WINDOW
    expect((await reserveMamNext('u1', value))?.reservation).toBeNull()
  })

  it('isolates two users on one device', async () => {
    const { value, clock } = env()
    await baseline(value, 'u1')
    await baseline(value, 'u2')
    await observeMamAwardRead(
      'u1',
      read(JOURNAL, [achievement('a', NOW - MIN)]),
      value,
    )
    clock.now += WINDOW
    expect((await reserveMamNext('u2', value))?.reservation).toBeNull()
    expect((await reserveMamNext('u1', value))?.reservation).not.toBeNull()
  })

  it('drops a day-old queue entry', async () => {
    const { value, clock } = env()
    await baseline(value)
    await observeMamAwardRead(
      'u1',
      read(JOURNAL, [achievement('a', NOW - MIN)]),
      value,
    )
    clock.now = NOW + 25 * HOUR
    expect((await reserveMamNext('u1', value))?.reservation).toBeNull()
  })

  it('serves the dock note without touching the budget', async () => {
    const { value, clock } = env()
    await baseline(value)
    await observeMamAwardRead(
      'u1',
      read(JOURNAL, [achievement('a', NOW - MIN)]),
      value,
    )
    expect(await takeMamNoteFor('u1', value)).toBe(
      'Bạn vừa ghi nhận “Thành tựu a”.',
    )
    expect(await takeMamNoteFor('u1', value)).toBeNull()
    clock.now += WINDOW
    expect((await reserveMamNext('u1', value))?.reservation).toBeNull()
  })
})
