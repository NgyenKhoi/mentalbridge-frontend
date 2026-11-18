import type { NextRequest } from 'next/server'
import { proxyBenchmark } from '@/lib/benchmarks/benchmark-route'

type Context = { params: Promise<{ segments: string[] }> }

export async function GET(request: NextRequest, context: Context) {
  return proxyBenchmark(request, 'GET', (await context.params).segments)
}

export async function POST(request: NextRequest, context: Context) {
  return proxyBenchmark(request, 'POST', (await context.params).segments)
}
