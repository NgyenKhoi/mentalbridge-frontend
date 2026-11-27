import type { NextRequest } from 'next/server'
import { supportPlanActionHandler } from '@/lib/care/support-plan-action-handlers'

export async function PUT(
  request: NextRequest,
  context: RouteContext<'/api/care/v2/support-plan-occurrences/[occurrenceId]/state'>,
) {
  const { occurrenceId } = await context.params
  return supportPlanActionHandler(request, 'occurrenceState', occurrenceId)
}
