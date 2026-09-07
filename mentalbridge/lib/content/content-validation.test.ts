import { describe, expect, it } from 'vitest'

import { parseResourceList } from './content-validation'

const publishedResource = {
  id: '30000000-0000-4000-8000-000000000001',
  category: 'ARTICLE',
  locale: 'vi-VN',
  title: 'Tài nguyên đã rà soát',
  summary: 'Nội dung tổng hợp dùng riêng cho kiểm thử.',
  externalUrl: 'https://example.test/resource',
  status: 'PUBLISHED',
  reviewedAt: '2026-08-01T00:00:00Z',
  createdAt: '2026-08-01T00:00:00Z',
  updatedAt: '2026-08-01T00:00:00Z',
}

describe('parseResourceList', () => {
  it('accepts reviewed published resources and the neutral fallback', () => {
    expect(
      parseResourceList({ data: [publishedResource], count: 1 }),
    ).not.toBeNull()
    expect(
      parseResourceList({
        data: [],
        count: 0,
        fallback: 'unavailable',
        message: 'Tài nguyên tạm thời không khả dụng.',
      }),
    ).not.toBeNull()
  })

  it.each(['DRAFT', 'ARCHIVED'])('rejects %s resources', (status) => {
    expect(
      parseResourceList({
        data: [{ ...publishedResource, status }],
        count: 1,
      }),
    ).toBeNull()
  })

  it('rejects unreviewed and malformed fallback responses', () => {
    expect(
      parseResourceList({
        data: [{ ...publishedResource, reviewedAt: null }],
        count: 1,
      }),
    ).toBeNull()
    expect(
      parseResourceList({
        data: [publishedResource],
        count: 1,
        fallback: 'unavailable',
      }),
    ).toBeNull()
  })
})
