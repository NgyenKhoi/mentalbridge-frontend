import type { components as care } from '@/contracts/care.generated'
import type { components as evaluation } from '@/contracts/care-support-evaluation-v2.generated'

export type SupportPlanDraft = care['schemas']['SupportPlanDraft']
export type SupportPlan = care['schemas']['SupportPlan']
export type SupportPlanHistoryPage = care['schemas']['SupportPlanHistoryPage']
export type ProposeSupportPlanDraftRequest =
  care['schemas']['ProposeSupportPlanDraftRequest']
export type ReplaceSupportPlanChoicesRequest =
  care['schemas']['ReplaceSupportPlanChoicesRequest']
export type SupportPlanSlotSelection =
  care['schemas']['SupportPlanSlotSelection']
export type SupportPlanOccurrence = care['schemas']['SupportPlanOccurrence']
export type SupportPlanOccurrenceList =
  care['schemas']['SupportPlanOccurrenceList']
export type ChangeSupportPlanOccurrenceStateRequest =
  care['schemas']['ChangeSupportPlanOccurrenceStateRequest']
export type ReplaceSupportPlanOccurrenceEngagementRequest =
  care['schemas']['ReplaceSupportPlanOccurrenceEngagementRequest']
export type ChangeSupportPlanStatusRequest =
  care['schemas']['ChangeSupportPlanStatusRequest']
export type ReplaceCurrentSupportPlanRequest =
  care['schemas']['ReplaceCurrentSupportPlanRequest']
export type SupportPlanReplacementReview =
  care['schemas']['SupportPlanReplacementReview']
export type SupportPlanReplacementComparisonItem =
  care['schemas']['SupportPlanReplacementComparisonItem']
export type SupportEvaluationV2 = evaluation['schemas']['SupportEvaluationV2']
export type SupportEvaluationV2Request =
  evaluation['schemas']['SupportEvaluationV2Request']
