import { describe, expect, it } from 'vitest'
import type { PlanResourceAction } from '@/features/support-plan/api/support-plan-contract'
import {
  localWeekStart,
  planResourceHref,
  planResourceSchedule,
  planResourceStatus,
} from './plan-resources'

const action: PlanResourceAction = {
  actionId: 'action-1',
  actionVersion: 1,
  title: 'Thở chậm',
  resource: {
    resourceId: 'resource-1',
    resourceVersion: '7',
    publicationId: 'publication-1',
  },
  schedule: null,
  today: null,
}

describe('plan resource presentation', () => {
  it('keeps v2 adapter actions without an invented occurrence', () => {
    expect(planResourceStatus(action)).toBe('Không có lịch hôm nay')
    expect(planResourceSchedule(action)).toBe('Không có lịch hôm nay')
    const url = new URL(
      planResourceHref(action, '2026-10-21'),
      'https://mentalbridge.test',
    )
    expect(url.searchParams.get('contentVersion')).toBe('7')
    expect(url.searchParams.get('actionId')).toBe('action-1')
    expect(url.searchParams.has('occurrenceId')).toBe(false)
    expect(url.searchParams.get('from')).toBe('support-plan')
  })
  it.each(['SCHEDULED', 'OVERDUE', 'CANCELLED'] as const)(
    'never turns %s into completed',
    (displayState) => {
      expect(
        planResourceStatus({
          ...action,
          today: {
            occurrenceId: 'occurrence-1',
            occurrenceVersion: 3,
            displayState,
            completionEvidence: null,
          },
        }),
      ).toBe('Chưa làm')
    },
  )
  it('keeps a skipped occurrence neutral with its defer label', () => {
    expect(
      planResourceStatus({
        ...action,
        today: {
          occurrenceId: 'occurrence-1',
          occurrenceVersion: 3,
          displayState: 'SKIPPED',
          completionEvidence: null,
        },
      }),
    ).toBe('Để hôm khác')
  })
  it('shows only a Care completed occurrence as recorded and preserves its return context', () => {
    const completed: PlanResourceAction = {
      ...action,
      today: {
        occurrenceId: 'occurrence-1',
        occurrenceVersion: 4,
        displayState: 'COMPLETED',
        completionEvidence: null,
      },
    }
    expect(planResourceStatus(completed)).toBe('Đã ghi nhận')
    expect(planResourceSchedule(completed)).toBe('Hôm nay')
    expect(planResourceHref(completed, '2026-10-21')).toContain(
      'occurrenceId=occurrence-1',
    )
  })
  it.each([
    ['2026-10-21', '2026-10-19'],
    ['2026-10-25', '2026-10-19'],
    ['2026-10-26', '2026-10-26'],
  ])('uses the local week for %s', (date, monday) => {
    expect(localWeekStart(date)).toBe(monday)
  })
})
