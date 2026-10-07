import type { AxiosInstance } from 'axios'

import {
  assessmentHistorySchema,
  assessmentSchema,
  consentDecisionSchema,
  consentCollectionSchema,
  privacyDisclosureSchema,
  questionnaireSchema,
  safetyDirectoryResponseSchema,
  screeningEpisodeEvaluationOutcomeSchema,
  screeningEpisodeSchema,
  supportEvaluationSchema,
  supportGuideHistorySchema,
  supportGuideSchema,
  type Assessment,
  type AssessmentHistory,
  type AssessmentSubmission,
  type ConsentCollection,
  type Instrument,
  type PrivacyDisclosure,
  type Questionnaire,
  type SafetyDirectoryResponse,
  type ScreeningEpisode,
  type SupportEvaluation,
  type SupportGuide,
  type SupportGuideHistory,
} from './assessment-contract'

export interface AssessmentApi {
  getCurrentEpisode(): Promise<ScreeningEpisode>
  startEpisode(): Promise<ScreeningEpisode>
  getQuestionnaire(instrument: Instrument): Promise<Questionnaire>
  getQuestionnaireDefinition(definitionId: string): Promise<Questionnaire>
  getPrivacyDisclosure(): Promise<PrivacyDisclosure>
  getConsents(): Promise<ConsentCollection>
  grantPrivacyConsent(version: string, idempotencyKey: string): Promise<void>
  submitEpisodeAssessment(
    episodeId: string,
    instrument: Instrument,
    submission: AssessmentSubmission,
    idempotencyKey: string,
  ): Promise<Assessment>
  completeEpisode(episodeId: string): Promise<{
    episode: ScreeningEpisode
    presentationEvaluation: SupportEvaluation
  }>
  getAssessment(assessmentId: string): Promise<Assessment>
  listAssessments(): Promise<AssessmentHistory>
  getSupportEvaluation(supportEvaluationId: string): Promise<SupportEvaluation>
  generateSupportGuide(
    phq9AssessmentId: string,
    gad7AssessmentId: string,
    idempotencyKey: string,
  ): Promise<SupportGuide>
  getSupportGuide(supportGuideId: string): Promise<SupportGuide>
  listSupportGuides(): Promise<SupportGuideHistory>
  lookupSafetyDirectory(
    trigger: 'POSITIVE_ITEM_9' | 'HELP_NOW',
    manualLocation: string,
  ): Promise<SafetyDirectoryResponse>
}

export function createAssessmentApi(client: AxiosInstance): AssessmentApi {
  return {
    async getCurrentEpisode() {
      const response = await client.get('/api/v1/screening-episodes/current', {
        params: { purpose: 'INITIAL_CHECK' },
      })
      return screeningEpisodeSchema.parse(response.data)
    },
    async startEpisode() {
      const response = await client.post('/api/v1/screening-episodes', {
        purpose: 'INITIAL_CHECK',
      })
      return screeningEpisodeSchema.parse(response.data)
    },
    async getQuestionnaire(instrument) {
      const response = await client.get(
        `/api/v1/questionnaires/${instrument}/current`,
        { params: { locale: 'vi-VN' } },
      )
      return questionnaireSchema.parse(response.data)
    },
    async getQuestionnaireDefinition(definitionId) {
      const response = await client.get(
        `/api/v1/questionnaires/definitions/${encodeURIComponent(definitionId)}`,
      )
      return questionnaireSchema.parse(response.data)
    },
    async getPrivacyDisclosure() {
      const response = await client.get('/api/v1/privacy-disclosures/current', {
        params: { locale: 'vi-VN' },
      })
      return privacyDisclosureSchema.parse(response.data)
    },
    async getConsents() {
      const response = await client.get('/api/v1/consents')
      return consentCollectionSchema.parse(response.data)
    },
    async grantPrivacyConsent(version, idempotencyKey) {
      const response = await client.post(
        '/api/v1/consent-decisions',
        {
          consentType: 'PRIVACY_POLICY',
          policyVersion: version,
          granted: true,
        },
        { headers: { 'Idempotency-Key': idempotencyKey } },
      )
      consentDecisionSchema.parse(response.data)
    },
    async submitEpisodeAssessment(
      episodeId,
      instrument,
      submission,
      idempotencyKey,
    ) {
      const response = await client.post(
        `/api/v1/screening-episodes/${encodeURIComponent(episodeId)}/assessments/${instrument}`,
        submission,
        { headers: { 'Idempotency-Key': idempotencyKey } },
      )
      return assessmentSchema.parse(response.data)
    },
    async completeEpisode(episodeId) {
      const response = await client.post(
        `/api/v1/screening-episodes/${encodeURIComponent(episodeId)}/support-evaluation`,
      )
      return screeningEpisodeEvaluationOutcomeSchema.parse(response.data)
    },
    async getAssessment(assessmentId) {
      const response = await client.get(
        `/api/v1/assessments/${encodeURIComponent(assessmentId)}`,
      )
      return assessmentSchema.parse(response.data)
    },
    async listAssessments() {
      const response = await client.get('/api/v1/assessments', {
        params: { limit: 10 },
      })
      return assessmentHistorySchema.parse(response.data)
    },
    async getSupportEvaluation(supportEvaluationId) {
      const response = await client.get(
        `/api/v1/support-evaluations/${encodeURIComponent(supportEvaluationId)}`,
      )
      return supportEvaluationSchema.parse(response.data)
    },
    async generateSupportGuide(
      phq9AssessmentId,
      gad7AssessmentId,
      idempotencyKey,
    ) {
      const response = await client.post(
        '/api/v1/support-guides',
        { phq9AssessmentId, gad7AssessmentId },
        { headers: { 'Idempotency-Key': idempotencyKey } },
      )
      return supportGuideSchema.parse(response.data)
    },
    async getSupportGuide(supportGuideId) {
      const response = await client.get(
        `/api/v1/support-guides/${encodeURIComponent(supportGuideId)}`,
      )
      return supportGuideSchema.parse(response.data)
    },
    async listSupportGuides() {
      const response = await client.get('/api/v1/support-guides', {
        params: { limit: 10 },
      })
      return supportGuideHistorySchema.parse(response.data)
    },
    async lookupSafetyDirectory(trigger, manualLocation) {
      const response = await client.post('/api/v1/safety-directory-lookups', {
        trigger,
        manualLocation,
      })
      return safetyDirectoryResponseSchema.parse(response.data)
    },
  }
}
