import type { components, operations, paths } from '@/contracts/care.generated'

type Schemas = components['schemas']

export type CarePaths = paths
export type CareOperations = operations
export type Instrument = Schemas['Instrument']
export type Questionnaire = Schemas['Questionnaire']
export type QuestionnaireScoreBand = Schemas['QuestionnaireScoreBand']
export type QuestionnaireQuestion = Schemas['Question']
export type ResponseOption = Schemas['ResponseOption']
export type AssessmentSubmissionRequest = Schemas['AssessmentSubmissionRequest']
export type AssessmentAnswer = Schemas['AssessmentAnswer']
export type Assessment = Schemas['Assessment']
export type AnonymousAssessment = Schemas['AnonymousAssessment']
export type AssessmentResult = Schemas['AssessmentResult']
export type ScreeningLevel = Schemas['ScreeningLevel']
export type SafetyStatus = Schemas['SafetyStatus']
export type AnonymousSession = Schemas['AnonymousSession']
export type CareProblem = Schemas['Problem']
export type CareProfile = Schemas['Profile']
export type CareProfileUpdate = Schemas['ProfilePutRequest']
export type ConsentDecision = Schemas['ConsentDecision']
export type ConsentDecisionRequest = Schemas['ConsentDecisionRequest']
export type ConsentCollection = Schemas['ConsentCollection']
export type PrivacyDisclosure = Schemas['PrivacyDisclosure']
export type AiProcessingDisclosure = Schemas['AiProcessingDisclosure']
export type AssessmentSummary = Schemas['AssessmentSummary']
export type AssessmentHistoryPage = Schemas['AssessmentHistoryPage']
export type AssessmentProgress = Schemas['AssessmentProgress']
export type AssessmentProgressPoint = Schemas['AssessmentProgressPoint']
export type ScoreDirection = Schemas['ScoreDirection']
export type ScreeningEpisodePurpose = Schemas['ScreeningEpisodePurpose']
export type ScreeningEpisodeStatus = Schemas['ScreeningEpisodeStatus']
export type ScreeningEpisode = Schemas['ScreeningEpisode']
export type ScreeningEpisodeEvaluationOutcome =
  Schemas['ScreeningEpisodeEvaluationOutcome']
export type ReassessmentCurrentExperience =
  Schemas['ReassessmentCurrentExperience']
export type ReassessmentSelfReportCreateRequest =
  Schemas['ReassessmentSelfReportCreateRequest']
export type ReassessmentSelfReportReplaceRequest =
  Schemas['ReassessmentSelfReportReplaceRequest']
export type ReassessmentSelfReport = Schemas['ReassessmentSelfReport']
export type ReassessmentContext = Schemas['ReassessmentContext']
export type ReassessmentSummary = Schemas['ReassessmentSummary']
export type ReassessmentSummaryCreateRequest =
  Schemas['ReassessmentSummaryCreateRequest']
export type ReassessmentSummaryHistoryPage =
  Schemas['ReassessmentSummaryHistoryPage']
export type SupportEvaluationRequest = Schemas['SupportEvaluationRequest']
export type SupportEvaluation = Schemas['SupportEvaluation']
export type SupportEvaluationHistoryPage =
  Schemas['SupportEvaluationHistoryPage']
export type SupportEvidence = Schemas['SupportEvidence']
export type ScreeningMeaning = Schemas['ScreeningMeaning']
export type SupportNextStep = Schemas['SupportNextStep']
export type SupportTier = Schemas['SupportTier']
export type SupportReasonCode = Schemas['SupportReasonCode']

export type SafetyDirectoryTrigger = Schemas['SafetyDirectoryTrigger']
export type SafetyDirectoryState = Schemas['CareSafetyDirectoryState']
export type SafetyDirectoryEntry = Schemas['CareSafetyDirectoryEntry']
export type SafetyDirectoryResponse =
  Schemas['CareSafetyDirectoryLookupResponse']
