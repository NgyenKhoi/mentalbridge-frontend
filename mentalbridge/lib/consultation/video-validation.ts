import type { components } from '@/contracts/consultation.generated'
import { validUuid as validUuidString } from './consultation-validation'

export type VideoSession = components['schemas']['AppointmentVideoSession']
export type VideoAccess = components['schemas']['AppointmentVideoAccess']
export type VideoCompletion = components['schemas']['VideoCompletion']

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}
function validUuid(value: unknown): value is string {
  return typeof value === 'string' && validUuidString(value)
}
function instant(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
    Number.isFinite(Date.parse(value))
  )
}
function version(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}
function exact(item: Record<string, unknown>, keys: string[]) {
  return (
    Object.keys(item).length === keys.length &&
    keys.every((key) => Object.hasOwn(item, key))
  )
}
export function parseVideoCompletion(value: unknown): VideoCompletion | null {
  const item = record(value)
  if (
    !item ||
    !exact(item, [
      'appointmentId',
      'confirmationId',
      'verificationState',
      'appointmentStatus',
      'creditState',
      'completionFactId',
      'acceptedAt',
      'manualReviewAt',
      'version',
    ]) ||
    !validUuid(item.appointmentId) ||
    !validUuid(item.confirmationId) ||
    !instant(item.acceptedAt) ||
    !instant(item.manualReviewAt) ||
    !version(item.version)
  )
    return null
  if (
    Date.parse(item.manualReviewAt) - Date.parse(item.acceptedAt) !==
    86_400_000
  )
    return null
  if (item.verificationState === 'VERIFIED') {
    if (
      item.appointmentStatus !== 'COMPLETED' ||
      !validUuid(item.completionFactId) ||
      !['CONSUMED', 'AVAILABLE'].includes(String(item.creditState))
    )
      return null
  } else if (
    ['PENDING_VERIFICATION', 'EVIDENCE_REVIEW'].includes(
      String(item.verificationState),
    )
  ) {
    if (
      item.appointmentStatus !== 'SESSION_ENDED' ||
      item.creditState !== 'HELD' ||
      item.completionFactId !== null
    )
      return null
  } else return null
  return item as VideoCompletion
}
export function parseVideoSession(value: unknown): VideoSession | null {
  const item = record(value)
  if (
    !item ||
    !exact(item, [
      'appointmentId',
      'phase',
      'previewAllowed',
      'joinAllowed',
      'startsAt',
      'endsAt',
      'serverTime',
      'version',
      'completion',
    ]) ||
    !validUuid(item.appointmentId) ||
    !instant(item.startsAt) ||
    !instant(item.endsAt) ||
    !instant(item.serverTime) ||
    !version(item.version) ||
    ![
      'TOO_EARLY',
      'WAITING',
      'ACTIVE',
      'ENDED',
      'COMPLETED',
      'NOT_AVAILABLE',
      'UNAVAILABLE',
    ].includes(String(item.phase))
  )
    return null
  if (
    Date.parse(item.endsAt) - Date.parse(item.startsAt) !== 3_600_000 ||
    item.joinAllowed !== (item.phase === 'ACTIVE') ||
    item.previewAllowed !== ['WAITING', 'ACTIVE'].includes(String(item.phase))
  )
    return null
  const completion =
    item.completion === null ? null : parseVideoCompletion(item.completion)
  if (
    item.completion !== null &&
    (!completion ||
      completion.appointmentId !== item.appointmentId ||
      completion.version !== item.version ||
      (completion.verificationState === 'VERIFIED'
        ? item.phase !== 'COMPLETED'
        : item.phase !== 'ENDED'))
  )
    return null
  return item as VideoSession
}
export function parseVideoAccess(value: unknown): VideoAccess | null {
  const item = record(value)
  if (
    !item ||
    !exact(item, [
      'appointmentId',
      'provider',
      'serverUrl',
      'roomName',
      'participantToken',
      'expiresAt',
      'endsAt',
    ]) ||
    !validUuid(item.appointmentId) ||
    item.provider !== 'LIVEKIT' ||
    typeof item.serverUrl !== 'string' ||
    typeof item.roomName !== 'string' ||
    !/^mb-[0-9a-f-]{36}$/.test(item.roomName) ||
    typeof item.participantToken !== 'string' ||
    item.participantToken.length > 16_384 ||
    !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(
      item.participantToken,
    ) ||
    !instant(item.expiresAt) ||
    !instant(item.endsAt) ||
    Date.parse(item.expiresAt) > Date.parse(item.endsAt)
  )
    return null
  try {
    const url = new URL(item.serverUrl)
    if (
      url.protocol !== 'wss:' ||
      !/^[a-z0-9-]+\.livekit\.cloud$/.test(url.hostname) ||
      url.port ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== '/'
    )
      return null
  } catch {
    return null
  }
  return item as VideoAccess
}
