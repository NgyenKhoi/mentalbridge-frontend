import type { components, operations, paths } from '@/contracts/care.generated'

type Schemas = components['schemas']

export type CarePaths = paths
export type CareOperations = operations
export type Instrument = Schemas['Instrument']
export type Questionnaire = Schemas['Questionnaire']
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
