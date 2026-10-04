import { parseRuntimeConfig } from './runtime-config'

describe('mobile runtime configuration', () => {
  it('parses the required public edge URL and bounded timeout', () => {
    expect(
      parseRuntimeConfig({
        EXPO_PUBLIC_API_BASE_URL: 'https://api.test.mentalbridge/',
        EXPO_PUBLIC_API_TIMEOUT_MS: '2500',
      }),
    ).toEqual({
      apiBaseUrl: 'https://api.test.mentalbridge',
      apiTimeoutMs: 2500,
    })
  })

  it('fails clearly when required public configuration is missing', () => {
    expect(() => parseRuntimeConfig({})).toThrow(
      'Invalid public mobile runtime configuration: EXPO_PUBLIC_API_BASE_URL',
    )
  })

  it('rejects unsupported protocols and unbounded timeouts', () => {
    expect(() =>
      parseRuntimeConfig({
        EXPO_PUBLIC_API_BASE_URL: 'file:///private/service',
        EXPO_PUBLIC_API_TIMEOUT_MS: '60000',
      }),
    ).toThrow('Invalid public mobile runtime configuration')
  })
})
