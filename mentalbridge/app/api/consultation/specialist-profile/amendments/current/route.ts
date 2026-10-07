import type { NextRequest } from 'next/server'
import { profileAmendmentRoute } from '@/lib/consultation/profile-amendment-route'

export async function GET(request: NextRequest) {
  return profileAmendmentRoute(request, 'current')
}
