'use client'

import { Disclosure } from '@/components/ui/Disclosure'
import { MamCardButton } from '@/features/mam/MamCardButton'
import { useMamTarget } from '@/features/mam/use-mam-target'
import type { PlanAction, SupportPlanV3 } from '../api/support-plan-contract'
import ProfessionalSupportPath from '../components/ProfessionalSupportPath'
import SupportPlanContextualCompanion from '../components/SupportPlanContextualCompanion'
import type { MamActionExplain } from './mam-support-plan'
import type { CompanionController } from './use-companion'
import { actionWeek, weekDates, weeklyMinutes } from './workspace-model'

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

const DAYS = [
  ['T2', 'Thứ hai'],
  ['T3', 'Thứ ba'],
  ['T4', 'Thứ tư'],
  ['T5', 'Thứ năm'],
  ['T6', 'Thứ sáu'],
  ['T7', 'Thứ bảy'],
  ['CN', 'Chủ nhật'],
] as const

/** Actions that carry their own cadence line instead of week cells. */
const NO_GRID = ['PROFESSIONAL_SUPPORT', 'REASSESSMENT_SCREENING']

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
        ? (schedule.daysOfWeek ?? [])
            .map((day) => weekdays[day])
            .filter(Boolean)
            .join(', ') || 'Mỗi tuần'
        : 'Một lần'
  // An unknown duration is left out rather than guessed.
  return schedule.estimatedDurationMinutes
    ? `${rhythm} · khoảng ${schedule.estimatedDurationMinutes} phút`
    : rhythm
}

function minutesLine(total: number) {
  const hours = Math.floor(total / 60)
  const minutes = total % 60
  return hours === 0
    ? `${minutes} phút`
    : `${hours} giờ${minutes ? ` ${minutes} phút` : ''}`
}

function ordered(plan: SupportPlanV3) {
  const isProfessional = (focus: SupportPlanV3['focuses'][number]) =>
    focus.actions.some(
      (action) =>
        action.actionType === 'PROFESSIONAL_SUPPORT' &&
        action.pathRole === 'PRIMARY' &&
        action.status !== 'ENDED',
    )
  return [...(plan.focuses ?? [])].sort(
    (left, right) =>
      Number(isProfessional(right)) - Number(isProfessional(left)) ||
      left.ordinal - right.ordinal,
  )
}

