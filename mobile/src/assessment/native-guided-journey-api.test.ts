import type { AssessmentApi } from './assessment-api'
import type { createCombinedMeaningApi } from './combined-meaning-api'
import {
  createNativeGuidedJourneyApi,
  NativeGuideReadError,
} from './native-guided-journey-api'
import { ApiError } from '@/api/api-error'

const episode = {
  episodeId: 'episode',
  purpose: 'INITIAL_CHECK',
  status: 'COMPLETED',
  phq9AssessmentId: 'phq',
  gad7AssessmentId: 'gad',
  presentationEvaluationId: 'presentation',
  supportEvaluationId: 'domain',
}
const meaning = {
  episodeId: 'episode',
  episodePurpose: 'INITIAL_CHECK',
  domainSupportEvaluationId: 'domain',
  supportGuideId: 'guide',
  evidence: [{ assessmentId: 'phq' }, { assessmentId: 'gad' }],
}
const guide = {
  supportGuideId: 'guide',
  supportEvaluationId: 'domain',
  provenance: {
    assessmentResults: [
      { instrument: 'PHQ9', assessmentId: 'phq' },
      { instrument: 'GAD7', assessmentId: 'gad' },
    ],
  },
}
const pointer = (stage: string) => ({
  stage,
  assessmentInProgress: false,
  episodeId: 'episode',
  presentationEvaluationId: 'presentation',
  supportGuideId: stage === 'GUIDE_READY' ? 'guide' : null,
})

function fixture() {
  const api = {
    getGuidedJourney: jest.fn().mockResolvedValue(pointer('GUIDE_READY')),
    getCurrentEpisode: jest.fn().mockResolvedValue(episode),
    getSupportGuide: jest.fn().mockResolvedValue(guide),
    ensureEpisodeSupportGuide: jest.fn().mockResolvedValue(guide),
  }
  const meaningApi = {
    getCombinedScreeningMeaning: jest.fn().mockResolvedValue(meaning),
  }
  const isSessionCurrent = jest.fn().mockReturnValue(true)
  const adapter = createNativeGuidedJourneyApi(
    api as unknown as AssessmentApi,
    meaningApi as unknown as ReturnType<typeof createCombinedMeaningApi>,
    isSessionCurrent,
  )
  return { api, meaningApi, adapter, isSessionCurrent }
}

it('reads the exact server-confirmed Guide without creating it', async () => {
  const { api, adapter } = fixture()
  await expect(adapter.read()).resolves.toMatchObject({
    episode,
    meaning,
    guide,
  })
  expect(api.getSupportGuide).toHaveBeenCalledWith('guide')
  expect(api.ensureEpisodeSupportGuide).not.toHaveBeenCalled()
})

it('ensures only when Care requires a Guide, then rereads the pointer', async () => {
  const { api, meaningApi, adapter } = fixture()
  api.getGuidedJourney.mockResolvedValueOnce(pointer('GUIDE_REQUIRED'))
  meaningApi.getCombinedScreeningMeaning.mockResolvedValueOnce({
    ...meaning,
    supportGuideId: null,
  })
  await expect(adapter.ensureGuide()).resolves.toMatchObject({ guide })
  expect(api.ensureEpisodeSupportGuide).toHaveBeenCalledTimes(1)
  expect(api.ensureEpisodeSupportGuide).toHaveBeenCalledWith('episode')
  expect(api.getGuidedJourney).toHaveBeenCalledTimes(2)
})

it('rejects an unrelated pair and never creates a Guide', async () => {
  const { api, meaningApi, adapter } = fixture()
  meaningApi.getCombinedScreeningMeaning.mockResolvedValueOnce({
    ...meaning,
    evidence: [{ assessmentId: 'other' }, { assessmentId: 'gad' }],
  })
  await expect(adapter.ensureGuide()).rejects.toThrow(
    'Combined meaning does not match',
  )
  expect(api.ensureEpisodeSupportGuide).not.toHaveBeenCalled()
})

