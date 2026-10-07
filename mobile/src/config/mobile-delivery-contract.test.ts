import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { z } from 'zod'

const mobileRoot = resolve(__dirname, '../..')
const repositoryRoot = resolve(mobileRoot, '..')

function readJson(relativePath: string): unknown {
  return JSON.parse(readFileSync(resolve(mobileRoot, relativePath), 'utf8'))
}

function workflowJob(workflow: string, jobName: string): string {
  const lines = workflow.split(/\r?\n/)
  const start = lines.findIndex((line) => line === `  ${jobName}:`)
  if (start < 0) throw new Error(`Workflow job ${jobName} is missing`)

  const relativeEnd = lines
    .slice(start + 1)
    .findIndex((line) => /^  [A-Za-z0-9_-]+:$/.test(line))
  const end = relativeEnd < 0 ? lines.length : start + 1 + relativeEnd
  return lines.slice(start, end).join('\n')
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
        packageManager: z.literal('npm@10.9.2'),
        engines: z.object({
          node: z.literal('22.13.0'),
          npm: z.literal('10.9.2'),
        }),
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

    expect(packageConfig.engines).toEqual({
      node: '22.13.0',
      npm: '10.9.2',
    })
  })

  it('pins native staging runners and their selected toolchains', () => {
    const stagingWorkflow = readFileSync(
      resolve(repositoryRoot, '.github/workflows/staging-quality.yml'),
      'utf8',
    )
    const developmentWorkflow = readFileSync(
      resolve(repositoryRoot, '.github/workflows/frontend-quality.yml'),
      'utf8',
    )
    const mobileCompile = workflowJob(developmentWorkflow, 'mobile-compile')
    const mobileQuality = workflowJob(stagingWorkflow, 'mobile-release-quality')
    const android = workflowJob(stagingWorkflow, 'mobile-android-smoke')
    const ios = workflowJob(stagingWorkflow, 'mobile-ios-smoke')

    expect(mobileCompile).toContain('runs-on: ubuntu-24.04')
    expect(mobileCompile).toContain("node-version: '22.13.0'")
    expect(mobileQuality).toContain('runs-on: ubuntu-24.04')
    expect(mobileQuality).toContain("node-version: '22.13.0'")

    expect(android).toContain('runs-on: ubuntu-24.04')
    expect(android).toContain("node-version: '22.13.0'")
    expect(android).toContain('distribution: temurin')
    expect(android).toContain("java-version: '17.0.20+8'")
    expect(android).toContain('api-level: 36')
    expect(android).toContain('arch: x86_64')
    expect(android).toContain('target: google_apis')
    expect(android).toContain('profile: pixel_6')
    expect(android).toContain(
      'reactivecircus/android-emulator-runner@a421e43855164a8197daf9d8d40fe71c6996bb0d',
    )
    expect(android).toContain('environment: staging-mobile-e2e')
    expect(android).toContain(
      'EXPO_PUBLIC_API_BASE_URL: ${{ secrets.MOBILE_STAGING_API_BASE_URL }}',
    )
    expect(android).toContain("MAESTRO_VERSION: '2.11.0'")
    expect(android).toContain(
      'npm run native:android:smoke && npm run e2e:android:assessment && npm run e2e:android:emotion && npm run e2e:android:resources',
    )
    expect(android).toContain(
      'MAESTRO_MB_USER_EMAIL: ${{ secrets.MB_USER_EMAIL }}',
    )
    expect(android).toContain(
      'MAESTRO_MB_USER_PASSWORD: ${{ secrets.MB_USER_PASSWORD }}',
    )

    expect(ios).toContain('runs-on: macos-26')
    expect(ios).toContain("node-version: '22.13.0'")
    expect(ios).toContain("XCODE_VERSION: '26.4.1'")
    expect(ios).toContain('XCODE_BUILD: 17E202')
    expect(ios).toContain(
      'XCODE_DEVELOPER_DIR: /Applications/Xcode_26.4.1.app/Contents/Developer',
    )
    expect(ios).toContain(
      'IOS_RUNTIME_ID: com.apple.CoreSimulator.SimRuntime.iOS-26-4',
    )
    expect(ios).toContain("IOS_RUNTIME_VERSION: '26.4.1'")
    expect(ios).toContain('IOS_DEVICE_NAME: iPhone 17')
    expect(ios).toContain('xcode-select --switch "$XCODE_DEVELOPER_DIR"')
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
