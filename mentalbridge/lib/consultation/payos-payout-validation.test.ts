import { describe, expect, it } from 'vitest'
import {
  ConsultationInputError,
  parseAdminPayoutDestinationDetail,
  parseAdminPayoutDestinationList,
  parseAdminPayoutList,
  parseCloseFailedPayoutInput,
  parseConfirmPayoutDestinationInput,
  parsePayoutBankList,
  parsePayoutDestination,
  parseRetryPayoutInput,
  parseSpecialistEarnings,
} from './consultation-validation'
import {
  parseAdminCommercialDiscrepancies,
  parseAdminPayoutDetail,
} from './reconciliation-validation'

const id = '78700000-0000-4000-8000-000000000001'
const other = '78700000-0000-4000-8000-000000000002'
const at = '2026-11-04T03:00:00Z'
const pending = {
  id,
  provider: 'PAYOS',
  destinationType: 'BANK_ACCOUNT',
  displayHint: '970436 ****7890',
  status: 'PENDING_CONFIRMATION',
  verifiedAt: null,
  bankCode: '970436',
  bankName: 'Synthetic bank',
  version: 0,
  updatedAt: at,
  usableForPayout: false,
}
const payout = {
  id: '78700000-0000-4000-8000-000000000003',
  destinationId: id,
  amountVnd: 210000,
  provider: 'PAYOS',
  status: 'PROCESSING',
  providerReference: 'ref',
  failureCode: null,
  requestedAt: at,
  completedAt: null,
  reconciliationStatus: 'POLLING',
  nextReconciliationAt: at,
  reviewRequiredAt: null,
}
const earnings = {
  currency: 'VND',
  earningPolicyVersion: 'specialist-earning-v1',
  payoutProvider: 'PAYOS',
  payoutAvailability: { mode: 'PAYOS', ready: true, reasonCode: null },
  settlementHoldDays: 7,
  minimumWithdrawalVnd: 100000,
  generatedAt: at,
  balance: {
    pendingSettlementVnd: 0,
    availableVnd: 0,
    retryPendingVnd: 210000,
    processingVnd: 0,
    paidVnd: 0,
  },
  destination: pending,
  earnings: [],
  payouts: [payout],
}

describe('PayOS payout validators', () => {
  it('accepts a pending bank revision with null verifiedAt and the new fields', () => {
    expect(parsePayoutDestination(pending)?.status).toBe('PENDING_CONFIRMATION')
    expect(parseSpecialistEarnings(earnings)).not.toBeNull()
  })

  it('still parses an older server response without the MB-787 fields', () => {
    const legacy = {
      ...earnings,
      destination: {
        id,
        provider: 'FAKE',
        destinationType: 'MOMO_WALLET',
        displayHint: '•••• 6789',
        status: 'VERIFIED',
        verifiedAt: at,
      },
      balance: { ...earnings.balance, retryPendingVnd: undefined },
      payouts: [],
    } as Record<string, unknown>
    delete legacy.payoutAvailability
    delete (legacy.balance as Record<string, unknown>).retryPendingVnd
    expect(parseSpecialistEarnings(legacy)).not.toBeNull()
  })

  it('rejects unknown providers, modes, statuses and extra keys', () => {
    expect(
      parsePayoutDestination({ ...pending, provider: 'STRIPE' }),
    ).toBeNull()
    expect(parsePayoutDestination({ ...pending, status: 'OPEN' })).toBeNull()
    expect(
      parsePayoutDestination({ ...pending, accountNumber: '1' }),
    ).toBeNull()
    expect(
      parseSpecialistEarnings({
        ...earnings,
        payoutAvailability: { mode: 'LIVE', ready: true, reasonCode: null },
      }),
    ).toBeNull()
    expect(
      parseSpecialistEarnings({
        ...earnings,
        payouts: [{ ...payout, reconciliationStatus: 'DONE' }],
      }),
    ).toBeNull()
    expect(
      parseSpecialistEarnings({
        ...earnings,
        balance: { ...earnings.balance, retryPendingVnd: -1 },
      }),
    ).toBeNull()
  })

  it('parses the admin ledger with PAYOS and review evidence', () => {
    const item = {
      payoutId: payout.id,
      specialistAccountId: other,
      destinationHint: '970436 ****7890',
      amountVnd: 210000,
      currency: 'VND',
      provider: 'PAYOS',
      status: 'UNKNOWN',
      earningCount: 1,
      providerReference: 'ref',
      failureCode: 'PAYOUT_RECONCILIATION_OVERDUE',
      requestedAt: at,
      completedAt: null,
      reconciliationStatus: 'NEEDS_REVIEW',
      nextReconciliationAt: null,
      reviewRequiredAt: at,
    }
    const list = { generatedAt: at, count: 1, items: [item] }
    expect(parseAdminPayoutList(list)).not.toBeNull()
    expect(
      parseAdminPayoutList({
        ...list,
        items: [{ ...item, provider: 'PAYPAL' }],
      }),
    ).toBeNull()
    const detail = {
      payout: item,
      attempts: [
        {
          attemptId: other,
          attemptNumber: 1,
          provider: 'PAYOS',
          status: 'FAILED',
          providerReference: null,
          failureCode: 'PAYOUT_INSUFFICIENT_BALANCE',
          requestedAt: at,
          reconciliationStatus: 'COMPLETE',
          nextReconciliationAt: null,
          reviewRequiredAt: null,
        },
      ],
      earnings: [],
      events: [],
    }
    expect(parseAdminPayoutDetail(detail)).not.toBeNull()
    expect(
      parseAdminCommercialDiscrepancies({
        generatedAt: at,
        totalDiscrepancies: 1,
        webhooks: [],
        payouts: [
          {
            payoutId: payout.id,
            specialistAccountId: other,
            destinationHint: 'x',
            amountVnd: 1,
            currency: 'VND',
            provider: 'PAYOS',
            status: 'UNKNOWN',
            reconciliationStatus: 'NEEDS_REVIEW',
            reviewRequiredAt: at,
            requestedAt: at,
          },
        ],
        heldEarnings: [],
        disputes: [],
      }),
    ).not.toBeNull()
  })

  it('validates the bank list: six-digit BIN only', () => {
    const bank = { bin: '970436', name: 'Vietcombank', shortName: 'VCB' }
    expect(
      parsePayoutBankList({ generatedAt: at, items: [bank] }),
    ).not.toBeNull()
    expect(
      parsePayoutBankList({
        generatedAt: at,
        items: [{ ...bank, bin: 'VCB' }],
      }),
    ).toBeNull()
    expect(
      parsePayoutBankList({ generatedAt: at, items: [{ ...bank, logo: 'x' }] }),
    ).toBeNull()
  })

  it('validates the admin queue and the exact-detail response', () => {
    const queue = {
      generatedAt: at,
      count: 1,
      items: [{ destination: pending, specialistAccountId: other }],
    }
    expect(parseAdminPayoutDestinationList(queue)).not.toBeNull()
    expect(parseAdminPayoutDestinationList({ ...queue, count: 2 })).toBeNull()
    const detail = {
      destination: pending,
      specialistAccountId: other,
      accountReference: '1234567890',
      accountHolderName: 'NGUYEN VAN A',
      confirmedBy: null,
    }
    expect(parseAdminPayoutDestinationDetail(detail)).not.toBeNull()
    expect(
      parseAdminPayoutDestinationDetail({ ...detail, accountReference: 1 }),
    ).toBeNull()
    expect(
      parseAdminPayoutDestinationDetail({ ...detail, confirmedBy: 'admin' }),
    ).toBeNull()
  })

  it('accepts only the documented confirm and retry command bodies', () => {
    expect(
      parseConfirmPayoutDestinationInput({
        expectedVersion: 0,
        reasonCode: 'ACCOUNT_HOLDER_CHECKED',
      }),
    ).toEqual({ expectedVersion: 0, reasonCode: 'ACCOUNT_HOLDER_CHECKED' })
    expect(() =>
      parseConfirmPayoutDestinationInput({
        expectedVersion: -1,
        reasonCode: 'ACCOUNT_HOLDER_CHECKED',
      }),
    ).toThrow(ConsultationInputError)
    expect(() =>
      parseConfirmPayoutDestinationInput({
        expectedVersion: 1,
        reasonCode: 'OTHER',
      }),
    ).toThrow(ConsultationInputError)
    expect(parseRetryPayoutInput({ expectedAttemptId: other })).toEqual({
      expectedAttemptId: other,
    })
    expect(() => parseRetryPayoutInput({ expectedAttemptId: 'x' })).toThrow(
      ConsultationInputError,
    )
  })
})

