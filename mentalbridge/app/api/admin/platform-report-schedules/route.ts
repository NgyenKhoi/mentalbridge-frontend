import type { NextRequest } from 'next/server'
import { reportScheduleHandler } from '@/lib/auth/report-schedule-bff'

export function GET(request: NextRequest) {
  return reportScheduleHandler(request)
}
export function POST(request: NextRequest) {
  return reportScheduleHandler(request)
}
