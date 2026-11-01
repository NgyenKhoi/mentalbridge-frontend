import { z } from 'zod'

import type {
  ActionOccurrence,
  ActionOccurrenceList,
  CanonicalSupportPlan,
} from './support-plan-action-contract'
import type {
  SupportPlan,
  SupportPlanActions,
  SupportPlanOccurrence,
  SupportPlanOccurrenceList,
} from './support-plan-contract'

const homePlanActionTypeSchema = z.enum([
  'RESOURCE',
  'ROUTINE_SELF_MANAGEMENT',
  'SELF_REPORT_REVIEW',
])

const homePlanOriginSchema = z
  .object({
    source: z.literal('home'),
    occurrenceId: z.uuid(),
    actionId: z.string().min(1).max(128),
    actionType: homePlanActionTypeSchema,
    localDate: z.iso.date(),
  })
  .strict()

export type HomePlanOrigin = Readonly<z.infer<typeof homePlanOriginSchema>>
export type HomePlanOriginInput =
  | Readonly<{ state: 'none' }>
  | Readonly<{ state: 'invalid' }>
  | Readonly<{ state: 'valid'; value: HomePlanOrigin }>

export const noHomePlanOrigin: HomePlanOriginInput = { state: 'none' }

export function parseHomePlanOrigin(params: {
  source: unknown
  occurrenceId: unknown
  actionId: unknown
  actionType: unknown
  localDate: unknown
}): HomePlanOriginInput {
  const parsed = homePlanOriginSchema.safeParse(params)
  return parsed.success
    ? { state: 'valid', value: parsed.data }
    : { state: 'invalid' }
}

export function resolveNativeHomePlanOrigin(
  plan: CanonicalSupportPlan | null,
  occurrences: ActionOccurrenceList | undefined,
  origin: HomePlanOrigin,
): ActionOccurrence | null {
  if (
    !plan ||
    !occurrences ||
    plan.representationMode !== 'NATIVE_V3' ||
    !['ACTIVE', 'PAUSED'].includes(plan.status) ||
    occurrences.supportPlanId !== plan.supportPlanId ||
    occurrences.supportPlanStatus !== plan.status ||
    occurrences.representationMode !== plan.representationMode
  )
    return null

  const action = plan.focuses
    .flatMap((focus) => focus.actions)
    .find(
      (candidate) =>
        candidate.actionId === origin.actionId &&
        candidate.actionType === origin.actionType &&
        candidate.representationMode === plan.representationMode &&
        candidate.status === 'ACTIVE',
    )
  if (!action) return null

  return (
    occurrences.occurrences.find(
      (candidate) =>
        candidate.occurrenceId === origin.occurrenceId &&
        candidate.actionId === action.actionId &&
        candidate.actionType === action.actionType &&
        candidate.representationMode === plan.representationMode &&
        candidate.localDate === origin.localDate &&
        candidate.state !== 'CANCELLED',
    ) ?? null
  )
}

export function resolveLegacyHomePlanOrigin(
  plan: SupportPlan | null | undefined,
  actions: SupportPlanActions | undefined,
  occurrences: SupportPlanOccurrenceList | undefined,
  origin: HomePlanOrigin,
): SupportPlanOccurrence | null {
  if (
    !plan ||
    !actions ||
    !occurrences ||
    origin.actionType !== 'RESOURCE' ||
    !['ACTIVE', 'PAUSED'].includes(plan.status) ||
    actions.supportPlanId !== plan.supportPlanId ||
    actions.status !== plan.status ||
    actions.representationMode !== 'V2_RESOURCE_ADAPTER' ||
    occurrences.supportPlanId !== plan.supportPlanId ||
    occurrences.supportPlanStatus !== plan.status
  )
    return null

  const action = actions.focuses
    .flatMap((focus) => focus.actions)
    .find(
      (candidate) =>
        candidate.actionId === origin.actionId &&
        candidate.actionType === origin.actionType &&
        candidate.representationMode === actions.representationMode &&
        candidate.status === 'ACTIVE',
    )
  if (!action) return null

  return (
    occurrences.occurrences.find(
      (candidate) =>
        candidate.occurrenceId === origin.occurrenceId &&
        candidate.localDate === origin.localDate &&
        candidate.source.type === 'RESOURCE' &&
        candidate.source.slotId === action.actionId &&
        candidate.state !== 'CANCELLED',
    ) ?? null
  )
}
