import type { AxiosInstance } from 'axios'

import {
  anonymousAssessmentSchema,
  anonymousSessionSchema,
  privacyDisclosureSchema,
  questionnaireSchema,
  type AnonymousAssessment,
  type AnonymousSession,
  type AssessmentSubmission,
  type Instrument,
  type PrivacyDisclosure,
  type Questionnaire,
} from './assessment-contract'

export interface AnonymousAssessmentApi {
  createSession(): Promise<AnonymousSession>
  getQuestionnaire(instrument: Instrument): Promise<Questionnaire>
  getPrivacyDisclosure(): Promise<PrivacyDisclosure>
  submitAssessment(
    session: Pick<AnonymousSession, 'sessionId' | 'sessionToken'>,
    submission: AssessmentSubmission,
    idempotencyKey: string,
  ): Promise<AnonymousAssessment>
  getAssessment(
    session: Pick<AnonymousSession, 'sessionId' | 'sessionToken'>,
    assessmentId: string,
  ): Promise<AnonymousAssessment>
}

const anonymousHeaders = (sessionToken: string) => ({
  'X-Anonymous-Session-Token': sessionToken,
})

export function createAnonymousAssessmentApi(
  client: AxiosInstance,
): AnonymousAssessmentApi {
  return {
    async createSession() {
      const response = await client.post(
        '/api/v1/anonymous-assessment-sessions',
      )
      return anonymousSessionSchema.parse(response.data)
    },
    async getQuestionnaire(instrument) {
      const response = await client.get(
        `/api/v1/questionnaires/${instrument}/current`,
        { params: { locale: 'vi-VN' } },
      )
      return questionnaireSchema.parse(response.data)
    },
    async getPrivacyDisclosure() {
      const response = await client.get('/api/v1/privacy-disclosures/current', {
        params: { locale: 'vi-VN' },
      })
      return privacyDisclosureSchema.parse(response.data)
    },
    async submitAssessment(session, submission, idempotencyKey) {
      const response = await client.post(
        `/api/v1/anonymous-assessment-sessions/${encodeURIComponent(session.sessionId)}/assessments`,
        submission,
        {
          headers: {
            ...anonymousHeaders(session.sessionToken),
            'Idempotency-Key': idempotencyKey,
          },
        },
      )
      return anonymousAssessmentSchema.parse(response.data)
    },
    async getAssessment(session, assessmentId) {
      const response = await client.get(
        `/api/v1/anonymous-assessment-sessions/${encodeURIComponent(session.sessionId)}/assessments/${encodeURIComponent(assessmentId)}`,
        { headers: anonymousHeaders(session.sessionToken) },
      )
      return anonymousAssessmentSchema.parse(response.data)
    },
  }
}
