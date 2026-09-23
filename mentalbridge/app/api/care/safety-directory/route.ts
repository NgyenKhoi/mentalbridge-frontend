import type { NextRequest } from 'next/server'

import type { SafetyDirectoryTrigger } from '@/features/assessment/api/care-contract'
import { correlationIdFrom } from '@/lib/auth/bff-response'
import { readBoundedJson, RequestBodyError } from '@/lib/auth/request-body'
import {
  careErrorResponse,
  careSuccessResponse,
  localProblem,
} from '@/lib/care/bff-response'
import { careClient } from '@/lib/care/care-client'

const LOCATION_PATTERN = /^[^\u0000-\u001f\u007f]+$/

function parseRequest(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const body = value as Record<string, unknown>
  const trigger = body.trigger
  if (trigger !== 'HELP_NOW' && trigger !== 'POSITIVE_ITEM_9') return null

  const fields = ['provinceCode', 'districtCode', 'manualLocation'] as const
  for (const field of fields) {
    if (body[field] !== undefined) {
      if (
        typeof body[field] !== 'string' ||
        body[field].trim().length === 0 ||
        body[field].trim().length > (field === 'manualLocation' ? 120 : 32) ||
        !LOCATION_PATTERN.test(body[field].trim())
      )
        return null
    }
  }

  const selected = typeof body.provinceCode === 'string'
  const manual = typeof body.manualLocation === 'string'
  if (selected === manual || (body.districtCode !== undefined && !selected)) {
    return null
  }
  return {
    trigger: trigger as SafetyDirectoryTrigger,
    ...(selected ? { provinceCode: body.provinceCode as string } : {}),
    ...(body.districtCode !== undefined
      ? { districtCode: body.districtCode as string }
      : {}),
    ...(manual ? { manualLocation: body.manualLocation as string } : {}),
  }
}

export async function POST(request: NextRequest) {
  const correlationId = correlationIdFrom(request)
  try {
    const parsed = parseRequest(await readBoundedJson(request))
    if (!parsed) {
      return localProblem(
        400,
        'VALIDATION_FAILED',
        'Request validation failed.',
        correlationId,
      )
    }
    return careSuccessResponse(
      await careClient.lookupSafetyDirectory(parsed, correlationId),
      correlationId,
    )
  } catch (error) {
    if (error instanceof RequestBodyError) {
      return careErrorResponse(error, correlationId)
    }
    return careErrorResponse(error, correlationId)
  }
}
