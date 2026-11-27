import { beforeEach, describe, expect, it } from 'vitest'

import {
  MAM_BANNED_WORDS,
  MAM_LINES,
  MAM_LINE_MAX,
  lineKeyOfState,
  mamHoldMs,
  pickMamLine,
  resetMamLines,
  type MamLineKey,
} from './mam-lines'
import { MAM_TRAJECTORY_STATES } from './mam-trajectory'

const keys = Object.keys(MAM_LINES) as MamLineKey[]
// Seeded, so a failure is reproducible.
const seeded = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296
  return seed / 4294967296
}

describe('Mầm lines', () => {
  beforeEach(() => resetMamLines())

  it('has a line set for every spoken state and every event', () => {
    for (const state of MAM_TRAJECTORY_STATES) {
      const key = lineKeyOfState(state)
      if (state === 'NO_DATA') expect(key).toBeNull()
      else expect(key && MAM_LINES[key]).toBeTruthy()
    }
    expect(keys).toEqual(
      expect.arrayContaining([
        'JOURNAL_SAVED',
        'JOURNAL_RETURN',
        'SUPPORT_DONE',
        'SUPPORT_THIRD',
        'RESOURCE_DONE',
        'REASSESSMENT_LOWER',
        'REASSESSMENT_SAME',
        'REASSESSMENT_CARE',
      ]),
    )
  })

  it.each(keys)(
    '%s: 4 to 6 distinct short lines without banned words',
    (key) => {
      const lines: readonly string[] = MAM_LINES[key]
      expect(lines.length).toBeGreaterThanOrEqual(4)
      expect(lines.length).toBeLessThanOrEqual(6)
      expect(new Set(lines).size).toBe(lines.length)
      for (const line of lines) {
        expect([...line].length).toBeLessThanOrEqual(MAM_LINE_MAX)
        expect(line).toBe(line.trim())
        for (const word of MAM_BANNED_WORDS)
          expect(line.toLowerCase()).not.toContain(word)
        // No score, no digit and no exclamation storm: the lines name a pattern, not a number.
        expect(line).not.toMatch(/\d/)
        expect(line.match(/!/g)?.length ?? 0).toBeLessThanOrEqual(1)
      }
    },
  )

  it('bans the words a clinical or cure claim would use', () => {
    for (const word of [
      'khỏi bệnh',
      'chẩn đoán',
      'chữa',
      'đừng buồn',
      'bệnh',
      'điều trị',
      'trầm cảm',
    ])
      expect(MAM_BANNED_WORDS).toContain(word)
  })

  it('makes no claim about how often the user records, and no filler reassurance', () => {
    for (const key of keys)
      for (const line of MAM_LINES[key])
        expect(line).not.toMatch(
          /mỗi ngày|ngày nào cũng|không đọc|không sao đâu|bình thường nha|nhẹ đi một chút/i,
        )
  })

  it('keeps emoji to the light states and events', () => {
    const light: MamLineKey[] = [
      'IMPROVING',
      'STEADY_GOOD',
      'SUPPORT_DONE',
      'SUPPORT_THIRD',
    ]
    for (const key of keys)
      if (!light.includes(key))
        for (const line of MAM_LINES[key])
          expect(line).not.toMatch(/\p{Extended_Pictographic}/u)
  })

  it('never claims a cure or a cause, and the lower band says what it is', () => {
    for (const key of keys)
      for (const line of MAM_LINES[key])
        expect(line).not.toMatch(/hết bệnh|lành/i)
    expect(MAM_LINES.REASSESSMENT_LOWER[0]).toContain('thấp hơn')
  })

  it('does not repeat either of the last 2 lines of a key', () => {
    for (const key of keys) {
      resetMamLines()
      const random = seeded(7)
      const picked = Array.from({ length: 60 }, () =>
        pickMamLine(key, 'a1', random),
      )
      picked.forEach((line, index) => {
        expect(picked.slice(Math.max(0, index - 2), index)).not.toContain(line)
      })
      // All of them get their turn.
      expect(new Set(picked).size).toBe(MAM_LINES[key].length)
    }
  })

  it('remembers the last lines across a reload, so a day does not open with yesterday', () => {
    const first = pickMamLine('PERSISTENT_LOW', 'a1', () => 0)
    // The history is line numbers by state under the account's own key: no sentence, nothing of the user's.
    expect(window.localStorage.getItem('mentalbridge_mam_lines:a1')).toBe(
      '{"PERSISTENT_LOW":[0]}',
    )
    expect(window.localStorage.getItem('mentalbridge_mam_lines')).toBeNull()
    expect(pickMamLine('PERSISTENT_LOW', 'a1', () => 0)).not.toBe(first)
  })

  it('does not share the no-repeat history between accounts', () => {
    const first = pickMamLine('PERSISTENT_LOW', 'a1', () => 0)
    expect(pickMamLine('PERSISTENT_LOW', 'a2', () => 0)).toBe(first)
    expect(window.localStorage.getItem('mentalbridge_mam_lines:a2')).toBe(
      '{"PERSISTENT_LOW":[0]}',
    )
  })

  it('holds a line for 6 s, or longer for a long one', () => {
    expect(mamHoldMs('ngắn')).toBe(6000)
    expect(mamHoldMs('x'.repeat(90))).toBe(4000 + 60 * 90)
    for (const key of keys)
      for (const line of MAM_LINES[key])
        expect(mamHoldMs(line)).toBeLessThanOrEqual(9400)
  })

  it('still works, and still avoids repeats, when storage is blocked', () => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = () => {
      throw new Error('blocked')
    }
    try {
      const a = pickMamLine('FLAT', 'a1', () => 0)
      const b = pickMamLine('FLAT', 'a1', () => 0)
      expect(b).not.toBe(a)
    } finally {
      Storage.prototype.setItem = original
    }
  })
})
