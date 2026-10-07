import type { NextRequest } from 'next/server'
import { profileAmendmentRoute } from '@/lib/consultation/profile-amendment-route'

export async function POST(request: NextRequest) {
  return profileAmendmentRoute(request, 'start')
}