/** One việc: its week cells, then its "why" disclosure and Mầm entry. */
function PlanActionRow({
  plan,
  action,
  week,
  today,
  companion,
  mam,
}: Readonly<{
  plan: SupportPlanV3
  action: PlanAction
  week: ReadonlyArray<string>
  today: string
  companion: CompanionController
  mam?: MamActionExplain
}>) {
  const explainable = (EXPLAINABLE as readonly string[]).includes(
    action.actionType,
  )
  const mamRef = useMamTarget(
    mam && explainable
      ? {
          kind: 'support-plan.action',
          context: {
            supportPlanId: plan.supportPlanId,
            actionId: action.actionId,
          },
        }
      : null,
    mam &&
      (async (intent, { signal }) =>
        intent === 'EXPLAIN'
          ? mam.explain(plan.supportPlanId, action.actionId, 'PLAN', signal)
          : null),
  )
  const gridded = !NO_GRID.includes(action.actionType)
  const cells = gridded ? actionWeek(action, week) : []
  // A rule that lands on no day of this week reads as its cadence line instead.
  const scheduled = cells.some((cell) => cell !== undefined)
  const minutes = action.schedules?.find(
    (item) => item.status !== 'ENDED',
  )?.estimatedDurationMinutes
  const hasWhy = Boolean(action.rationale || action.presentation.summary)
  return (
    <tbody
      ref={mamRef}
      id={`support-plan-action-${action.actionId}`}
      data-support-plan-action-id={action.actionId}
      data-mam={mam && explainable ? '' : undefined}
      tabIndex={-1}
      className="mbw-week-item"
    >
      <tr>
        <th scope="row" className="mbw-week-title">
          <div className="mbw-row-title">{action.presentation.title}</div>
          {gridded && minutes && (
            <div className="mbw-quiet">
              {/* Phones show the time here; their day chips are too narrow for it. */}
              {scheduled && (
                <span className="mbw-week-times" aria-hidden="true">
                  {[...new Set(cells.filter(Boolean))].join(', ')} ·{' '}
                </span>
              )}
              khoảng {minutes} phút
            </div>
          )}
        </th>
        {scheduled ? (
          cells.map((cell, index) => (
            <td
              key={DAYS[index][0]}
              className={[
                'mbw-week-cell',
                cell !== undefined && 'is-on',
                week[index] === today && 'is-today',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <div className="mbw-week-chip">
                <span className="mbw-week-day" aria-hidden="true">
                  {DAYS[index][0]}
                </span>
                {cell === undefined ? (
                  <>
                    <span aria-hidden="true">–</span>
                    <span className="mbw-visually-hidden">Không có lịch</span>
                  </>
                ) : (
                  <span className="mbw-week-time">{cell || 'Có lịch'}</span>
                )}
              </div>
            </td>
          ))
        ) : (
          <td colSpan={7} className="mbw-week-note">
            {cadenceLine(action)}
          </td>
        )}
      </tr>
      {(hasWhy || (mam && explainable)) && (
        <tr className="mbw-week-why">
          <td colSpan={8}>
            {hasWhy && (
              <Disclosure
                summary="Vì sao có việc này"
                summaryLabel={`Vì sao có việc này: “${action.presentation.title}”`}
              >
                <p>{action.rationale ?? action.presentation.summary}</p>
                {!mam && explainable && (
                  <SupportPlanContextualCompanion
                    supportPlanId={plan.supportPlanId}
                    actionId={action.actionId}
                    actionTitle={action.presentation.title}
                    surface="PLAN"
                    disabled={companion.interrupted}
                    interruptionActive={companion.interrupted}
                    requestPending={companion.pending}
                    snapshot={companion.snapshot}
                    onRequest={(request) => void companion.request(request)}
                    onDismiss={companion.dismiss}
                  />
                )}
              </Disclosure>
            )}
            {mam && explainable && (
              <MamCardButton
                label={`Mầm giải thích: ${action.presentation.title}`}
                disabled={
                  mam.pendingActionId !== undefined &&
                  mam.pendingActionId !== action.actionId
                }
              />
            )}
          </td>
        </tr>
      )}
    </tbody>
  )
}

export default function PlanPanel({
  plan,
  today,
  companion,
  mam,
  onAdjust,
}: Readonly<{
  plan: SupportPlanV3
  today: string
  companion: CompanionController
  mam?: MamActionExplain
  onAdjust: () => void
}>) {
  const professionalRequired = (plan.focuses ?? []).some((focus) =>
    focus.actions.some(
      (action) =>
        action.actionType === 'PROFESSIONAL_SUPPORT' &&
        action.pathRole === 'PRIMARY' &&
        action.status !== 'ENDED',
    ),
  )
  const week = weekDates(today)
  const groups = ordered(plan).map((focus) => ({
    focus,
    actions: [...focus.actions]
      .filter(
        (action) =>
          action.status !== 'ENDED' &&
          // The professional card above already carries this action.
          !(
            professionalRequired && action.actionType === 'PROFESSIONAL_SUPPORT'
          ),
      )
      .sort((left, right) => left.ordinal - right.ordinal),
  }))
  const listed = groups.flatMap(({ actions }) => actions)
  const minutes = weeklyMinutes(
    listed.filter((action) => !NO_GRID.includes(action.actionType)),
  )
  return (
    <div className="mbw-plan">
      {professionalRequired && (
        <ProfessionalSupportPath
          supportPlanId={plan.supportPlanId}
          professionalSupportRequired
        />
      )}
      {listed.length > 0 && (
        <header className="mbw-plan-head">
          <h2>{listed.length} việc trong kế hoạch</h2>
          {minutes && (
            <p className="mbw-quiet">Mỗi tuần khoảng {minutesLine(minutes)}.</p>
          )}
        </header>
      )}
      {groups.map(({ focus, actions }) => (
        <section
          key={focus.focusId}
          className="mbw-focus"
          aria-labelledby={`focus-${focus.focusId}`}
        >
          <h2 id={`focus-${focus.focusId}`}>{focus.title}</h2>
          {focus.rationale && <p className="mbw-why">{focus.rationale}</p>}
          {actions.length > 0 && (
            <table className="mbw-week">
              <caption className="mbw-visually-hidden">
                Lịch trong tuần: {focus.title}
              </caption>
              <thead>
                <tr>
                  <th scope="col">Việc</th>
                  {DAYS.map(([short, long], index) => (
                    <th
                      key={short}
                      scope="col"
                      className={week[index] === today ? 'is-today' : undefined}
                      aria-current={week[index] === today ? 'date' : undefined}
                    >
                      <span aria-hidden="true">{short}</span>
                      <span className="mbw-visually-hidden">{long}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              {actions.map((action) => (
                <PlanActionRow
                  key={action.actionId}
                  plan={plan}
                  action={action}
                  week={week}
                  today={today}
                  companion={companion}
                  mam={mam}
                />
              ))}
            </table>
          )}
        </section>
      ))}
      {listed.length > 0 && (
        <div>
          <button type="button" className="mbw-text-button" onClick={onAdjust}>
            Đổi giờ hoặc bớt việc trong Điều chỉnh
          </button>
        </div>
      )}
    </div>
  )
}
