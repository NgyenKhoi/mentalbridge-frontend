import type { NextRequest } from 'next/server'
import { profileAmendmentRoute } from '@/lib/consultation/profile-amendment-route'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ amendmentId: string }> },
) {
  return profileAmendmentRoute(
    request,
    'approve',
    (await context.params).amendmentId,
  )
}
