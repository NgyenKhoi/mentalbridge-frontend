import type { components } from '@/contracts/care.generated'

type Schemas = components['schemas']

export type ConsultationBriefDraftRequest =
  Schemas['ConsultationBriefDraftRequest']
export type ConsultationBrief = Schemas['ConsultationBrief']
export type ConsultationBriefAiDraftJob = Schemas['ConsultationBriefAiDraftJob']
export type ConsultationBriefScreeningContext =
  Schemas['ConsultationBriefScreeningContext']
export type SpecialistConsultationBrief = Schemas['SpecialistConsultationBrief']
export type SpecialistClientContinuityList =
  Schemas['SpecialistClientContinuityList']
export type SpecialistClientContinuityItem =
  Schemas['SpecialistClientContinuityItem']
export type ConsultationBriefScreeningContextChoice =
  Schemas['ConsultationBriefScreeningContextChoice']
export type ConsultationBriefScreeningContextList =
  Schemas['ConsultationBriefScreeningContextList']
