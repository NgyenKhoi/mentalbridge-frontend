import type { components as care } from '@/contracts/care.generated'
import type { operations as careOperations } from '@/contracts/care.generated'
import type { components as evaluation } from '@/contracts/care-support-evaluation-v2.generated'

export type SupportPlanDraft = care['schemas']['SupportPlanDraft']
export type SupportPlan = care['schemas']['SupportPlan']
export type SupportPlanV3 = care['schemas']['SupportPlanV3']
export type ActionOccurrence = care['schemas']['ActionOccurrence']
export type ActionOccurrenceList = care['schemas']['ActionOccurrenceList']
export type CompletionEvidence = care['schemas']['CompletionEvidence']
export type EmotionCheckInOccurrenceReconciliation =
  care['schemas']['EmotionCheckInOccurrenceReconciliation']
export type JournalOccurrenceReconciliation =
  care['schemas']['JournalOccurrenceReconciliation']
export type ReconcileJournalOccurrenceRequest =
  careOperations['reconcileOwnJournalOccurrence']['requestBody']['content']['application/json']
export type NativeSupportPlanReplacementReview =
  care['schemas']['NativeSupportPlanReplacementReview']
export type ProposeNativeSupportPlanRequest =
  careOperations['proposeNativeSupportPlan']['requestBody']['content']['application/json']
export type SupportPlanActionHistory =
  careOperations['listOwnSupportPlanActionHistory']['responses'][200]['content']['application/json']
export type SupportPlanPersonalization =
  care['schemas']['SupportPlanPersonalization']
export type ReplaceSupportPlanPersonalizationRequest =
  care['schemas']['ReplaceSupportPlanPersonalizationRequest']
export type PlanAction = care['schemas']['PlanAction']
export type ActionSchedule = care['schemas']['ActionSchedule']
export type ActionScheduleInput = care['schemas']['ActionScheduleInput']
export type UpdateActionScheduleRequest =
  care['schemas']['UpdateActionScheduleRequest']
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
export type PlanChangeRequest = care['schemas']['PlanChangeRequest']
export type CreatePlanChangeRequest = care['schemas']['CreatePlanChangeRequest']
export type PlanChangeDecision = care['schemas']['PlanChangeDecision']
export type SupportEvaluationV2 = evaluation['schemas']['SupportEvaluationV2']
export type SupportEvaluationV2Request =
  evaluation['schemas']['SupportEvaluationV2Request']
