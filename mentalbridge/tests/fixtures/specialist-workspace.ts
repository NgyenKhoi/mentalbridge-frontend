import type {
  Appointment,
  SpecialistDashboard,
  SpecialistEarnings,
} from '@/lib/consultation/consultation-validation'
import { approvedProfile } from './profile-amendment'

export const workspaceTime = '2026-10-09T03:00:00Z'
export const workspaceId = (n: number) =>
  `50000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const projection = (
  n: number,
  status: 'REQUESTED' | 'CONFIRMED' | 'IN_PROGRESS',
) => ({
  source: 'CONSULTATION' as const,
  asOf: workspaceTime,
  appointmentId: workspaceId(n),
  status,
  modality: 'IN_APP_CHAT' as const,
  scheduledStartAt: '2026-10-10T03:00:00Z',
  scheduledEndAt: '2026-10-10T04:00:00Z',
  timezone: 'Asia/Ho_Chi_Minh',
  decisionDeadlineAt: '2026-10-09T09:00:00Z',
})
export const workspaceDashboard: SpecialistDashboard = {
  source: 'CONSULTATION',
  generatedAt: workspaceTime,
  operationalStatus: 'READY',
  profile: {
    source: 'CONSULTATION',
    asOf: workspaceTime,
    state: 'AVAILABLE',
    displayName: approvedProfile.displayName,
    timezone: 'Asia/Ho_Chi_Minh',
    approvalStatus: 'APPROVED',
  },
  ratingAggregate: {
    source: 'CONSULTATION',
    asOf: workspaceTime,
    state: 'AVAILABLE',
    averageRating: 4.7,
    ratingCount: 3,
  },
  todayConfirmedSessions: {
    source: 'CONSULTATION',
    asOf: workspaceTime,
    state: 'AVAILABLE',
    count: 1,
    localDate: '2026-10-10',
    timezone: 'Asia/Ho_Chi_Minh',
    items: [projection(2, 'CONFIRMED')],
  },
  pendingAppointmentRequests: {
    source: 'CONSULTATION',
    asOf: workspaceTime,
    state: 'AVAILABLE',
    count: 1,
    localDate: null,
    timezone: 'Asia/Ho_Chi_Minh',
    items: [projection(1, 'REQUESTED')],
  },
  nextAppointment: {
    source: 'CONSULTATION',
    asOf: workspaceTime,
    state: 'AVAILABLE',
    item: projection(2, 'CONFIRMED'),
  },
  availability: {
    source: 'CONSULTATION',
    asOf: workspaceTime,
    state: 'AVAILABLE',
    count: 2,
    items: [],
  },
  actionRequired: [],
}
export const workspaceEarnings: SpecialistEarnings = {
  currency: 'VND',
  earningPolicyVersion: 'specialist-earning-v1',
  settlementHoldDays: 7,
  minimumWithdrawalVnd: 100000,
  generatedAt: workspaceTime,
  balance: {
    pendingSettlementVnd: 210000,
    availableVnd: 420000,
    processingVnd: 0,
    paidVnd: 210000,
  },
  destination: {
    id: workspaceId(100),
    provider: 'FAKE',
    destinationType: 'MOMO_WALLET',
    displayHint: '•••• 6789',
    status: 'VERIFIED',
    verifiedAt: workspaceTime,
  },
  earnings: [
    {
      id: workspaceId(101),
      appointmentId: workspaceId(2),
      consumedCreditId: workspaceId(201),
      planVersion: 'sandbox-catalog-v1',
      creditAllocationVnd: 300000,
      sharePercent: 70,
      earningAmountVnd: 210000,
      status: 'AVAILABLE',
      earnedAt: '2026-10-01T03:00:00Z',
      settlementAvailableAt: '2026-10-08T03:00:00Z',
    },
    {
      id: workspaceId(102),
      appointmentId: workspaceId(3),
      consumedCreditId: workspaceId(202),
      planVersion: 'sandbox-catalog-v1',
      creditAllocationVnd: 300000,
      sharePercent: 70,
      earningAmountVnd: 210000,
      status: 'PENDING_SETTLEMENT',
      earnedAt: '2026-10-08T03:00:00Z',
      settlementAvailableAt: '2026-10-15T03:00:00Z',
    },
  ],
  payouts: [
    {
      id: workspaceId(110),
      destinationId: workspaceId(100),
      amountVnd: 210000,
      provider: 'FAKE',
      status: 'SUCCEEDED',
      requestedAt: '2026-10-01T03:00:00Z',
      completedAt: '2026-10-01T03:05:00Z',
    },
  ],
}
export function workspaceAppointment(
  n: number,
  status: Appointment['status'],
): Appointment {
  return {
    id: workspaceId(n),
    slotId: workspaceId(n + 300),
    specialistAccountId: approvedProfile.accountId,
    specialistDisplayName: approvedProfile.displayName,
    status,
    modality: 'IN_APP_CHAT',
    scheduledStartAt: '2026-10-10T03:00:00Z',
    scheduledEndAt: '2026-10-10T04:00:00Z',
    timezone: 'Asia/Ho_Chi_Minh',
    requestedAt: workspaceTime,
    decisionDeadlineAt: '2026-10-09T09:00:00Z',
    heldCreditId: workspaceId(n + 400),
    replacesAppointmentId: null,
    replacedByAppointmentId: null,
    decidedAt: status === 'REQUESTED' ? null : workspaceTime,
    decisionReason: null,
    cancelledAt: null,
    cancellationReason: null,
    cancellationActor: null,
    cancellationCreditOutcome: null,
    sessionOutcome: null,
    sessionOutcomeReason: null,
    sessionPolicyVersion: null,
    sessionEndedAt: null,
    sessionSettledAt: null,
    completionFactId: null,
    creditState: 'HELD',
    history: [],
    version: 0,
  }
}

// MB-787: PayOS bank payout fixtures (synthetic data only).
export const payosTime = '2026-11-04T03:00:00Z'
export const payosBanks = {
  generatedAt: payosTime,
  items: [
    {
      bin: '970436',
      name: 'Ngân hàng TMCP Ngoại thương Việt Nam',
      shortName: 'Vietcombank',
    },
    { bin: '970406', name: 'Ngân hàng TMCP Đông Á', shortName: 'DongA Bank' },
    {
      bin: '970415',
      name: 'Ngân hàng TMCP Công thương Việt Nam',
      shortName: 'VietinBank',
    },
  ],
}
export const payosPendingDestination = {
  id: workspaceId(300),
  provider: 'PAYOS' as const,
  destinationType: 'BANK_ACCOUNT' as const,
  displayHint: '970436 ****7890',
  status: 'PENDING_CONFIRMATION' as const,
  verifiedAt: null,
  bankCode: '970436',
  bankName: 'Ngân hàng TMCP Ngoại thương Việt Nam',
  version: 0,
  updatedAt: payosTime,
  usableForPayout: false,
}
export const payosConfirmedDestination = {
  ...payosPendingDestination,
  status: 'VERIFIED' as const,
  verifiedAt: '2026-11-04T04:00:00Z',
  version: 1,
  usableForPayout: true,
}
export const payosLegacyMomo = {
  ...payosPendingDestination,
  provider: 'MOMO' as const,
  destinationType: 'MOMO_WALLET' as const,
  displayHint: 'MOMO ****7890',
  status: 'DISABLED' as const,
  verifiedAt: '2026-10-01T03:00:00Z',
  bankCode: null,
  bankName: null,
  usableForPayout: false,
}
export const payosPayout = {
  id: workspaceId(310),
  destinationId: payosPendingDestination.id,
  amountVnd: 420000,
  provider: 'PAYOS' as const,
  status: 'PROCESSING' as const,
  providerReference: 'synthetic-payos-outer-787',
  failureCode: null,
  requestedAt: payosTime,
  completedAt: null,
  reconciliationStatus: 'POLLING' as const,
  nextReconciliationAt: payosTime,
  reviewRequiredAt: null,
}
export function payosEarnings(
  patch: Partial<SpecialistEarnings> = {},
): SpecialistEarnings {
  return {
    ...workspaceEarnings,
    generatedAt: payosTime,
    payoutProvider: 'PAYOS',
    payoutAvailability: { mode: 'PAYOS', ready: true, reasonCode: null },
    balance: { ...workspaceEarnings.balance, retryPendingVnd: 0 },
    destination: payosConfirmedDestination,
    payouts: [],
    ...patch,
  }
}
export const adminDestinationQueue = {
  generatedAt: payosTime,
  count: 2,
  items: [
    {
      destination: payosPendingDestination,
      specialistAccountId: workspaceId(400),
    },
    {
      destination: {
        ...payosPendingDestination,
        id: workspaceId(301),
        bankName: 'Ngân hàng TMCP Đông Á',
        bankCode: '970406',
        displayHint: '970406 ****1122',
      },
      specialistAccountId: workspaceId(401),
    },
  ],
}
export const adminDestinationDetail = {
  destination: payosPendingDestination,
  specialistAccountId: workspaceId(400),
  accountReference: '1234567890',
  accountHolderName: 'NGUYEN VAN A',
  confirmedBy: null,
}
export const adminPayoutRow = {
  payoutId: workspaceId(310),
  specialistAccountId: workspaceId(400),
  destinationHint: '970436 ****7890',
  amountVnd: 420000,
  currency: 'VND' as const,
  provider: 'PAYOS' as const,
  status: 'FAILED' as const,
  earningCount: 2,
  providerReference: 'synthetic-payos-outer-787',
  failureCode: 'PAYOUT_INSUFFICIENT_BALANCE',
  requestedAt: payosTime,
  completedAt: payosTime,
  reconciliationStatus: 'COMPLETE' as const,
  nextReconciliationAt: null,
  reviewRequiredAt: null,
  closedAt: null as string | null,
}
