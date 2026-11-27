import type { NextRequest } from 'next/server'
import { supportPlanActionHandler } from '@/lib/care/support-plan-action-handlers'

export async function GET(request: NextRequest) {
  return supportPlanActionHandler(request, 'resourceActions')
}
