import { cleanup, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type {
  ActionOccurrence,
  SupportPlanV3,
} from '../api/support-plan-contract'
import {
  emotionCompletionFixture,
  emotionOccurrenceFixture,
  nativeSupportPlanFixture,
} from '../testing/native-support-plan-fixture'
import TodayPanel, { acceptedJournalHref } from './TodayPanel'
import {
  planActions,
  selectTodayFocus,
  type PlannedOccurrence,
} from './workspace-model'

const journalId = '70000000-0000-4000-8000-000000000642'

function journalItem(overrides: Partial<ActionOccurrence> = {}) {
  return {
    action: planActions(nativeSupportPlanFixture())[0],
    occurrence: {
      ...emotionOccurrenceFixture(),
      actionType: 'JOURNAL',
      state: 'COMPLETED',
      displayState: 'COMPLETED',
      completionEvidence: {
        ...emotionCompletionFixture(),
        kind: 'JOURNAL_ENTRY',
        factId: journalId,
      },
      ...overrides,
    },
  } as PlannedOccurrence
}

describe('accepted Journal entry link', () => {
  it('opens the stored accepted entry read-only', () => {
    const href = acceptedJournalHref(journalItem())
    expect(href).toMatch(/^\/journal\?/)
    expect(new URLSearchParams(href!.split('?')[1]).get('journalId')).toBe(
      journalId,
    )
  })

  it('offers nothing without accepted Journal evidence', () => {
    expect(
      acceptedJournalHref(
        journalItem({
          completionEvidence: {
            ...emotionCompletionFixture(),
            kind: 'JOURNAL_ENTRY',
            ownerDomain: 'CARE',
          } as ActionOccurrence['completionEvidence'],
        }),
      ),
    ).toBeUndefined()
    expect(
      acceptedJournalHref(
        journalItem({ completionEvidence: emotionCompletionFixture() }),
      ),
    ).toBeUndefined()
    expect(
      acceptedJournalHref(
        journalItem({ state: 'SKIPPED', displayState: 'SKIPPED' }),
      ),
    ).toBeUndefined()
  })
})

describe('TodayPanel readiness', () => {
  const companion = {
    interrupted: false,
    pending: false,
    snapshot: undefined,
    request: vi.fn(),
    dismiss: vi.fn(),
    clear: vi.fn(),
  } as never
  const today = '2026-10-13'
  const panel = (overrides: Partial<Parameters<typeof TodayPanel>[0]> = {}) => {
    const plan = nativeSupportPlanFixture()
    const occurrences = [emotionOccurrenceFixture()]
    return (
      <TodayPanel
        plan={plan}
        focus={selectTodayFocus(plan, occurrences, today)}
        occurrences={occurrences}
        today={today}
        timezone="Asia/Ho_Chi_Minh"
        ready
        loadError={false}
        rows={{ busy: {}, messages: {} }}
        busy={false}
        engageable={new Set()}
        companion={companion}
        onRetry={vi.fn()}
        onSkip={vi.fn()}
        onReopen={vi.fn()}
        onAcknowledge={vi.fn()}
        onRate={vi.fn()}
        onBarrier={vi.fn()}
        onResume={vi.fn()}
        onOpenReview={vi.fn()}
        onOpenPlan={vi.fn()}
        {...overrides}
      />
    )
  }

  it('shows loading, not zero progress, before the rows are known', () => {
    render(panel({ ready: false }))
    expect(screen.getByRole('status')).toHaveTextContent(
      'Đang tải việc của hôm nay',
    )
    expect(screen.queryByRole('progressbar')).toBeNull()
  })

  it('shows only the failed region with retry when nothing was ever read', () => {
    render(panel({ ready: false, loadError: true }))
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Chưa tải được việc của hôm nay.',
    )
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeVisible()
    expect(screen.queryByText(/không có việc nào/)).toBeNull()
    expect(screen.queryByRole('progressbar')).toBeNull()
  })

  it('does not throw on an invalid local date', () => {
    render(panel({ today: 'not-a-date' }))
    expect(screen.getByRole('heading', { name: 'Hôm nay' })).toBeVisible()
  })
})

