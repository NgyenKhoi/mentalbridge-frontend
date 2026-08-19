import type { components } from '@/contracts/identity.generated'

export type ProblemDetails = components['schemas']['Problem']

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isViolation(value: unknown): boolean {
  if (!isRecord(value)) return false

  return (
    typeof value.field === 'string' &&
    typeof value.code === 'string' &&
    (value.message === undefined || typeof value.message === 'string')
  )
}

export function isProblemDetails(value: unknown): value is ProblemDetails {
  if (!isRecord(value)) return false

  const violationsAreValid =
    value.violations === undefined ||
    (Array.isArray(value.violations) && value.violations.every(isViolation))

  return (
    typeof value.type === 'string' &&
    typeof value.title === 'string' &&
    typeof value.status === 'number' &&
    Number.isInteger(value.status) &&
    value.status >= 400 &&
    value.status <= 599 &&
    typeof value.code === 'string' &&
    typeof value.correlationId === 'string' &&
    (value.detail === undefined || typeof value.detail === 'string') &&
    (value.instance === undefined || typeof value.instance === 'string') &&
    violationsAreValid
  )
}
