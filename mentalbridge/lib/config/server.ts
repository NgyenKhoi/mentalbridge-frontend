import 'server-only'

const DEFAULT_IDENTITY_TIMEOUT_MS = 2_000
const MIN_IDENTITY_TIMEOUT_MS = 100
const MAX_IDENTITY_TIMEOUT_MS = 30_000

export type IdentityServerConfig = Readonly<{
  baseUrl: string
  timeoutMs: number
}>

type Environment = Readonly<Record<string, string | undefined>>

function parseTimeout(value: string | undefined): number {
  if (value === undefined || value === '') return DEFAULT_IDENTITY_TIMEOUT_MS

  const timeout = Number(value)

  if (
    !Number.isInteger(timeout) ||
    timeout < MIN_IDENTITY_TIMEOUT_MS ||
    timeout > MAX_IDENTITY_TIMEOUT_MS
  ) {
    throw new Error(
      `IDENTITY_API_TIMEOUT_MS must be an integer between ${MIN_IDENTITY_TIMEOUT_MS} and ${MAX_IDENTITY_TIMEOUT_MS}.`,
    )
  }

  return timeout
}

function parseBaseUrl(value: string | undefined) {
  if (!value) {
    throw new Error('IDENTITY_API_BASE_URL is required.')
  }

  let url: URL

  try {
    url = new URL(value)
  } catch {
    throw new Error('IDENTITY_API_BASE_URL must be a valid absolute URL.')
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('IDENTITY_API_BASE_URL must use HTTP or HTTPS.')
  }

  if (url.username || url.password || url.search || url.hash) {
    throw new Error(
      'IDENTITY_API_BASE_URL must not contain credentials, query parameters, or a fragment.',
    )
  }

  return `${url.toString().replace(/\/$/, '')}/`
}

export function readIdentityServerConfig(
  environment: Environment = process.env,
): IdentityServerConfig {
  return Object.freeze({
    baseUrl: parseBaseUrl(environment.IDENTITY_API_BASE_URL),
    timeoutMs: parseTimeout(environment.IDENTITY_API_TIMEOUT_MS),
  })
}
