import { describe, expect, it } from 'vitest'

import { parseResourceSummary } from './content-validation'

const requiredSummary = {
  id: '123e4567-e89b-42d3-a456-426614174000',
  category: 'ARTICLE',
  locale: 'vi-VN',
  title: 'Grounding guide',
  summary: 'A short grounding exercise.',
  status: 'DRAFT',
  createdAt: '2026-09-12T00:00:00Z',
}

describe('Content response validation', () => {
  it('accepts a ResourceSummary containing only OpenAPI-required fields', () => {
    expect(parseResourceSummary(requiredSummary)).toEqual(requiredSummary)
  })

  it('validates optional ResourceSummary fields when the provider includes them', () => {
    expect(
      parseResourceSummary({
        ...requiredSummary,
        externalUrl: 'javascript:alert(1)',
      }),
    ).toBeNull()
    expect(
      parseResourceSummary({ ...requiredSummary, reviewedAt: 'not-a-date' }),
    ).toBeNull()
    expect(
      parseResourceSummary({ ...requiredSummary, updatedAt: 'not-a-date' }),
    ).toBeNull()
  })
})
