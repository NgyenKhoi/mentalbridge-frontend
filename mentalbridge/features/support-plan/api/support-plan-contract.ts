import type { components as care } from '@/contracts/care.generated'
import type { components as evaluation } from '@/contracts/care-support-evaluation-v2.generated'

export type SupportPlanDraft = care['schemas']['SupportPlanDraft']
export type ProposeSupportPlanDraftRequest =
  care['schemas']['ProposeSupportPlanDraftRequest']
export type SupportEvaluationV2 = evaluation['schemas']['SupportEvaluationV2']
export type SupportEvaluationV2Request =
  evaluation['schemas']['SupportEvaluationV2Request']
