import type { AssessmentApi } from './assessment-api'
import type {
  GuidedJourney,
  ScreeningEpisode,
  SupportGuide,
} from './assessment-contract'
import type { createCombinedMeaningApi } from './combined-meaning-api'
import type { CombinedScreeningMeaning } from './combined-meaning-contract'
import { ApiError } from '@/api/api-error'

type MeaningApi = ReturnType<typeof createCombinedMeaningApi>

export type NativeGuidedJourney = {
  journey: GuidedJourney
  episode: ScreeningEpisode | null
  meaning: CombinedScreeningMeaning | null
  guide: SupportGuide | null
}

export class NativeGuideReadError extends Error {
  constructor(
    readonly partial: NativeGuidedJourney,
    readonly kind: 'missing' | 'unavailable' | 'failure',
  ) {
    super('Guide read failed')
  }
}

const sameId = (
  left: string | null | undefined,
  right: string | null | undefined,
) => !!left && !!right && left.toLowerCase() === right.toLowerCase()

/** Composes Care reads without persisting or selecting journey state locally. */
export function createNativeGuidedJourneyApi(
  api: AssessmentApi,
  meaningApi: MeaningApi,
  isSessionCurrent: () => boolean,
) {
  // The caller must bind this guard to the authenticated session lifecycle.
  function assertSession() {
    if (!isSessionCurrent()) throw new Error('Authenticated session changed.')
  }

  async function sessionRead<T>(operation: () => Promise<T>): Promise<T> {
    assertSession()
    const result = await operation()
    assertSession()
    return result
  }

  async function read(): Promise<NativeGuidedJourney> {
    const journey = await sessionRead(() => api.getGuidedJourney())
    if (journey.assessmentInProgress) {
      const episode = await sessionRead(() => api.getCurrentEpisode())
      if (episode.purpose !== 'INITIAL_CHECK' || episode.status === 'COMPLETED')
        throw new Error('Current episode does not match the Care journey.')
      return { journey, episode, meaning: null, guide: null }
    }
    if (journey.stage === 'ASSESSMENT_REQUIRED') {
      return { journey, episode: null, meaning: null, guide: null }
    }

    const episode = await sessionRead(() => api.getCurrentEpisode())
    if (
      episode.status !== 'COMPLETED' ||
      episode.purpose !== 'INITIAL_CHECK' ||
      !sameId(episode.episodeId, journey.episodeId) ||
      !sameId(
        episode.presentationEvaluationId,
        journey.presentationEvaluationId,
      ) ||
      !episode.phq9AssessmentId ||
      !episode.gad7AssessmentId ||
      !episode.presentationEvaluationId
    )
      throw new Error('Current episode does not match the Care journey.')

    const meaning = await sessionRead(() =>
      meaningApi.getCombinedScreeningMeaning(episode.presentationEvaluationId!),
    )
    if (
      !sameId(meaning.episodeId, episode.episodeId) ||
      meaning.episodePurpose !== episode.purpose ||
      !sameId(meaning.evidence[0].assessmentId, episode.phq9AssessmentId) ||
      !sameId(meaning.evidence[1].assessmentId, episode.gad7AssessmentId) ||
      !sameId(meaning.domainSupportEvaluationId, episode.supportEvaluationId)
    )
      throw new Error('Combined meaning does not match the current episode.')

    let guide: SupportGuide | null = null
    if (journey.stage === 'GUIDE_READY') {
      if (
        !journey.supportGuideId ||
        !sameId(meaning.supportGuideId, journey.supportGuideId)
      )
        throw new Error('Care journey and meaning refer to different Guides.')
      const guideId = journey.supportGuideId
      try {
        guide = await sessionRead(() => api.getSupportGuide(guideId))
      } catch (error) {
        assertSession()
        if (
          error instanceof ApiError &&
          (error.status === 401 || error.status === 403)
        )
          throw error
        const kind =
          error instanceof ApiError && error.status === 404
            ? 'missing'
            : error instanceof ApiError &&
                (error.status === 503 ||
                  error.code === 'NETWORK_ERROR' ||
                  error.code === 'REQUEST_TIMEOUT' ||
                  error.code === 'CARE_UNAVAILABLE' ||
                  error.code === 'CARE_TIMEOUT')
              ? 'unavailable'
              : 'failure'
        throw new NativeGuideReadError(
          { journey, episode, meaning, guide: null },
          kind,
        )
      }
      if (
        !sameId(guide.supportGuideId, journey.supportGuideId) ||
        !sameId(guide.supportEvaluationId, episode.supportEvaluationId) ||
        !guide.provenance.assessmentResults.some(
          (item) =>
            item.instrument === 'PHQ9' &&
            sameId(item.assessmentId, episode.phq9AssessmentId),
        ) ||
        !guide.provenance.assessmentResults.some(
          (item) =>
            item.instrument === 'GAD7' &&
            sameId(item.assessmentId, episode.gad7AssessmentId),
        )
      )
        throw new Error('Guide does not match the current episode.')
    }
    return { journey, episode, meaning, guide }
  }

  async function ensureGuide(): Promise<NativeGuidedJourney> {
    const current = await read()
    if (
      current.journey.assessmentInProgress ||
      current.journey.stage !== 'GUIDE_REQUIRED' ||
      !current.episode
    )
      return current
    await sessionRead(() =>
      api.ensureEpisodeSupportGuide(current.episode!.episodeId),
    )
    return read()
  }

  return { read, ensureGuide }
}
