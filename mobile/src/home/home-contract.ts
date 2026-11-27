import { z } from 'zod'

import { guidedJourneySchema } from '@/assessment/assessment-contract'

const todayProgressSchema = z
  .object({
    total: z.number().int().nonnegative(),
    completed: z.number().int().nonnegative(),
  })
  .strict()
  .refine(({ completed, total }) => completed <= total, {
    message: 'Completed Home activities cannot exceed the total',
  })

const nextOccurrenceSchema = z
  .object({
    occurrenceId: z.uuid(),
    actionId: z.string().min(1).max(128),
    actionType: z.enum([
      'RESOURCE',
      'JOURNAL',
      'EMOTION_CHECK_IN',
      'ROUTINE_SELF_MANAGEMENT',
      'PROFESSIONAL_SUPPORT',
      'REASSESSMENT_SCREENING',
      'SELF_REPORT_REVIEW',
    ]),
    title: z.string().min(1).max(255),
    displayState: z.enum(['SCHEDULED', 'OVERDUE']),
    scheduledAt: z.iso.datetime().nullable(),
    estimatedDurationMinutes: z.number().int().positive().nullable(),
  })
  .strict()

const planStepSchema = z
  .object({
    supportPlanId: z.uuid(),
    status: z.enum(['ACTIVE', 'PAUSED']),
    focus: z.enum([
      'RESUME_PAUSED',
      'REVIEW_DUE',
      'DO_TODAY',
      'TODAY_DONE',
      'NOTHING_TODAY',
    ]),
    reviewDueOn: z.iso.date().nullable(),
    cycleDay: z.number().int().positive().nullable(),
    cycleLengthDays: z.number().int().positive().nullable(),
    localDate: z.iso.date(),
    timeZone: z.string().min(1).max(64),
    today: todayProgressSchema,
    nextOccurrence: nextOccurrenceSchema.nullable(),
  })
  .strict()
  .superRefine((plan, context) => {
    if ((plan.focus === 'DO_TODAY') !== (plan.nextOccurrence !== null)) {
      context.addIssue({
        code: 'custom',
        message: 'The Home plan focus does not match its next occurrence',
      })
    }
    if (plan.status === 'PAUSED' && plan.focus !== 'RESUME_PAUSED') {
      context.addIssue({
        code: 'custom',
        message: 'A paused Home plan must use the resume focus',
      })
    }
  })

const completedPlanSchema = z
  .object({
    supportPlanId: z.uuid(),
    completedAt: z.iso.datetime(),
  })
  .strict()

export const homeNextStepSchema = z
  .object({
    homePolicyVersion: z.literal('mb-home-next-step-v1'),
    journey: guidedJourneySchema,
    plan: planStepSchema.nullable(),
    lastCompletedPlan: completedPlanSchema.nullable(),
  })
  .strict()
  .superRefine((home, context) => {
    if (home.journey.nextAction === 'OPEN_CURRENT_PLAN') {
      if (!home.plan) {
        context.addIssue({
          code: 'custom',
          message: 'The current Home plan context is missing',
        })
      } else if (
        home.journey.currentSupportPlanId !== home.plan.supportPlanId
      ) {
        context.addIssue({
          code: 'custom',
          message: 'The Home plan does not match the guided journey',
        })
      }
    }
    if (home.plan && home.lastCompletedPlan) {
      context.addIssue({
        code: 'custom',
        message: 'Current and completed Home plans cannot both be present',
      })
    }
    if (home.lastCompletedPlan && home.journey.currentSupportPlanId) {
      context.addIssue({
        code: 'custom',
        message: 'A completed Home plan cannot coexist with a current plan',
      })
    }
  })

export type HomeNextStep = z.infer<typeof homeNextStepSchema>
export type HomePlanStep = NonNullable<HomeNextStep['plan']>
export type HomeNextOccurrence = NonNullable<HomePlanStep['nextOccurrence']>
