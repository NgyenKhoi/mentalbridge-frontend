import type { NextRequest } from 'next/server'
import { reportScheduleHandler } from '@/lib/auth/report-schedule-bff'

type Context = { params: Promise<{ scheduleId: string }> }
export async function PUT(request: NextRequest, context: Context) {
  return reportScheduleHandler(request, (await context.params).scheduleId)
}
export async function DELETE(request: NextRequest, context: Context) {
  return reportScheduleHandler(request, (await context.params).scheduleId)
}
