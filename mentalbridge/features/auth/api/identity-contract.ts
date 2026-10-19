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
export type AccountsSummary = Schemas['AccountsSummary']
export type AccountsSummaryRoleBreakdown =
  Schemas['AccountsSummaryRoleBreakdown']
export type AccountDetail = Schemas['AccountDetail']
export type AccountPage = Schemas['AccountPage']
export type AccountStateChangeRequest = Schemas['AccountStateChangeRequest']
export type AdministrationAuditEvent = Schemas['AdministrationAuditEvent']
export type AdministrationAuditEventPage =
  Schemas['AdministrationAuditEventPage']
export type AuditActorType = Schemas['AuditActorType']
export type AuditDomain = Schemas['AuditDomain']
export type AuditResult = Schemas['AuditResult']
export type AuditSourceService = Schemas['AuditSourceService']
export type PlatformReportType = Schemas['PlatformReportType']
export type PlatformReportTypeCode = Schemas['PlatformReportTypeCode']
export type PlatformReportRequest = Schemas['PlatformReportRequest']
export type PlatformReport = Schemas['PlatformReport']
export type PlatformReportPage = Schemas['PlatformReportPage']
export type PlatformReportSchedule = Schemas['PlatformReportSchedule']
export type PlatformReportScheduleRequest =
  Schemas['PlatformReportScheduleRequest']
export type ProductJourneyMetrics = Schemas['ProductJourneyMetrics']
export type RetentionPolicy = Schemas['RetentionPolicy']
export type RetentionPolicyOwnerService = RetentionPolicy['ownerService']
export type RetentionPolicyStatus = RetentionPolicy['status']
export type RetentionJobStatus = RetentionPolicy['jobStatus']
export type RetentionExecutionRecord = Schemas['RetentionExecutionRecord']
export type DeletionRequest = Schemas['DeletionRequest']
export type DeletionRequestStatus = DeletionRequest['status']
export type DeletionHoldType = DeletionRequest['holdType']
export type DeletionEscalationState = DeletionRequest['escalationState']
export type DeletionOwnerFact = Schemas['DeletionOwnerFact']
export type DeletionRequestPage = Schemas['DeletionRequestPage']
export type ApplyHoldRequest = Schemas['ApplyHoldRequest']
export type IdentityProblem = Schemas['Problem']
