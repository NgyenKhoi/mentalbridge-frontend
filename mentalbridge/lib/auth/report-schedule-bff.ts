import type { NextRequest } from 'next/server'
import {
  adminAuthenticationFailure,
  authenticatedAdminActor,
  carryAdminSession,
} from './admin-actor'
import {
  correlationIdFrom,
  identityErrorResponse,
  localProblem,
  noContentResponse,
  successResponse,
} from './bff-response'
import { identityClient } from './identity-client'
import { readBoundedJson, RequestBodyError } from './request-body'
import { parseReportScheduleRequest } from './report-schedule-validation'

export async function reportScheduleHandler(request: NextRequest, id?: string) {
  const correlation = correlationIdFrom(request)
  const method = request.method
  const badRequest = () =>
    localProblem(
      400,
      'VALIDATION_FAILED',
      'Report schedule is invalid.',
      correlation,
    )
  if (method !== 'GET') {
    try {
      const origin = new URL(request.headers.get('origin') ?? '')
      if (
        origin.host !== request.headers.get('host') ||
        origin.protocol !== request.nextUrl.protocol
      )
        throw new Error()
    } catch {
      return localProblem(
        403,
        'FORBIDDEN',
        'Request origin is invalid.',
        correlation,
      )
    }
  }
  if (
    id &&
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  )
    return badRequest()
  const rawVersion = request.nextUrl.searchParams.get('expectedVersion')
  const version = Number(rawVersion)
  if (
    id &&
    (rawVersion === null ||
      !/^\d+$/.test(rawVersion) ||
      !Number.isSafeInteger(version))
  )
    return badRequest()
  let body
  if (method === 'POST' || method === 'PUT') {
    try {
      body = parseReportScheduleRequest(await readBoundedJson(request))
    } catch (cause) {
      if (cause instanceof RequestBodyError)
        return localProblem(
          cause.status,
          cause.code,
          cause.message,
          correlation,
        )
      return badRequest()
    }
    if (!body) return badRequest()
  }
  let actor
  try {
    actor = await authenticatedAdminActor(request, correlation)
  } catch (cause) {
    return adminAuthenticationFailure(cause, correlation)
  }
  try {
    if (method === 'GET')
      return carryAdminSession(
        successResponse(
          await identityClient.reportSchedules(actor.accessToken, correlation),
          correlation,
        ),
        actor,
      )
    if (method === 'POST' && body)
      return carryAdminSession(
        successResponse(
          await identityClient.createReportSchedule(
            actor.accessToken,
            body,
            correlation,
          ),
          correlation,
          201,
        ),
        actor,
      )
    if (method === 'PUT' && body && id)
      return carryAdminSession(
        successResponse(
          await identityClient.updateReportSchedule(
            actor.accessToken,
            id,
            version,
            body,
            correlation,
          ),
          correlation,
        ),
        actor,
      )
    if (method === 'DELETE' && id) {
      await identityClient.deleteReportSchedule(
        actor.accessToken,
        id,
        version,
        correlation,
      )
      return carryAdminSession(noContentResponse(correlation), actor)
    }
    return badRequest()
  } catch (cause) {
    return carryAdminSession(identityErrorResponse(cause, correlation), actor)
  }
}
