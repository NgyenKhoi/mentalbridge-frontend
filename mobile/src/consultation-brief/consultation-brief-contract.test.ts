import {
  consultationBriefDraftRequestSchema,
  consultationBriefSchema,
  consultationBriefScreeningContextListSchema,
} from './consultation-brief-contract'
import {
  draftBrief,
  screeningChoices,
  supportEvaluationId,
} from './consultation-brief-fixtures'

describe('MB-723 consultation brief owner contracts', () => {
  it('accepts only the bounded server brief and exact screening choice count', () => {
    expect(consultationBriefSchema.parse(draftBrief)).toEqual(draftBrief)
    expect(
      consultationBriefScreeningContextListSchema.parse(screeningChoices),
    ).toEqual(screeningChoices)
    expect(() =>
      consultationBriefSchema.parse({
        ...draftBrief,
        privateJournal: 'secret',
      }),
    ).toThrow()
    expect(() =>
      consultationBriefScreeningContextListSchema.parse({
        ...screeningChoices,
        count: 2,
      }),
    ).toThrow()
    expect(() =>
      consultationBriefSchema.parse({
        ...draftBrief,
        sharingStatus: 'ACTIVE',
      }),
    ).toThrow()
    expect(() =>
      consultationBriefSchema.parse({
        ...draftBrief,
        screeningContext: [
          draftBrief.screeningContext[0],
          draftBrief.screeningContext[0],
        ],
      }),
    ).toThrow()
  })

  it('allows only minimized, user-authored draft fields', () => {
    const draft = {
      currentSituation: 'Cần chuẩn bị một chủ đề.',
      supportEvaluationId,
      userGoals: ['Thống nhất một bước tiếp theo.'],
    }
    expect(consultationBriefDraftRequestSchema.parse(draft)).toEqual(draft)
    expect(() =>
      consultationBriefDraftRequestSchema.parse({
        ...draft,
        rawAssessmentAnswers: [1, 2, 3],
      }),
    ).toThrow()
    expect(() =>
      consultationBriefDraftRequestSchema.parse({
        ...draft,
        userGoals: Array.from({ length: 6 }, (_, index) => `Mục tiêu ${index}`),
      }),
    ).toThrow()
  })
})