it('preserves only the exact confirmed Meaning when Guide is unavailable', async () => {
  const { api, adapter } = fixture()
  api.getSupportGuide.mockRejectedValueOnce(
    new ApiError({ code: 'CARE_UNAVAILABLE', message: 'offline', status: 503 }),
  )
  await expect(adapter.read()).rejects.toMatchObject({
    kind: 'unavailable',
    partial: { episode, meaning, guide: null },
  })
  expect(api.ensureEpisodeSupportGuide).not.toHaveBeenCalled()
})

it.each([
  [404, 'missing'],
  [500, 'failure'],
])('classifies Guide status %s as %s', async (status, kind) => {
  const { api, adapter } = fixture()
  api.getSupportGuide.mockRejectedValueOnce(
    new ApiError({
      code: 'ERROR',
      message: 'failed',
      status: status as number,
    }),
  )
  await expect(adapter.read()).rejects.toMatchObject({ kind })
})

it('does not return partial Meaning when the session changes during Guide read', async () => {
  const { api, adapter, isSessionCurrent } = fixture()
  api.getSupportGuide.mockImplementationOnce(async () => {
    isSessionCurrent.mockReturnValue(false)
    throw new Error('offline')
  })
  await expect(adapter.read()).rejects.not.toBeInstanceOf(NativeGuideReadError)
})

it.each(['IN_PROGRESS', 'READY'])(
  'resumes an open %s episode without preparing an older Guide',
  async (status) => {
    const { api, meaningApi, adapter } = fixture()
    api.getGuidedJourney.mockResolvedValueOnce({
      ...pointer('GUIDE_READY'),
      assessmentInProgress: true,
    })
    api.getCurrentEpisode.mockResolvedValueOnce({
      ...episode,
      episodeId: 'new',
      status,
    })
    await expect(adapter.ensureGuide()).resolves.toMatchObject({
      episode: { episodeId: 'new', status },
      meaning: null,
      guide: null,
    })
    expect(api.ensureEpisodeSupportGuide).not.toHaveBeenCalled()
    expect(meaningApi.getCombinedScreeningMeaning).not.toHaveBeenCalled()
  },
)

it('retries the same server ensure after an uncertain failure and reads the persisted Guide', async () => {
  const { api, meaningApi, adapter } = fixture()
  api.getGuidedJourney
    .mockResolvedValueOnce(pointer('GUIDE_REQUIRED'))
    .mockResolvedValueOnce(pointer('GUIDE_REQUIRED'))
  meaningApi.getCombinedScreeningMeaning
    .mockResolvedValueOnce({ ...meaning, supportGuideId: null })
    .mockResolvedValueOnce({ ...meaning, supportGuideId: null })
  api.ensureEpisodeSupportGuide.mockRejectedValueOnce(new Error('timeout'))
  await expect(adapter.ensureGuide()).rejects.toThrow('timeout')
  await expect(adapter.ensureGuide()).resolves.toMatchObject({ guide })
  expect(api.ensureEpisodeSupportGuide).toHaveBeenCalledTimes(2)
  expect(api.ensureEpisodeSupportGuide).toHaveBeenNthCalledWith(1, 'episode')
  expect(api.ensureEpisodeSupportGuide).toHaveBeenNthCalledWith(2, 'episode')
})

it('rejects an old session response and makes no subsequent requests', async () => {
  const { api, adapter, isSessionCurrent } = fixture()
  api.getGuidedJourney.mockImplementationOnce(async () => {
    isSessionCurrent.mockReturnValue(false)
    return pointer('GUIDE_READY')
  })
  await expect(adapter.ensureGuide()).rejects.toThrow(
    'Authenticated session changed',
  )
  expect(api.getCurrentEpisode).not.toHaveBeenCalled()
  expect(api.ensureEpisodeSupportGuide).not.toHaveBeenCalled()
})

it('rejects a different current episode before reading meaning or ensuring a Guide', async () => {
  const { api, meaningApi, adapter } = fixture()
  api.getCurrentEpisode.mockResolvedValueOnce({
    ...episode,
    episodeId: 'other',
  })
  await expect(adapter.ensureGuide()).rejects.toThrow(
    'Current episode does not match',
  )
  expect(meaningApi.getCombinedScreeningMeaning).not.toHaveBeenCalled()
  expect(api.ensureEpisodeSupportGuide).not.toHaveBeenCalled()
})
