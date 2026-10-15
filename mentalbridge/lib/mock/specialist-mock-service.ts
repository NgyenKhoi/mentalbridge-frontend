import type { NextRequest } from 'next/server'
import type {
  Appointment,
  AppointmentList,
  AvailabilitySlot,
  AvailabilitySlotList,
  PublishAvailabilityInput,
  SavePayoutDestinationInput,
  SpecialistDashboard,
  SpecialistEarnings,
  SpecialistProfile,
  SpecialistProfileInput,
} from '@/lib/consultation/consultation-validation'
import type {
  SpecialistClientContinuityList,
  SpecialistConsultationBrief,
} from '@/features/appointments/api/consultation-brief-contract'
import {
  MOCK_AVAILABILITY_SLOTS,
  MOCK_SPECIALIST_APPOINTMENTS,
  MOCK_SPECIALIST_CLIENT_CONTINUITY,
  MOCK_SPECIALIST_CONSULTATION_BRIEF,
  MOCK_SPECIALIST_DASHBOARD,
  MOCK_SPECIALIST_EARNINGS,
  MOCK_SPECIALIST_PROFILE,
} from './specialist-mock-data'
import { FEATURES, MOCK_AVAILABILITY_REST_DAYS, nextWeekAtLocalTime } from './specialist-availability-preview'

export class MockAvailabilityOverlapError extends Error {}
export class MockAvailabilityRestDayError extends Error {}

export function isSpecialistMockEnabled(request?: NextRequest): boolean {
  if (request?.nextUrl?.searchParams?.get('mock') === 'true') return true
  if (request?.nextUrl?.searchParams?.get('mock') === 'false') return false
  return process.env.USE_MOCK_SPECIALIST !== 'false'
}

class SpecialistMockStore {
  private profile: SpecialistProfile = { ...MOCK_SPECIALIST_PROFILE }
  private appointments: Appointment[] = [...MOCK_SPECIALIST_APPOINTMENTS.items]
  private slots: AvailabilitySlot[] = [...MOCK_AVAILABILITY_SLOTS.items]
  private earnings: SpecialistEarnings = { ...MOCK_SPECIALIST_EARNINGS }
  private clientContinuity: SpecialistClientContinuityList = {
    ...MOCK_SPECIALIST_CLIENT_CONTINUITY,
  }
  private briefs: Map<string, SpecialistConsultationBrief> = new Map([
    [
      MOCK_SPECIALIST_CONSULTATION_BRIEF.appointmentId,
      { ...MOCK_SPECIALIST_CONSULTATION_BRIEF },
    ],
  ])

  getProfile(): { data: SpecialistProfile; etag: string } {
    return { data: this.profile, etag: `"${this.profile.version}"` }
  }

  updateProfile(input: SpecialistProfileInput): {
    data: SpecialistProfile
    etag: string
  } {
    const nextVersion = this.profile.version + 1
    this.profile = {
      ...this.profile,
      ...input,
      approvalStatus: 'APPROVED',
      updatedAt: new Date().toISOString(),
      version: nextVersion,
    }
    return { data: this.profile, etag: `"${nextVersion}"` }
  }

