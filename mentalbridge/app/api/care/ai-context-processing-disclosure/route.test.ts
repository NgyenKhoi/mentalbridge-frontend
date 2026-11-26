import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const careMocks = vi.hoisted(() => ({
  currentAiContextProcessingDisclosure: vi.fn(),
}))
vi.mock('@/lib/care/care-client', () => ({ careClient: careMocks }))

import { GET } from './route'

const disclosure = {
  consentType: 'AI_CONTEXT_PROCESSING',
  version: 'ai-context-processing-capstone-v1',
  locale: 'vi-VN',
  title: 'AI dùng bối cảnh',
  content:
    'MentalBridge dùng AI để xử lý các nguồn dữ liệu cá nhân đã được cho phép.',
  capstoneOnly: true,
}

const request = () =>
  new NextRequest('http://localhost/api/care/ai-context-processing-disclosure')

describe('AI context processing disclosure BFF', () => {
  beforeEach(() => careMocks.currentAiContextProcessingDisclosure.mockReset())

  it('returns the current L2 notice', async () => {
    careMocks.currentAiContextProcessingDisclosure.mockResolvedValue(disclosure)
    const response = await GET(request())
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(disclosure)
  })
})
