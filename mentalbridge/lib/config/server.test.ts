import { describe, it, expect } from 'vitest'
import {
  readIdentityServerConfig,
  readCareServerConfig,
  readContentServerConfig,
} from './server'

describe('readIdentityServerConfig', () => {
  it('should parse valid configuration', () => {
    const config = readIdentityServerConfig({
      IDENTITY_API_BASE_URL: 'http://localhost:8080',
      IDENTITY_API_TIMEOUT_MS: '3000',
    })

    expect(config.baseUrl).toBe('http://localhost:8080/')
    expect(config.timeoutMs).toBe(3000)
  })

  it('should use default timeout when not specified', () => {
    const config = readIdentityServerConfig({
      IDENTITY_API_BASE_URL: 'http://localhost:8080',
    })

    expect(config.timeoutMs).toBe(2000)
  })

  it('should throw when baseUrl is missing', () => {
    expect(() => readIdentityServerConfig({})).toThrow(
      'IDENTITY_API_BASE_URL is required',
    )
  })

  it('should throw when baseUrl is invalid', () => {
    expect(() =>
      readIdentityServerConfig({ IDENTITY_API_BASE_URL: 'not-a-url' }),
    ).toThrow('must be a valid absolute URL')
  })

  it('should throw when timeout is out of bounds', () => {
    expect(() =>
      readIdentityServerConfig({
        IDENTITY_API_BASE_URL: 'http://localhost:8080',
        IDENTITY_API_TIMEOUT_MS: '50',
      }),
    ).toThrow('must be an integer between')
  })

  it('should normalize baseUrl by removing trailing slash if present', () => {
    const config = readIdentityServerConfig({
      IDENTITY_API_BASE_URL: 'http://localhost:8080/',
    })

    expect(config.baseUrl).toBe('http://localhost:8080/')
  })

  it('should reject baseUrl with credentials', () => {
    expect(() =>
      readIdentityServerConfig({
        IDENTITY_API_BASE_URL: 'http://user:pass@localhost:8080',
      }),
    ).toThrow('must not contain credentials')
  })

  it('should reject baseUrl with query parameters', () => {
    expect(() =>
      readIdentityServerConfig({
        IDENTITY_API_BASE_URL: 'http://localhost:8080?query=value',
      }),
    ).toThrow('must not contain credentials, query parameters, or a fragment')
  })
})

describe('readCareServerConfig', () => {
  it('should parse valid configuration', () => {
    const config = readCareServerConfig({
      CARE_API_BASE_URL: 'http://localhost:8081',
      CARE_API_TIMEOUT_MS: '5000',
      CARE_QUESTIONNAIRE_LOCALE: 'en-US',
    })

    expect(config.baseUrl).toBe('http://localhost:8081/')
    expect(config.timeoutMs).toBe(5000)
    expect(config.questionnaireLocale).toBe('en-US')
  })

  it('should use default values when optional fields not specified', () => {
    const config = readCareServerConfig({
      CARE_API_BASE_URL: 'http://localhost:8081',
    })

    expect(config.timeoutMs).toBe(3000)
    expect(config.questionnaireLocale).toBe('vi-VN')
  })

  it('should throw when baseUrl is missing', () => {
    expect(() => readCareServerConfig({})).toThrow('CARE_API_BASE_URL is required')
  })

  it('should throw when locale is invalid', () => {
    expect(() =>
      readCareServerConfig({
        CARE_API_BASE_URL: 'http://localhost:8081',
        CARE_QUESTIONNAIRE_LOCALE: 'invalid_locale',
      }),
    ).toThrow('must be a valid locale tag')
  })
})

describe('readContentServerConfig', () => {
  it('should parse valid configuration', () => {
    const config = readContentServerConfig({
      CONTENT_SERVICE_URL: 'http://localhost:3003',
      CONTENT_SERVICE_TIMEOUT_MS: '5000',
    })

    expect(config.baseUrl).toBe('http://localhost:3003/')
    expect(config.timeoutMs).toBe(5000)
  })

  it('should use default timeout when not specified', () => {
    const config = readContentServerConfig({
      CONTENT_SERVICE_URL: 'http://localhost:3003',
    })

    expect(config.timeoutMs).toBe(5000)
  })

  it('should throw when baseUrl is missing', () => {
    expect(() => readContentServerConfig({})).toThrow(
      'CONTENT_SERVICE_URL is required',
    )
  })

  it('should throw when baseUrl is invalid', () => {
    expect(() =>
      readContentServerConfig({ CONTENT_SERVICE_URL: 'not-a-url' }),
    ).toThrow('must be a valid absolute URL')
  })

  it('should throw when timeout is out of bounds', () => {
    expect(() =>
      readContentServerConfig({
        CONTENT_SERVICE_URL: 'http://localhost:3003',
        CONTENT_SERVICE_TIMEOUT_MS: '50000',
      }),
    ).toThrow('must be an integer between')
  })

  it('should normalize baseUrl by adding trailing slash', () => {
    const config = readContentServerConfig({
      CONTENT_SERVICE_URL: 'http://localhost:3003',
    })

    expect(config.baseUrl).toBe('http://localhost:3003/')
  })

  it('should reject baseUrl with credentials', () => {
    expect(() =>
      readContentServerConfig({
        CONTENT_SERVICE_URL: 'http://user:pass@localhost:3003',
      }),
    ).toThrow('must not contain credentials')
  })

  it('should reject baseUrl with query parameters', () => {
    expect(() =>
      readContentServerConfig({
        CONTENT_SERVICE_URL: 'http://localhost:3003?query=value',
      }),
    ).toThrow('must not contain credentials, query parameters, or a fragment')
  })

  it('should reject baseUrl with fragment', () => {
    expect(() =>
      readContentServerConfig({
        CONTENT_SERVICE_URL: 'http://localhost:3003#fragment',
      }),
    ).toThrow('must not contain credentials, query parameters, or a fragment')
  })

  it('should accept https protocol', () => {
    const config = readContentServerConfig({
      CONTENT_SERVICE_URL: 'https://content.example.com',
    })

    expect(config.baseUrl).toBe('https://content.example.com/')
  })

  it('should reject non-http/https protocols', () => {
    expect(() =>
      readContentServerConfig({
        CONTENT_SERVICE_URL: 'ftp://localhost:3003',
      }),
    ).toThrow('must use HTTP or HTTPS')
  })
})
