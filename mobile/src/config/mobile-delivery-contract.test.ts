import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { z } from 'zod'

const mobileRoot = resolve(__dirname, '../..')

function readJson(relativePath: string): unknown {
  return JSON.parse(readFileSync(resolve(mobileRoot, relativePath), 'utf8'))
}

describe('Mobile Delivery Contract v1', () => {
  it('freezes the shared app identity and verification-link scheme', () => {
    const appConfig = z
      .object({
        expo: z.object({
          name: z.literal('MentalBridge'),
          slug: z.literal('mentalbridge-mobile'),
          scheme: z.literal('mentalbridge'),
          android: z.object({
            package: z.literal('com.mentalbridge.mobile'),
          }),
          ios: z.object({
            bundleIdentifier: z.literal('com.mentalbridge.mobile'),
          }),
        }),
      })
      .parse(readJson('app.json'))

    expect(appConfig.expo).toMatchObject({
      name: 'MentalBridge',
      slug: 'mentalbridge-mobile',
      scheme: 'mentalbridge',
      android: { package: 'com.mentalbridge.mobile' },
      ios: { bundleIdentifier: 'com.mentalbridge.mobile' },
    })
  })

  it('pins the agreed SDK and JavaScript toolchain baseline', () => {
    const packageConfig = z
      .object({
        main: z.literal('expo-router/entry'),
        engines: z.object({ node: z.literal('>=22.13.0') }),
        dependencies: z.object({
          expo: z.literal('~57.0.26'),
          'expo-router': z.literal('~57.0.24'),
          react: z.literal('19.2.3'),
          'react-native': z.literal('0.86.3'),
        }),
        devDependencies: z.object({
          typescript: z.literal('~6.0.3'),
        }),
      })
      .parse(readJson('package.json'))

    expect(packageConfig.engines.node).toBe('>=22.13.0')
  })

  it('exposes one public API edge and no secret-shaped public setting', () => {
    const example = readFileSync(resolve(mobileRoot, '.env.example'), 'utf8')
    const publicKeys = example
      .split(/\r?\n/)
      .map((line) => line.match(/^(EXPO_PUBLIC_[A-Z0-9_]+)=/)?.[1])
      .filter((key): key is string => Boolean(key))

    expect(publicKeys).toEqual([
      'EXPO_PUBLIC_API_BASE_URL',
      'EXPO_PUBLIC_API_TIMEOUT_MS',
    ])
    expect(publicKeys.join(' ')).not.toMatch(
      /SECRET|TOKEN|PASSWORD|CREDENTIAL|PRIVATE_KEY/,
    )
  })
})
