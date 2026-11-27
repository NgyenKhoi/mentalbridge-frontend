import type { NextRequest } from 'next/server'
import { supportPlanActionHandler } from '@/lib/care/support-plan-action-handlers'

export async function POST(
  request: NextRequest,
  context: RouteContext<'/api/care/v2/support-plans/[supportPlanId]/actions/[actionId]/companion-explanation'>,
) {
  const { supportPlanId, actionId } = await context.params
  return supportPlanActionHandler(
    request,
    'companionExplanation',
    supportPlanId,
    actionId,
  )
}