  getDashboard(): SpecialistDashboard {
    const asOf = new Date().toISOString()
    const todayStr = asOf.split('T')[0]

    const confirmed = this.appointments.filter((a) => a.status === 'CONFIRMED')
    const requested = this.appointments.filter((a) => a.status === 'REQUESTED')
    const nextItem = confirmed[0]

    return {
      source: 'CONSULTATION',
      generatedAt: asOf,
      operationalStatus: 'READY',
      profile: {
        source: 'CONSULTATION',
        asOf,
        state: 'AVAILABLE',
        displayName: this.profile.displayName,
        timezone: this.profile.timezone,
        approvalStatus: 'APPROVED',
      },
      ratingAggregate: {
        source: 'CONSULTATION',
        asOf,
        state: 'AVAILABLE',
        averageRating: 4.9,
        ratingCount: 42,
      },
      todayConfirmedSessions: {
        source: 'CONSULTATION',
        asOf,
        state: 'AVAILABLE',
        count: confirmed.length,
        localDate: todayStr,
        timezone: this.profile.timezone,
        items: confirmed.slice(0, 5).map((a) => ({
          source: 'CONSULTATION',
          asOf,
          appointmentId: a.id,
          status: 'CONFIRMED',
          modality: a.modality,
          scheduledStartAt: a.scheduledStartAt,
          scheduledEndAt: a.scheduledEndAt,
          timezone: a.timezone,
          decisionDeadlineAt: a.decisionDeadlineAt,
        })),
      },
      pendingAppointmentRequests: {
        source: 'CONSULTATION',
        asOf,
        state: requested.length > 0 ? 'AVAILABLE' : 'EMPTY',
        count: requested.length,
        localDate: null,
        timezone: this.profile.timezone,
        items: requested.slice(0, 5).map((a) => ({
          source: 'CONSULTATION',
          asOf,
          appointmentId: a.id,
          status: 'REQUESTED',
          modality: a.modality,
          scheduledStartAt: a.scheduledStartAt,
          scheduledEndAt: a.scheduledEndAt,
          timezone: a.timezone,
          decisionDeadlineAt: a.decisionDeadlineAt,
        })),
      },
      nextAppointment: {
        source: 'CONSULTATION',
        asOf,
        state: nextItem ? 'AVAILABLE' : 'EMPTY',
        item: nextItem
          ? {
              source: 'CONSULTATION',
              asOf,
              appointmentId: nextItem.id,
              status: 'CONFIRMED',
              modality: nextItem.modality,
              scheduledStartAt: nextItem.scheduledStartAt,
              scheduledEndAt: nextItem.scheduledEndAt,
              timezone: nextItem.timezone,
              decisionDeadlineAt: nextItem.decisionDeadlineAt,
            }
          : null,
      },
      availability: {
        source: 'CONSULTATION',
        asOf,
        state: 'AVAILABLE',
        count: this.slots.length,
        items: this.slots.slice(0, 5).map((s) => ({
          source: 'CONSULTATION',
          asOf,
          slotId: s.id,
          modality: s.modality,
          startAt: s.startAt,
          endAt: s.endAt,
          timezone: s.timezone,
        })),
      },
      actionRequired:
        requested.length > 0
          ? [
              {
                source: 'CONSULTATION',
                asOf,
                type: 'REVIEW_APPOINTMENT_REQUESTS',
                count: requested.length,
              },
            ]
          : [],
    }
  }

  getAppointments(): AppointmentList {
    return {
      count: this.appointments.length,
      generatedAt: new Date().toISOString(),
      items: this.appointments,
    }
  }

  decideAppointment(
    appointmentId: string,
    decision: 'accept' | 'reject',
  ): { data: Appointment; etag: string } | null {
    const target = this.appointments.find((a) => a.id === appointmentId)
    if (!target) return null
    const nextVersion = target.version + 1
    const nextStatus = decision === 'accept' ? 'CONFIRMED' : 'REJECTED'
    const nextReason =
      decision === 'accept' ? 'SPECIALIST_ACCEPTED' : 'SPECIALIST_REJECTED'
    const decidedAt = new Date().toISOString()

    const updated: Appointment = {
      ...target,
      status: nextStatus,
      decidedAt,
      decisionReason: nextReason,
      creditState: decision === 'accept' ? 'HELD' : 'AVAILABLE',
      version: nextVersion,
      history: [
        ...target.history,
        {
          eventId: crypto.randomUUID(),
          fromStatus: target.status,
          toStatus: nextStatus,
          actorType: 'SPECIALIST',
          actorId: this.profile.accountId,
          reason: nextReason,
          creditOutcome: null,
          occurredAt: decidedAt,
        },
      ],
    }

    this.appointments = this.appointments.map((a) =>
      a.id === appointmentId ? updated : a,
    )
    return { data: updated, etag: `"${nextVersion}"` }
  }

  getSlots(includeWithdrawn = true): AvailabilitySlotList & {
    restDays: string[]
    features: typeof FEATURES
  } {
    const filtered = includeWithdrawn
      ? this.slots
      : this.slots.filter((s) => s.status !== 'WITHDRAWN')
    return {
      count: filtered.length,
      generatedAt: new Date().toISOString(),
      videoPublishingEnabled: true,
      items: filtered,
      // TODO(API): Return specialist rest days from the availability owner.
      restDays: MOCK_AVAILABILITY_REST_DAYS,
      features: FEATURES,
    }
  }

