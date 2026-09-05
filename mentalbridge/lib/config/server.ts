import 'server-only'

const DEFAULT_IDENTITY_TIMEOUT_MS = 2_000
const DEFAULT_CARE_TIMEOUT_MS = 3_000
const DEFAULT_CONTENT_TIMEOUT_MS = 5_000
const MIN_IDENTITY_TIMEOUT_MS = 100
const MAX_IDENTITY_TIMEOUT_MS = 30_000

export type IdentityServerConfig = Readonly<{
  baseUrl: string
  timeoutMs: number
}>

export type CareServerConfig = Readonly<{
  baseUrl: string
  timeoutMs: number
  questionnaireLocale: string
}>

export type ContentServerConfig = Readonly<{
  baseUrl: string
  timeoutMs: number
}>

type Environment = Readonly<Record<string, string | undefined>>

function parseTimeout(
  name: string,
  value: string | undefined,
  fallback: number,
): number {
  if (value === undefined || value === '') return fallback

  const timeout = Number(value)

  if (
    !Number.isInteger(timeout) ||
    timeout < MIN_IDENTITY_TIMEOUT_MS ||
    timeout > MAX_IDENTITY_TIMEOUT_MS
  ) {
    throw new Error(
      `${name} must be an integer between ${MIN_IDENTITY_TIMEOUT_MS} and ${MAX_IDENTITY_TIMEOUT_MS}.`,
    )
  }

  return timeout
}

function parseBaseUrl(name: string, value: string | undefined) {
  if (!value) {
    throw new Error(`${name} is required.`)
  }

  let url: URL

  try {
    url = new URL(value)
  } catch {
    throw new Error(`${name} must be a valid absolute URL.`)
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`${name} must use HTTP or HTTPS.`)
  }

  if (url.username || url.password || url.search || url.hash) {
    throw new Error(
      `${name} must not contain credentials, query parameters, or a fragment.`,
    )
  }

  return `${url.toString().replace(/\/$/, '')}/`
}

export function readIdentityServerConfig(
  environment: Environment = process.env,
): IdentityServerConfig {
  return Object.freeze({
    baseUrl: parseBaseUrl(
      'IDENTITY_API_BASE_URL',
      environment.IDENTITY_API_BASE_URL,
    ),
    timeoutMs: parseTimeout(
      'IDENTITY_API_TIMEOUT_MS',
      environment.IDENTITY_API_TIMEOUT_MS,
      DEFAULT_IDENTITY_TIMEOUT_MS,
    ),
  })
}

export function readCareServerConfig(
  environment: Environment = process.env,
): CareServerConfig {
  const questionnaireLocale =
    environment.CARE_QUESTIONNAIRE_LOCALE?.trim() || 'vi-VN'

  if (!/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(questionnaireLocale)) {
    throw new Error('CARE_QUESTIONNAIRE_LOCALE must be a valid locale tag.')
  }

  return Object.freeze({
    baseUrl: parseBaseUrl('CARE_API_BASE_URL', environment.CARE_API_BASE_URL),
    timeoutMs: parseTimeout(
      'CARE_API_TIMEOUT_MS',
      environment.CARE_API_TIMEOUT_MS,
      DEFAULT_CARE_TIMEOUT_MS,
    ),
    questionnaireLocale,
  })
}

export function readContentServerConfig(
  environment: Environment = process.env,
): ContentServerConfig {
  return Object.freeze({
    baseUrl: parseBaseUrl(
      'CONTENT_SERVICE_URL',
      environment.CONTENT_SERVICE_URL,
    ),
    timeoutMs: parseTimeout(
      'CONTENT_SERVICE_TIMEOUT_MS',
      environment.CONTENT_SERVICE_TIMEOUT_MS,
      DEFAULT_CONTENT_TIMEOUT_MS,
    ),
  })
}