describe('closed payout', () => {
  const closed = { ...payout, status: 'FAILED', closedAt: at }
  const item = {
    payoutId: payout.id,
    specialistAccountId: other,
    destinationHint: '970436 ****7890',
    amountVnd: 210000,
    currency: 'VND',
    provider: 'PAYOS',
    status: 'FAILED',
    earningCount: 1,
    providerReference: null,
    failureCode: 'PAYOUT_INSUFFICIENT_BALANCE',
    requestedAt: at,
    completedAt: at,
    reconciliationStatus: 'COMPLETE',
    closedAt: at,
  }
  const list = (row: unknown) => ({ generatedAt: at, count: 1, items: [row] })

  it('accepts an optional nullable closedAt and rejects a non-instant', () => {
    expect(
      parseSpecialistEarnings({ ...earnings, payouts: [closed] }),
    ).not.toBeNull()
    expect(
      parseSpecialistEarnings({
        ...earnings,
        payouts: [{ ...closed, closedAt: null }],
      }),
    ).not.toBeNull()
    expect(
      parseSpecialistEarnings({
        ...earnings,
        payouts: [{ ...closed, closedAt: 'yesterday' }],
      }),
    ).toBeNull()
    expect(parseAdminPayoutList(list(item))).not.toBeNull()
    expect(
      parseAdminPayoutList(list({ ...item, closedAt: null })),
    ).not.toBeNull()
    expect(
      parseAdminPayoutList(list({ ...item, closedAt: 'yesterday' })),
    ).toBeNull()
    const detail = { payout: item, attempts: [], earnings: [], events: [] }
    expect(parseAdminPayoutDetail(detail)).not.toBeNull()
    expect(
      parseAdminPayoutDetail({ ...detail, payout: { ...item, closedAt: 7 } }),
    ).toBeNull()
  })

  it('accepts only the documented close-failed command body', () => {
    const body = {
      expectedAttemptId: other,
      reasonCode: 'DESTINATION_UNUSABLE',
    }
    expect(parseCloseFailedPayoutInput(body)).toEqual(body)
    for (const bad of [
      { expectedAttemptId: other },
      { ...body, reasonCode: 'OTHER' },
      { ...body, expectedAttemptId: 'x' },
      { ...body, extra: 1 },
    ])
      expect(() => parseCloseFailedPayoutInput(bad)).toThrow(
        ConsultationInputError,
      )
  })
})

describe('maskedHint', () => {
  it('drops the BIN from bank hints and leaves other formats alone', async () => {
    const { maskedHint } =
      await import('@/features/specialist-earnings/payout-labels')
    expect(maskedHint('970436 ****7890')).toBe('••••7890')
    expect(maskedHint('MOMO ****7890')).toBe('MOMO ****7890')
    expect(maskedHint('•••• 6789')).toBe('•••• 6789')
  })
})
