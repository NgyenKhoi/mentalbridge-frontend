import type { components } from '@/contracts/journal.generated'

type Schemas = components['schemas']

export type CompanionState = Schemas['CompanionState']
export type CompanionCommitment = Schemas['CompanionCommitment']
export type CompanionFocus = Schemas['CompanionFocus']
export type CompanionFocusGoal = Schemas['CompanionFocusGoal']
export type CompanionChapter = Schemas['CompanionChapter']
export type CompanionChapterInput = Schemas['CompanionChapterInput']
export type CompanionChapterRating = Schemas['CompanionChapterRating']
export type CompanionChapterObstacle = Schemas['CompanionChapterObstacle']
export type CompanionChapterConnected = Schemas['CompanionChapterConnected']
export type CompanionCommitmentKind = Schemas['CompanionCommitmentKind']
export type CompanionCommitmentMinutes = Schemas['CompanionCommitmentMinutes']
export type CompanionCommitmentSource = Schemas['CompanionCommitmentSource']
export type CompanionCommitmentStatus = Schemas['CompanionCommitmentStatus']
export type UpdateCompanionStateRequest = Schemas['UpdateCompanionStateRequest']
export type CreateCompanionCommitmentRequest =
  Schemas['CreateCompanionCommitmentRequest']
export type ResolveCompanionCommitmentRequest =
  Schemas['ResolveCompanionCommitmentRequest']
