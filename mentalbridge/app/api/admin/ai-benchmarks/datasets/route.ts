import type { NextRequest } from 'next/server'
import { proxyBenchmark } from '@/lib/benchmarks/benchmark-route'

export const GET = (request: NextRequest) =>
  proxyBenchmark(request, 'GET', ['datasets'])
export const POST = (request: NextRequest) =>
  proxyBenchmark(request, 'POST', ['datasets'])
