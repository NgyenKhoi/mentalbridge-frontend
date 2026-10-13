import type { NextRequest } from 'next/server'
import { supportPlanActionHandler } from '@/lib/care/support-plan-action-handlers'

export async function POST(request: NextRequest) {
  return supportPlanActionHandler(request, 'propose')
}
