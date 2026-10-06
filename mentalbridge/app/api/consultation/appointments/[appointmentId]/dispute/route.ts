import type { NextRequest } from 'next/server'
import {
  openParticipantDispute,
  readParticipantDispute,
} from '@/lib/consultation/appointment-dispute-bff'

type Context =
  RouteContext<'/api/consultation/appointments/[appointmentId]/dispute'>

export async function GET(request: NextRequest, context: Context) {
  const { appointmentId } = await context.params
  return readParticipantDispute(request, appointmentId, 'USER')
}

export async function POST(request: NextRequest, context: Context) {
  const { appointmentId } = await context.params
  return openParticipantDispute(request, appointmentId, 'USER')
}
