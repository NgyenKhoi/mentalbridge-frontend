import type {
  ActionOccurrence,
  JournalOccurrenceReconciliation,
  SupportPlanV3,
} from '../api/support-plan-contract'
import {
  nativeSupportPlanFixture,
  emotionOccurrenceFixture,
} from './native-support-plan-fixture'

export const journalActionId = '20000000-0000-4000-8000-000000000642'
export const journalOccurrenceId = '30000000-0000-4000-8000-000000000642'
export const journalEntryId = '70000000-0000-4000-8000-000000000642'
const journalScheduleId = '40000000-0000-4000-8000-000000000642'
export const journalDay = '2026-10-14'
export function journalSupportPlanFixture(): SupportPlanV3 {
  const plan = nativeSupportPlanFixture()
  const emotion = plan.focuses[0].actions[0]
  if (!emotion.source) throw new Error('Expected fixture source')
  return {
    ...plan,
    planPolicyVersion: 'support-plan-journal-actions-v1',
    focuses: [
      {
        ...plan.focuses[0],
        actions: [
          emotion,
          {
            ...emotion,
            actionId: journalActionId,
            actionType: 'JOURNAL',
            ordinal: 2,
            purposeCode: 'WRITE_SHORT_REFLECTION',
            source: {
              ...emotion.source,
              sourceKind: 'JOURNAL_TEMPLATE',
              sourceId: 'short-reflection',
              sourcePolicyVersion: 'journal-writing-intent-v1',
            },
            presentation: {
              ...emotion.presentation,
              title: 'Viết một suy nghĩ ngắn',
              summary: 'Dành vài phút viết điều bạn muốn giữ cho riêng mình.',
              instructions: null,
            },
            schedules: [
              {
                ...emotion.schedules[0],
                scheduleId: journalScheduleId,
                localTime: '19:05',
              },
            ],
          },
        ],
      },
    ],
  }
}
export function journalOccurrenceFixture(): ActionOccurrence {
  return {
    ...emotionOccurrenceFixture(),
    occurrenceId: journalOccurrenceId,
    actionId: journalActionId,
    actionType: 'JOURNAL',
    scheduleId: journalScheduleId,
    localDate: journalDay,
    scheduledAt: '2026-10-14T12:05:00Z',
    displayState: 'SCHEDULED',
  }
}
export function journalCompletionFixture(): NonNullable<
  JournalOccurrenceReconciliation['completionEvidence']
> {
  return {
    kind: 'JOURNAL_ENTRY',
    ownerDomain: 'JOURNAL_AI',
    factId: journalEntryId,
    factRevision: '1',
    occurredAt: '2026-10-14T12:06:00Z',
    verifiedAt: '2026-10-14T12:07:00Z',
  }
}
