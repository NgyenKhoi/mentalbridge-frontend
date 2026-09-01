import type {
  components,
  operations,
  paths,
} from '@/contracts/identity.generated'

type Schemas = components['schemas']

export type IdentityPaths = paths
export type IdentityOperations = operations

export type IdentityRole = Schemas['RoleCode']
export type PublicRegistrationRole = Extract<
  IdentityRole,
  'USER' | 'SPECIALIST'
>
export type AccountStatus = Schemas['AccountStatus']

export type RegistrationRequest = Schemas['RegistrationRequest']
export type RegistrationResponse = Schemas['RegistrationResponse']
export type EmailRequest = Schemas['EmailRequest']
export type ChallengeRequest = Schemas['ChallengeRequest']
export type LoginRequest = Schemas['LoginRequest']
export type RefreshRequest = Schemas['RefreshRequest']
export type TokenPair = Schemas['TokenPair']
export type PasswordResetRequest = Schemas['PasswordResetRequest']
export type PasswordChangeRequest = Schemas['PasswordChangeRequest']

export type AccountSummary = Schemas['AccountSummary']
export type AccountDetail = Schemas['AccountDetail']
export type AccountPage = Schemas['AccountPage']
export type AccountStateChangeRequest = Schemas['AccountStateChangeRequest']
export type IdentityProblem = Schemas['Problem']
