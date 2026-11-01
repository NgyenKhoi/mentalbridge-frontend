import { ApiError } from '@/api/api-error'

import type { OpenAppointmentDispute } from './appointment-dispute-contract'

export type AppointmentDisputeCommand = Readonly<{
  appointmentId: string
  body: OpenAppointmentDispute
  key: string
}>

// In-memory correlation only. Retain the exact actor/appointment/body/key across
// remounts after an ambiguous response; never queue or replay automatically.
const pending = new Map<string, AppointmentDisputeCommand>()

export const appointmentDisputeCommands = {
  read: (scope: string) => pending.get(scope) ?? null,
  write: (scope: string, command: AppointmentDisputeCommand) =>
    pending.set(scope, command),
  remove: (scope: string) => pending.delete(scope),
  clear: () => pending.clear(),
}

export function ambiguousDisputeFailure(error: unknown) {
  if (!(error instanceof ApiError)) return true
  return (
    error.status === undefined ||
    error.status === 0 ||
    error.status === 408 ||
    error.status >= 500
  )
}
