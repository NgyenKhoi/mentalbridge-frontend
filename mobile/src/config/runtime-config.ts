import { z } from 'zod'

const runtimeEnvironmentSchema = z.object({
  EXPO_PUBLIC_API_BASE_URL: z
    .url('EXPO_PUBLIC_API_BASE_URL must be an absolute URL')
    .refine(
      (value) => value.startsWith('http://') || value.startsWith('https://'),
      {
        message: 'EXPO_PUBLIC_API_BASE_URL must use http or https',
      },
    )
    .transform((value) => value.replace(/\/$/, '')),
  EXPO_PUBLIC_API_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(100)
    .max(30_000)
    .default(5_000),
})

export type RuntimeConfig = Readonly<{
  apiBaseUrl: string
  apiTimeoutMs: number
}>

export function parseRuntimeConfig(
  environment: Readonly<Record<string, string | undefined>>,
): RuntimeConfig {
  const parsed = runtimeEnvironmentSchema.safeParse(environment)

  if (!parsed.success) {
    const keys = parsed.error.issues
      .map((issue) => issue.path.join('.'))
      .filter(Boolean)
      .join(', ')
    throw new Error(`Invalid public mobile runtime configuration: ${keys}`)
  }

  return {
    apiBaseUrl: parsed.data.EXPO_PUBLIC_API_BASE_URL,
    apiTimeoutMs: parsed.data.EXPO_PUBLIC_API_TIMEOUT_MS,
  }
}

export function readRuntimeConfig(): RuntimeConfig {
  return parseRuntimeConfig({
    EXPO_PUBLIC_API_BASE_URL: process.env.EXPO_PUBLIC_API_BASE_URL,
    EXPO_PUBLIC_API_TIMEOUT_MS: process.env.EXPO_PUBLIC_API_TIMEOUT_MS,
  })
}