  publishSlots(input: PublishAvailabilityInput, repeatWeekly: boolean): AvailabilitySlot[] {
    const ranges = [input]
    if (repeatWeekly && FEATURES.repeatWeekly) {
      const nextStart = nextWeekAtLocalTime(input.startAt, input.timezone)
      ranges.push({
        ...input,
        startAt: nextStart,
        endAt: new Date(new Date(nextStart).getTime() + 60 * 60 * 1000).toISOString(),
      })
    }

    for (const range of ranges) {
      const dateParts = new Intl.DateTimeFormat('en-CA', {
        timeZone: range.timezone,
        year: 'numeric', month: '2-digit', day: '2-digit',
      }).formatToParts(new Date(range.startAt))
      const date = Object.fromEntries(dateParts.map((part) => [part.type, part.value]))
      if (MOCK_AVAILABILITY_REST_DAYS.includes(`${date.year}-${date.month}-${date.day}`))
        throw new MockAvailabilityRestDayError('Ngày đã chọn là ngày nghỉ.')

      const start = new Date(range.startAt).getTime()
      const end = new Date(range.endAt).getTime()
      if (this.slots.some((slot) => slot.status === 'ACTIVE' &&
        start < new Date(slot.endAt).getTime() && end > new Date(slot.startAt).getTime()))
        throw new MockAvailabilityOverlapError('Khung giờ này đã có ca.')
    }

    const createdAt = new Date().toISOString()
    const created = ranges.map((range): AvailabilitySlot => ({
      id: crypto.randomUUID(),
      ...range,
      status: 'ACTIVE',
      readiness: 'AVAILABLE',
      withdrawnAt: null,
      createdAt,
      updatedAt: createdAt,
      version: 1,
    }))
    this.slots.unshift(...created)
    return created
  }

  withdrawSlot(slotId: string): AvailabilitySlot | null {
    const target = this.slots.find((s) => s.id === slotId)
    if (!target) return null
    const updated: AvailabilitySlot = {
      ...target,
      status: 'WITHDRAWN',
      readiness: 'WITHDRAWN',
      withdrawnAt: new Date().toISOString(),
      version: target.version + 1,
    }
    this.slots = this.slots.map((s) => (s.id === slotId ? updated : s))
    return updated
  }

  getEarnings(): SpecialistEarnings {
    return { ...this.earnings, generatedAt: new Date().toISOString() }
  }

  savePayoutDestination(input: SavePayoutDestinationInput) {
    const dest = {
      id: crypto.randomUUID(),
      provider: 'MOMO' as const,
      destinationType: input.destinationType,
      displayHint:
        input.destinationType === 'MOMO_WALLET'
          ? `MoMo · ${(input as any).walletReference?.slice(-4) ?? '9999'}`
          : `Ngân hàng · ${(input as any).accountReference?.slice(-4) ?? '9999'}`,
      status: 'VERIFIED' as const,
      verifiedAt: new Date().toISOString(),
    }
    this.earnings = {
      ...this.earnings,
      destination: dest,
    }
    return dest
  }

  createPayout(destinationId: string) {
    const available = this.earnings.balance.availableVnd
    if (available < this.earnings.minimumWithdrawalVnd) {
      throw new Error('Số dư khả dụng không đủ mức rút tối thiểu.')
    }
    const newPayout = {
      id: crypto.randomUUID(),
      destinationId,
      amountVnd: available,
      provider: 'MOMO' as const,
      status: 'SUCCEEDED' as const,
      providerReference: `MOMO_PAYOUT_${Date.now()}`,
      failureCode: null,
      requestedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    }
    this.earnings = {
      ...this.earnings,
      balance: {
        ...this.earnings.balance,
        availableVnd: 0,
        processingVnd: 0,
        paidVnd: this.earnings.balance.paidVnd + available,
      },
      payouts: [newPayout, ...this.earnings.payouts],
    }
    return this.earnings
  }

  getClientContinuity(): SpecialistClientContinuityList {
    return {
      ...this.clientContinuity,
      generatedAt: new Date().toISOString(),
    }
  }

  getConsultationBrief(
    appointmentId: string,
  ): SpecialistConsultationBrief | null {
    return (
      this.briefs.get(appointmentId) ?? {
        ...MOCK_SPECIALIST_CONSULTATION_BRIEF,
        appointmentId,
      }
    )
  }
}

export const specialistMockService = new SpecialistMockStore()

