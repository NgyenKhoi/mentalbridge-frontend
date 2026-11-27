import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const nav = vi.hoisted(() => ({
  query: '',
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT ${path}`)
  }),
}))
vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  useSearchParams: () => new URLSearchParams(nav.query),
  redirect: nav.redirect,
}))

import AssessmentsPage from './page'

describe('old reassessment tab links', () => {
  beforeEach(() => {
    nav.redirect.mockClear()
  })

  it.each([
    'tab=reassessment',
    'tab=review',
    'tab=reassessment&returnTo=plan-review',
  ])('send %s to the look-back', (query) => {
    nav.query = query
    expect(() => render(<AssessmentsPage />)).toThrow('NEXT_REDIRECT')
    expect(nav.redirect).toHaveBeenCalledWith('/nhin-lai')
  })

  it('keeps the history tab for any other link', () => {
    nav.query = ''
    render(<AssessmentsPage />)
    expect(nav.redirect).not.toHaveBeenCalled()
  })
})
