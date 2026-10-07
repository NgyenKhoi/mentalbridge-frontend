import type { NextRequest } from 'next/server'
import { correlationIdFrom } from '@/lib/auth/bff-response'
import {
  adminAuthenticationFailure,
  authenticatedAdminActor,
  carryAdminSession,
} from '@/lib/auth/admin-actor'
import {
  consultationFailure,
  consultationSuccess,
  localProblem,
} from '@/lib/consultation/bff-response'
import { consultationClient } from '@/lib/consultation/consultation-client'

const statuses = new Set([
  'REQUESTED',
  'CONFIRMED',
  'IN_PROGRESS',
  'SESSION_ENDED',
  'COMPLETED',
  'REJECTED',
  'EXPIRED',
  'CANCELLED',
])
const modalities = new Set(['IN_APP_CHAT', 'IN_APP_VIDEO'])
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(request: NextRequest) {
  const correlationId = correlationIdFrom(request)
  const input = request.nextUrl.searchParams
  const from = input.get('from')
  const to = input.get('to')
  const status = input.get('status')
  const modality = input.get('modality')
  const userAccountId = input.get('userAccountId')
  const specialistAccountId = input.get('specialistAccountId')
  const cursor = input.get('cursor')
  const rawLimit = input.get('limit')
  const limit = rawLimit === null ? 20 : Number(rawLimit)
  const fromTime = from === null ? Number.NaN : Date.parse(from)
  const toTime = to === null ? Number.NaN : Date.parse(to)

  if (
    !Number.isFinite(fromTime) ||
    !Number.isFinite(toTime) ||
    toTime <= fromTime ||
    toTime - fromTime > 180 * 24 * 60 * 60 * 1000 ||
    (status !== null && !statuses.has(status)) ||
    (modality !== null && !modalities.has(modality)) ||
    (userAccountId !== null && !uuid.test(userAccountId)) ||
    (specialistAccountId !== null && !uuid.test(specialistAccountId)) ||
    (cursor !== null && (cursor.length < 1 || cursor.length > 512)) ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 100
  ) {
    return localProblem(
      400,
      'VALIDATION_FAILED',
      'Appointment monitor parameters are invalid.',
      correlationId,
    )
  }

  let actor
  try {
    actor = await authenticatedAdminActor(request, correlationId)
  } catch (error) {
    return adminAuthenticationFailure(error, correlationId)
  }

  try {
    const query = new URLSearchParams({
      from: new Date(fromTime).toISOString(),
      to: new Date(toTime).toISOString(),
      limit: String(limit),
    })
    if (status) query.set('status', status)
    if (modality) query.set('modality', modality)
    if (userAccountId) query.set('userAccountId', userAccountId)
    if (specialistAccountId)
      query.set('specialistAccountId', specialistAccountId)
    if (cursor) query.set('cursor', cursor)
    const result = await consultationClient.adminAppointments(
      actor.accessToken,
      correlationId,
      query.toString(),
    )
    return carryAdminSession(
      consultationSuccess(result.data, correlationId),
      actor,
    )
  } catch (error) {
    return carryAdminSession(consultationFailure(error, correlationId), actor)
  }
}
