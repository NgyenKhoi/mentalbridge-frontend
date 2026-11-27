import type { NextRequest } from 'next/server'
import { profileAmendmentRoute } from '@/lib/consultation/profile-amendment-route'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ amendmentId: string }> },
) {
  return profileAmendmentRoute(
    request,
    'detail',
    (await context.params).amendmentId,
  )
}
