import type { NextRequest } from 'next/server'
import { supportPlanActionHandler } from '@/lib/care/support-plan-action-handlers'

type Context = Readonly<{ params: Promise<{ occurrenceId: string }> }>

export async function POST(request: NextRequest, context: Context) {
  const { occurrenceId } = await context.params
  return supportPlanActionHandler(request, 'reconcileResource', occurrenceId)
}
