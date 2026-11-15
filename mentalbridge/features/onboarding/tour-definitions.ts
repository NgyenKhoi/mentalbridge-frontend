import {
  SPECIALIST_ONBOARDING_REPLAY_EVENT,
  SPECIALIST_ONBOARDING_STEPS,
} from './specialist-tour-steps'
import { ONBOARDING_REPLAY_EVENT, ONBOARDING_STEPS } from './tour-steps'

export type OnboardingAudience = 'user' | 'specialist'

export const ONBOARDING_TOURS = {
  user: {
    steps: ONBOARDING_STEPS,
    autoStartPaths: ['/dashboard'],
    replayEvent: ONBOARDING_REPLAY_EVENT,
    focusFallbackSelectors: ['.ref-mobile', '[data-onboarding="profile"]'],
    popoverClass: 'mb-onboarding-popover',
  },
  specialist: {
    steps: SPECIALIST_ONBOARDING_STEPS,
    autoStartPaths: ['/specialist', '/specialist/dashboard'],
    replayEvent: SPECIALIST_ONBOARDING_REPLAY_EVENT,
    focusFallbackSelectors: [
      '.role-menu',
      '.role-sidebar-foot [data-onboarding="profile"]',
    ],
    popoverClass: 'mb-onboarding-popover mb-onboarding-specialist',
  },
} as const
