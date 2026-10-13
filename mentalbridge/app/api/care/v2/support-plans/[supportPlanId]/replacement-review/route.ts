import type { NextRequest } from 'next/server'
import { supportPlanActionHandler } from '@/lib/care/support-plan-action-handlers'

export async function POST(
  request: NextRequest,
  context: RouteContext<'/api/care/v2/support-plans/[supportPlanId]/replacement-review'>,
) {
  const { supportPlanId } = await context.params
  return supportPlanActionHandler(request, 'review', supportPlanId)
}
