'use client'

import { Disclosure } from '@/components/ui/Disclosure'
import type { PlanAction, SupportPlanV3 } from '../api/support-plan-contract'
import ProfessionalSupportPath from '../components/ProfessionalSupportPath'
import SupportPlanContextualCompanion from '../components/SupportPlanContextualCompanion'
import type { CompanionController } from './use-companion'

const EXPLAINABLE = [
  'RESOURCE',
  'JOURNAL',
  'EMOTION_CHECK_IN',
  'PROFESSIONAL_SUPPORT',
] as const

const weekdays = [
  '',
  'Thứ hai',
  'Thứ ba',
  'Thứ tư',
  'Thứ năm',
  'Thứ sáu',
  'Thứ bảy',
  'Chủ nhật',
]

/** Cadence in plain words; no policy or schedule mechanics. */
export function cadenceLine(action: PlanAction) {
  const schedule = action.schedules.find((item) => item.status !== 'ENDED')
  if (action.actionType === 'PROFESSIONAL_SUPPORT')
    return 'Khi bạn sẵn sàng · bạn tự chọn chuyên gia'
  if (action.actionType === 'REASSESSMENT_SCREENING')
    return 'Một lần khi đến lúc xem lại'
  if (!schedule) return 'Làm khi phù hợp'
  const rhythm =
    schedule.recurrenceType === 'DAILY'
      ? 'Mỗi ngày'
      : schedule.recurrenceType === 'WEEKLY'
        ? schedule.daysOfWeek.map((day) => weekdays[day]).join(', ') ||
          'Mỗi tuần'
        : 'Một lần'
  // An unknown duration is left out rather than guessed.
  return schedule.estimatedDurationMinutes
    ? `${rhythm} · khoảng ${schedule.estimatedDurationMinutes} phút`
    : rhythm
}

function ordered(plan: SupportPlanV3) {
  const isProfessional = (focus: SupportPlanV3['focuses'][number]) =>
    focus.actions.some(
      (action) =>
        action.actionType === 'PROFESSIONAL_SUPPORT' &&
        action.pathRole === 'PRIMARY' &&
        action.status !== 'ENDED',
    )
  return [...plan.focuses].sort(
    (left, right) =>
      Number(isProfessional(right)) - Number(isProfessional(left)) ||
      left.ordinal - right.ordinal,
  )
}

export default function PlanPanel({
  plan,
  companion,
}: Readonly<{ plan: SupportPlanV3; companion: CompanionController }>) {
  const professionalRequired = plan.focuses.some((focus) =>
    focus.actions.some(
      (action) =>
        action.actionType === 'PROFESSIONAL_SUPPORT' &&
        action.pathRole === 'PRIMARY' &&
        action.status !== 'ENDED',
    ),
  )
  return (
    <div className="mbw-plan">
      {professionalRequired && (
        <ProfessionalSupportPath
          supportPlanId={plan.supportPlanId}
          professionalSupportRequired
        />
      )}
      {ordered(plan).map((focus) => (
        <section
          key={focus.focusId}
          className="mbw-focus"
          aria-labelledby={`focus-${focus.focusId}`}
        >
          <h2 id={`focus-${focus.focusId}`}>{focus.title}</h2>
          {focus.rationale && <p className="mbw-why">{focus.rationale}</p>}
          <ul className="mbw-action-list">
            {[...focus.actions]
              .filter(
                (action) =>
                  action.status !== 'ENDED' &&
                  // The professional card above already carries this action.
                  !(
                    professionalRequired &&
                    action.actionType === 'PROFESSIONAL_SUPPORT'
                  ),
              )
              .sort((left, right) => left.ordinal - right.ordinal)
              .map((action) => (
                <li
                  key={action.actionId}
                  id={`support-plan-action-${action.actionId}`}
                  data-support-plan-action-id={action.actionId}
                  tabIndex={-1}
                >
                  <p className="mbw-row-title">{action.presentation.title}</p>
                  <p className="mbw-quiet">{cadenceLine(action)}</p>
                  {(action.rationale || action.presentation.summary) && (
                    <Disclosure
                      summary="Vì sao có hoạt động này"
                      summaryLabel={`Vì sao có hoạt động này: “${action.presentation.title}”`}
                    >
                      <p>{action.rationale ?? action.presentation.summary}</p>
                      {(EXPLAINABLE as readonly string[]).includes(
                        action.actionType,
                      ) && (
                        <SupportPlanContextualCompanion
                          supportPlanId={plan.supportPlanId}
                          actionId={action.actionId}
                          actionTitle={action.presentation.title}
                          surface="PLAN"
                          disabled={companion.interrupted}
                          interruptionActive={companion.interrupted}
                          requestPending={companion.pending}
                          snapshot={companion.snapshot}
                          onRequest={(request) =>
                            void companion.request(request)
                          }
                          onDismiss={companion.dismiss}
                        />
                      )}
                    </Disclosure>
                  )}
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
