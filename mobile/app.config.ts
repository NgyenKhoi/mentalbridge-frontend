import { existsSync } from 'node:fs'
import type { ExpoConfig } from 'expo/config'

export default ({ config }: { config: ExpoConfig }): ExpoConfig => {
  const googleServicesFile =
    process.env.GOOGLE_SERVICES_JSON ??
    (existsSync('./google-services.json')
      ? './google-services.json'
      : undefined)
  const development = process.env.APP_VARIANT === 'development'
  return {
    ...config,
    ...(development
      ? { name: 'MentalBridge Dev', scheme: 'mentalbridge-dev' }
      : {}),
    android: {
      ...config.android,
      ...(googleServicesFile ? { googleServicesFile } : {}),
      ...(development ? { package: 'com.mentalbridge.mobile.dev' } : {}),
    },
    ios: {
      ...config.ios,
      ...(development
        ? { bundleIdentifier: 'com.mentalbridge.mobile.dev' }
        : {}),
    },
    plugins: [
      ...(config.plugins ?? []),
      ...(development ? ['./plugins/with-development-network'] : []),
    ],
  }
}
