import type {
  Assessment,
  SupportEvaluation,
} from '@/features/assessment/api/care-contract'

export type InitialCheckState =
  | Readonly<{ phase: 'PROFILE_REQUIRED' }>
  | Readonly<{ phase: 'CONSENT_REQUIRED' }>
  | Readonly<{ phase: 'PHQ9' }>
  | Readonly<{ phase: 'GAD7'; phq9: Assessment }>
  | Readonly<{
      phase: 'EVALUATION_PENDING'
      phq9: Assessment
      gad7: Assessment
    }>
  | Readonly<{
      phase: 'COMPLETED'
      phq9: Assessment
      gad7: Assessment
      evaluation: SupportEvaluation
    }>