describe('TodayPanel rows and day footer', () => {
  const companion = {
    interrupted: false,
    pending: false,
    snapshot: undefined,
    request: vi.fn(),
    dismiss: vi.fn(),
    clear: vi.fn(),
  } as never
  const today = '2026-10-13'
  type Spec = {
    id: string
    hour: string
    type?: string
    actionStatus?: 'ACTIVE' | 'ENDED'
    state?: string
  }
  function view(
    specs: Spec[],
    overrides: Partial<Parameters<typeof TodayPanel>[0]> = {},
  ) {
    const base = nativeSupportPlanFixture()
    const template = base.focuses[0].actions[0]
    const actions = specs.map(({ id, type, actionStatus }) => ({
      ...template,
      actionId: `action-${id}`,
      actionType: type ?? 'EMOTION_CHECK_IN',
      status: actionStatus ?? 'ACTIVE',
      presentation: { ...template.presentation, title: `Việc ${id}` },
    }))
    const plan = {
      ...base,
      focuses: [{ ...base.focuses[0], actions }],
    } as unknown as SupportPlanV3
    const occurrences = specs.map(
      ({ id, hour, type, state }) =>
        ({
          ...emotionOccurrenceFixture(),
          occurrenceId: `occ-${id}`,
          actionId: `action-${id}`,
          actionType: type ?? 'EMOTION_CHECK_IN',
          scheduledAt: `2026-10-13T${hour}:00:00Z`,
          state: state ?? 'SCHEDULED',
          displayState: state ?? 'SCHEDULED',
        }) as ActionOccurrence,
    )
    const focus = selectTodayFocus(plan, occurrences, today)
    return {
      focus,
      ui: (
        <TodayPanel
          plan={plan}
          focus={focus}
          occurrences={occurrences}
          today={today}
          timezone="Asia/Ho_Chi_Minh"
          ready
          loadError={false}
          rows={{ busy: {}, messages: {} }}
          busy={false}
          engageable={new Set(occurrences.map((item) => item.occurrenceId))}
          companion={companion}
          onRetry={vi.fn()}
          onSkip={vi.fn()}
          onReopen={vi.fn()}
          onAcknowledge={vi.fn()}
          onRate={vi.fn()}
          onBarrier={vi.fn()}
          onResume={vi.fn()}
          onOpenReview={vi.fn()}
          onOpenPlan={vi.fn()}
          {...overrides}
        />
      ),
    }
  }
  const rating = /Có giúp bạn không/

  it('rates a completed Emotion row but never a read-only type', () => {
    render(view([{ id: 'e', hour: '01', state: 'COMPLETED' }]).ui)
    expect(screen.getAllByText(rating).length).toBeGreaterThan(0)
    cleanup()
    for (const type of ['SELF_REPORT_REVIEW', 'NEW_KIND']) {
      render(view([{ id: 'r', hour: '01', type, state: 'COMPLETED' }]).ui)
      expect(screen.getByText('Việc r')).toBeVisible()
      expect(screen.queryByText(rating)).toBeNull()
      cleanup()
    }
  })

  it('expands the first row that has a command when read-only rows come first', () => {
    const { focus, ui } = view([
      { id: 'ended', hour: '01', actionStatus: 'ENDED' },
      { id: 'self', hour: '02', type: 'SELF_REPORT_REVIEW' },
      { id: 'routine', hour: '03', type: 'ROUTINE_SELF_MANAGEMENT' },
    ])
    expect(focus.kind === 'OCCURRENCE' && focus.action.actionId).toBe(
      'action-routine',
    )
    render(ui)
    expect(screen.getByRole('button', { name: 'Đã làm xong' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Để hôm khác' })).toBeVisible()
  })

  it('says the day is done only when every counted row is completed', () => {
    render(view([{ id: 'a', hour: '01', state: 'COMPLETED' }]).ui)
    expect(screen.getByText(/Xong các việc hôm nay/)).toBeVisible()
  })

  it('does not call a day with a skipped row done', () => {
    render(
      view([
        { id: 'a', hour: '01', state: 'COMPLETED' },
        { id: 'b', hour: '02', state: 'SKIPPED' },
      ]).ui,
    )
    expect(screen.queryByText(/Xong các việc hôm nay/)).toBeNull()
    expect(
      screen.getByText(/Hôm nay không còn việc nào đang chờ\./),
    ).toBeVisible()
  })

  it('draws no conclusion while a row is in a state this client cannot read', () => {
    render(
      view([
        { id: 'a', hour: '01', state: 'COMPLETED' },
        { id: 'b', hour: '02', state: 'NEW_STATE' },
      ]).ui,
    )
    expect(screen.queryByText(/Xong các việc hôm nay/)).toBeNull()
    expect(screen.queryByText(/không còn việc nào đang chờ/)).toBeNull()
    cleanup()
    render(view([{ id: 'c', hour: '01', state: 'NEW_STATE' }]).ui)
    expect(screen.getByText('Việc c')).toBeVisible()
    expect(screen.queryByText(/không còn việc nào đang chờ/)).toBeNull()
  })
})
