import { existsSync } from 'node:fs'
import type { ExpoConfig } from 'expo/config'

// google-services.json is a Firebase secret: never committed, supplied by env or a local file.
export default ({ config }: { config: ExpoConfig }): ExpoConfig => ({
  ...config,
  android: {
    ...config.android,
    googleServicesFile:
      process.env.GOOGLE_SERVICES_JSON ??
      (existsSync('./google-services.json')
        ? './google-services.json'
        : undefined),
  },
})
