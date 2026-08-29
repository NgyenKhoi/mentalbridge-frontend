import { describe, expect, it } from 'vitest'

import { readIdentityServerConfig } from './server'

describe('readIdentityServerConfig', () => {
  it('validates and normalizes the server-only Identity configuration', () => {
    expect(
      readIdentityServerConfig({
        IDENTITY_API_BASE_URL: 'https://identity.example.test/gateway',
        IDENTITY_API_TIMEOUT_MS: '1750',
      }),
    ).toEqual({
      baseUrl: 'https://identity.example.test/gateway/',
      timeoutMs: 1750,
    })
  })

  it('uses a bounded timeout default', () => {
    expect(
      readIdentityServerConfig({
        IDENTITY_API_BASE_URL: 'http://identity:8080',
      }).timeoutMs,
    ).toBe(2000)
  })

  it.each([
    [{}, 'IDENTITY_API_BASE_URL is required.'],
    [
      { IDENTITY_API_BASE_URL: 'identity-service' },
      'IDENTITY_API_BASE_URL must be a valid absolute URL.',
    ],
    [
      { IDENTITY_API_BASE_URL: 'file:///identity' },
      'IDENTITY_API_BASE_URL must use HTTP or HTTPS.',
    ],
    [
      { IDENTITY_API_BASE_URL: 'https://user:secret@identity.test' },
      'IDENTITY_API_BASE_URL must not contain credentials',
    ],
    [
      {
        IDENTITY_API_BASE_URL: 'https://identity.test',
        IDENTITY_API_TIMEOUT_MS: '0',
      },
      'IDENTITY_API_TIMEOUT_MS must be an integer',
    ],
  ])('rejects unsafe or invalid configuration', (environment, message) => {
    expect(() => readIdentityServerConfig(environment)).toThrow(message)
  })
})
