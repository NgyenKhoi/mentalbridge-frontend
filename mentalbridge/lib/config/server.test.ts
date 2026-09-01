import { describe, expect, it } from 'vitest'

import { readCareServerConfig, readIdentityServerConfig } from './server'

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

describe('readCareServerConfig', () => {
  it('keeps the Care endpoint and locale server-only and normalized', () => {
    expect(
      readCareServerConfig({
        CARE_API_BASE_URL: 'http://care:8081/gateway',
        CARE_API_TIMEOUT_MS: '2500',
        CARE_QUESTIONNAIRE_LOCALE: 'vi-VN',
      }),
    ).toEqual({
      baseUrl: 'http://care:8081/gateway/',
      timeoutMs: 2500,
      questionnaireLocale: 'vi-VN',
    })
  })

  it('defaults to the product locale and a bounded timeout', () => {
    expect(
      readCareServerConfig({ CARE_API_BASE_URL: 'http://care:8081' }),
    ).toEqual({
      baseUrl: 'http://care:8081/',
      timeoutMs: 3000,
      questionnaireLocale: 'vi-VN',
    })
  })

  it.each([
    [{}, 'CARE_API_BASE_URL is required.'],
    [
      { CARE_API_BASE_URL: 'http://care:8081', CARE_API_TIMEOUT_MS: '45000' },
      'CARE_API_TIMEOUT_MS must be an integer',
    ],
    [
      {
        CARE_API_BASE_URL: 'http://care:8081',
        CARE_QUESTIONNAIRE_LOCALE: '../secret',
      },
      'CARE_QUESTIONNAIRE_LOCALE must be a valid locale tag.',
    ],
  ])('rejects invalid Care configuration', (environment, message) => {
    expect(() => readCareServerConfig(environment)).toThrow(message)
  })
})
