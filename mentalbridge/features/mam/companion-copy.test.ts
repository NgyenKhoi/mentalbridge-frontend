import { describe, expect, it } from 'vitest'

import type { CompanionCommitment } from '@/lib/companion-state/contract'
import {
  COMMITMENT_CHIP,
  COMMITMENT_CHIP_KINDS,
  COMMITMENT_PHRASE,
  COMPANION_GOALS,
  GOAL_LABEL,
  GOAL_PHRASE,
  dueCommitment,
  focusSavedLine,
  commitmentSavedLine,
  previousLocalDate,
  shiftLocalDate,
} from './companion-copy'

const item = (patch: Partial<CompanionCommitment>): CompanionCommitment => ({
  id: '30000000-0000-4000-8000-000000000001',
  kind: 'REST',
  minutes: 5,
  dueOn: '2026-11-27',
  source: 'HOME',
  status: 'OPEN',
  createdAt: '2026-11-26T08:00:00.000Z',
  resolvedAt: null,
  ...patch,
})

describe('companion copy tables', () => {
  it('names every goal and kind once, with the reviewed wording', () => {
    expect(COMPANION_GOALS.map((goal) => GOAL_LABEL[goal])).toEqual([
      'Giấc ngủ',
      'Áp lực học hoặc làm',
      'Cảm giác cô đơn',
      'Chuyện gia đình',
      'Các mối quan hệ',
      'Cách mình nhìn bản thân',
      'Mình chưa rõ',
    ])
    expect(GOAL_PHRASE.SELF_WORTH).toBe('cách bạn nhìn bản thân')
    expect(GOAL_PHRASE.NOT_SURE).toBeNull()
    expect(COMMITMENT_CHIP.SPECIALIST_STEP).toBeNull()
    expect(COMMITMENT_CHIP_KINDS).not.toContain('SPECIALIST_STEP')
    expect(COMMITMENT_CHIP_KINDS.map((kind) => COMMITMENT_CHIP[kind])).toEqual([
      'Học/làm 1 bước',
      'Nghỉ, ngủ sớm',
      'Vận động nhẹ',
      'Nhắn cho 1 người',
      'Viết nhật ký',
      'Thư giãn',
      '1 việc trong kế hoạch',
    ])
    expect(COMMITMENT_PHRASE.SPECIALIST_STEP).toBe(
      'một bước đã thống nhất với chuyên gia',
    )
  })

  it('says what was saved, with a line of its own for "chưa rõ"', () => {
    expect(focusSavedLine('SLEEP')).toBe(
      'Ok, 14 ngày tới mình để ý giấc ngủ nhé.',
    )
    expect(focusSavedLine('NOT_SURE')).toBe(
      'Ok, mình cứ đi rồi tìm ra dần nhé.',
    )
  })
})

describe('dueCommitment', () => {
  const today = '2026-11-27'

  it('steps back a day across month and year ends', () => {
    expect(previousLocalDate('2026-03-01')).toBe('2026-02-28')
    expect(previousLocalDate('2027-01-01')).toBe('2026-12-31')
  })

  it('picks the newest open commitment due yesterday or today', () => {
    const older = item({ id: 'a', dueOn: '2026-11-26' })
    const newer = item({
      id: 'b',
      dueOn: '2026-11-27',
      createdAt: '2026-11-26T20:00:00.000Z',
    })

    expect(dueCommitment({ commitments: [newer, older] }, today)?.id).toBe('b')
    expect(dueCommitment({ commitments: [older, newer] }, today)?.id).toBe('b')
  })

  it('ignores answered, older, future and missing commitments', () => {
    expect(
      dueCommitment(
        {
          commitments: [
            item({ status: 'DONE' }),
            item({ status: 'NOT_YET' }),
            item({ dueOn: '2026-11-25' }),
            item({ dueOn: '2026-11-28' }),
          ],
        },
        today,
      ),
    ).toBeNull()
    expect(dueCommitment(null, today)).toBeNull()
    expect(dueCommitment({ commitments: [] }, today)).toBeNull()
  })
})

describe('companion copy helpers (W3)', () => {
  it('shifts local dates across month ends', () => {
    expect(shiftLocalDate('2026-11-30', 1)).toBe('2026-12-01')
    expect(shiftLocalDate('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('says what was saved, in the user words', () => {
    expect(commitmentSavedLine('MOVE', 'tomorrow')).toBe(
      'Đã hẹn: vận động nhẹ, ngày mai. Mầm sẽ hỏi lại.',
    )
    expect(commitmentSavedLine('CONNECT_PERSON', 'today')).toBe(
      'Đã hẹn: nhắn hoặc gọi cho một người, hôm nay. Mầm sẽ hỏi lại.',
    )
  })
})
