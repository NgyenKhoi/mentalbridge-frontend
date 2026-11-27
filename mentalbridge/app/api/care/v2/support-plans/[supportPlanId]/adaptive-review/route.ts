import type { NextRequest } from 'next/server'
import { supportPlanActionHandler } from '@/lib/care/support-plan-action-handlers'

export async function GET(
  request: NextRequest,
  context: RouteContext<'/api/care/v2/support-plans/[supportPlanId]/adaptive-review'>,
) {
  const { supportPlanId } = await context.params
  return supportPlanActionHandler(request, 'adaptiveReview', supportPlanId)
}
