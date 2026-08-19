import { describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'

import { ACCESS_COOKIE_NAME } from '@/lib/auth/session-cookies'

import { proxy } from './proxy'

describe('proxy', () => {
  it('optimistically redirects anonymous protected-route access', () => {
    const response = proxy(
      new NextRequest('https://mentalbridge.test/dashboard?tab=today'),
    )

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      'https://mentalbridge.test/login?next=%2Fdashboard%3Ftab%3Dtoday',
    )
  })

  it('allows a request with a session hint without treating it as authorization', () => {
    const response = proxy(
      new NextRequest('https://mentalbridge.test/dashboard', {
        headers: { Cookie: `${ACCESS_COOKIE_NAME}=opaque` },
      }),
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('x-middleware-next')).toBe('1')
  })
})
