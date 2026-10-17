import type { NextRequest } from 'next/server'
import { adminProfileDecision } from '@/lib/consultation/admin-profile-decision'

type Context = { params: Promise<{ specialistId: string }> }

export async function POST(request: NextRequest, context: Context) {
  return adminProfileDecision(request, context, 'SUSPEND')
}
