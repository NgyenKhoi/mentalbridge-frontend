import type {
  SupportEvaluationV2,
  SupportPlanDraft,
} from '@/features/support-plan/api/support-plan-contract'
import { isUuid } from './care-validation'

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function text(value: unknown, max = 4096): value is string {
  return (
    typeof value === 'string' && value.trim().length > 0 && value.length <= max
  )
}

function instant(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
}

function resource(value: unknown) {
  if (!object(value)) return false
  return (
    typeof value.resourceId === 'string' &&
    isUuid(value.resourceId) &&
    typeof value.contentVersion === 'string' &&
    /^\d+$/.test(value.contentVersion) &&
    typeof value.publicationId === 'string' &&
    isUuid(value.publicationId) &&
    ['PRIMARY', 'ADJUNCT'].includes(String(value.role)) &&
    text(value.category, 32) &&
    text(value.title, 255) &&
    text(value.summary) &&
    (value.externalUrl === null ||
      value.externalUrl === undefined ||
      (typeof value.externalUrl === 'string' &&
        /^https?:\/\//.test(value.externalUrl)))
  )
}

export function parseSupportPlanDraft(value: unknown): SupportPlanDraft | null {
  if (!object(value) || !isUuid(String(value.supportPlanId))) return null
  if (value.status !== 'DRAFT' || !Number.isInteger(value.version)) return null
  if (!object(value.source) || !object(value.entitlement)) return null
  if (!object(value.rationale) || !object(value.safety)) return null
  if (
    !isUuid(String(value.source.supportEvaluationId)) ||
    value.source.evaluationVersion !== 2 ||
    value.source.evaluationPolicyVersion !== 'mb-support-routing-capstone-v2' ||
    value.source.selectionPolicyVersion !== 'mb-support-plan-selection-v1' ||
    value.source.resourceEligibilityPolicyVersion !==
      'content-eligibility-v1' ||
    !instant(value.source.evaluatedAt) ||
    !instant(value.source.resourcesResolvedAt)
  )
    return null
  if (
    !['PLUS', 'PREMIUM'].includes(String(value.entitlement.packageCode)) ||
    !['DEMO', 'PAID'].includes(String(value.entitlement.source)) ||
    value.entitlement.policyVersion !== 'service-entitlement-v1' ||
    !Number.isInteger(value.entitlement.version) ||
    !instant(value.entitlement.decidedAt)
  )
    return null
  if (!text(value.rationale.text, 2048) || !text(value.safety.guidance, 2048))
    return null
  if (
    !Array.isArray(value.templateFamilies) ||
    value.templateFamilies.length < 1 ||
    value.templateFamilies.length > 2
  )
    return null
  if (
    !Array.isArray(value.slots) ||
    value.slots.length < 1 ||
    value.slots.length > 5
  )
    return null
  if (
    !value.slots.every(
      (slot) =>
        object(slot) &&
        text(slot.slotId, 64) &&
        ['CORE', 'OPTIONAL'].includes(String(slot.kind)) &&
        resource(slot.selectedResource) &&
        Array.isArray(slot.allowedAlternatives) &&
        slot.allowedAlternatives.every(resource),
    )
  )
    return null
  if (
    value.selectedResourceCount !== value.slots.length ||
    value.disclaimerCode !== 'WELLBEING_SUPPORT_NOT_TREATMENT' ||
    !text(value.disclaimer, 1000) ||
    !instant(value.createdAt) ||
    !instant(value.updatedAt)
  )
    return null
  return value as SupportPlanDraft
}

export function parseSupportEvaluationV2(
  value: unknown,
): SupportEvaluationV2 | null {
  if (!object(value)) return null
  const contributions = Array.isArray(value.contributingDomains)
    ? value.contributingDomains
    : []
  const validContribution = (contribution: unknown) => {
    if (!object(contribution)) return false
    const instrumentDomain = `${String(contribution.instrument)}:${String(contribution.domain)}`
    return (
      isUuid(String(contribution.assessmentId)) &&
      isUuid(String(contribution.questionnaireDefinitionId)) &&
      ['PHQ9:DEPRESSIVE_SYMPTOMS', 'GAD7:ANXIETY_SYMPTOMS'].includes(
        instrumentDomain,
      ) &&
      text(contribution.questionnaireVersion, 64) &&
      text(contribution.scoringVersion, 64) &&
      ['MINIMAL', 'MILD', 'MODERATE', 'MODERATELY_SEVERE', 'SEVERE'].includes(
        String(contribution.screeningLevel),
      ) &&
      ['SELF_GUIDED_SUPPORT', 'PROFESSIONAL_SUPPORT_RECOMMENDED'].includes(
        String(contribution.supportPathway),
      ) &&
      Array.isArray(contribution.reasonCodes) &&
      contribution.reasonCodes.length >= 1 &&
      contribution.reasonCodes.every(
        (reason) =>
          typeof reason === 'string' &&
          /^(PHQ9|GAD7)_LEVEL_(MINIMAL|MILD|MODERATE|MODERATELY_SEVERE|SEVERE)$/.test(
            reason,
          ),
      )
    )
  }
  const safety = object(value.safetyEvidence) ? value.safetyEvidence : null
  if (
    !isUuid(String(value.supportEvaluationId)) ||
    value.evaluationVersion !== 2 ||
    value.policyVersion !== 'mb-support-routing-capstone-v2' ||
    !instant(value.evaluatedAt) ||
    contributions.length !== 2 ||
    !contributions.every(validContribution) ||
    new Set(
      contributions.map(
        (contribution) =>
          `${String((contribution as Record<string, unknown>).instrument)}:${String((contribution as Record<string, unknown>).domain)}`,
      ),
    ).size !== 2 ||
    !safety ||
    !isUuid(String(safety.sourceAssessmentId)) ||
    safety.instrument !== 'PHQ9' ||
    safety.trigger !== 'PHQ9_ITEM_9' ||
    !['NEGATIVE_SAFETY_SCREEN', 'POSITIVE_SAFETY_SCREEN'].includes(
      String(safety.status),
    ) ||
    !text(safety.policyVersion, 64) ||
    !['PHQ9_ITEM9_NEGATIVE', 'PHQ9_ITEM9_POSITIVE'].includes(
      String(safety.reasonCode),
    ) ||
    value.disclaimerCode !== 'SCREENING_NOT_DIAGNOSIS' ||
    !text(value.disclaimer, 1000)
  )
    return null
  return value as SupportEvaluationV2
}
