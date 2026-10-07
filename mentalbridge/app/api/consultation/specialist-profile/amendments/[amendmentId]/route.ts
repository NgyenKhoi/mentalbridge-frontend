import type { NextRequest } from 'next/server'
import { profileAmendmentRoute } from '@/lib/consultation/profile-amendment-route'

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ amendmentId: string }> },
) {
  return profileAmendmentRoute(
    request,
    'save',
    (await context.params).amendmentId,
  )
}
