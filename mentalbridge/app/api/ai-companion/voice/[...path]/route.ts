import type { NextRequest } from 'next/server'
import { voiceBff } from '@/lib/companion/voice-bff'

type Context = { params: Promise<{ path: string[] }> }
export async function GET(request: NextRequest, context: Context) {
  return voiceBff(request, (await context.params).path)
}
export async function POST(request: NextRequest, context: Context) {
  return voiceBff(request, (await context.params).path)
}
