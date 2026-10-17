import type { components } from '@/contracts/care-support-guide.generated'

type Schemas = components['schemas']

export type SupportGuide = Schemas['SupportGuide']
export type SupportGuideHistory = Schemas['SupportGuideHistory']
export type GenerateSupportGuideRequest = Schemas['GenerateSupportGuideRequest']
