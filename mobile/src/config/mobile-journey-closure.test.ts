import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const mobileRoot = resolve(__dirname, '../..')
const repositoryRoot = resolve(mobileRoot, '..')

const routeContracts = [
  ['public welcome', 'src/app/(public)/index.tsx'],
  ['registration', 'src/app/(public)/register.tsx'],
  ['sign in', 'src/app/(public)/sign-in.tsx'],
  ['email verification', 'src/app/(public)/verify-email.tsx'],
  ['USER home', 'src/app/(user)/user.tsx'],
  ['profile', 'src/app/(user)/profile.tsx'],
  ['assessment', 'src/app/(user)/assessment.tsx'],
  ['emotion check-in', 'src/app/(user)/emotion.tsx'],
  ['SupportPlan', 'src/app/(user)/support-plan.tsx'],
  ['Resources catalogue', 'src/app/(user)/resources/index.tsx'],
  ['Resource detail', 'src/app/(user)/resources/[resourceId].tsx'],
  ['Journal', 'src/app/(user)/journal.tsx'],
  ['Community', 'src/app/(user)/community.tsx'],
  ['specialist discovery', 'src/app/(user)/specialists.tsx'],
  ['USER appointments', 'src/app/(user)/appointments.tsx'],
  ['USER appointment chat', 'src/app/(user)/messages.tsx'],
  ['notification inbox', 'src/app/(user)/notifications.tsx'],
  ['notification preferences', 'src/app/(user)/notification-preferences.tsx'],
  ['SPECIALIST home', 'src/app/(specialist)/specialist.tsx'],
  ['SPECIALIST profile', 'src/app/(specialist)/profile.tsx'],
  ['SPECIALIST availability', 'src/app/(specialist)/availability.tsx'],
  ['SPECIALIST appointments', 'src/app/(specialist)/appointments/index.tsx'],
  [
    'SPECIALIST appointment detail',
    'src/app/(specialist)/appointments/[appointmentId].tsx',
  ],
  ['SPECIALIST appointment chat', 'src/app/(specialist)/messages.tsx'],
] as const

const storyEvidence = [
  'docs/MB-607_AUTH_SESSION.md',
  'docs/MB-608_USER_PROFILE.md',
  'docs/MB-611_MOBILE_DELIVERY_CONTRACT_V1.md',
  'docs/MB-612_ASSESSMENT_GUIDANCE.md',
  'docs/MB-613_EMOTION_CHECK_IN.md',
  'docs/MB-625_SUPPORT_PLAN.md',
  'docs/MB-626_RESOURCES.md',
  'docs/MB-627_PRIVATE_JOURNAL.md',
  'docs/MB-628_COMMUNITY.md',
  'docs/MB-629_SPECIALIST_DISCOVERY.md',
  'docs/MB-630_USER_APPOINTMENTS.md',
  'docs/MB-631_APPOINTMENT_CHAT.md',
  'docs/MB-632_NOTIFICATIONS.md',
  'docs/MB-633_SPECIALIST_PROFILE_AVAILABILITY.md',
  'docs/MB-634_SPECIALIST_APPOINTMENT_CONTINUITY.md',
] as const

const androidProofScripts = [
  'e2e:android:assessment',
  'e2e:android:emotion',
  'e2e:android:support-plan',
  'e2e:android:resources',
  'e2e:android:journal:evidence',
  'e2e:android:community:evidence',
  'e2e:android:discovery:evidence',
  'e2e:android:appointments:evidence',
  'e2e:android:chat:evidence',
  'e2e:android:specialist',
  'e2e:android:specialist-continuity:evidence',
] as const

describe('MB-624 mobile journey closure', () => {
  it.each(routeContracts)('keeps the %s route installed', (_, route) => {
    expect(existsSync(resolve(mobileRoot, route))).toBe(true)
  })

  it.each(storyEvidence)('keeps the owner and evidence contract %s', (file) => {
    expect(existsSync(resolve(mobileRoot, file))).toBe(true)
  })

  it('keeps every approved Android proof command available', () => {
    const packageConfig = JSON.parse(
      readFileSync(resolve(mobileRoot, 'package.json'), 'utf8'),
    ) as { scripts?: Record<string, string> }

    for (const script of androidProofScripts) {
      expect(packageConfig.scripts?.[script]).toBeTruthy()
    }
  })

  it('keeps role navigation guarded by Identity authority', () => {
    const rootLayout = readFileSync(
      resolve(mobileRoot, 'src/app/_layout.tsx'),
      'utf8',
    )

    expect(rootLayout).toContain('<Stack.Protected guard={guards.public}>')
    expect(rootLayout).toContain('<Stack.Protected guard={guards.user}>')
    expect(rootLayout).toContain('<Stack.Protected guard={guards.specialist}>')
    expect(rootLayout).not.toMatch(/decode|jwtDecode|AsyncStorage/)
  })

  it('keeps late mobile journey evidence fail closed in the protected gate', () => {
    const workflow = readFileSync(
      resolve(repositoryRoot, '.github/workflows/frontend-quality.yml'),
      'utf8',
    )

    for (const label of [
      'run-mobile-community-e2e',
      'run-mobile-discovery-e2e',
      'run-mobile-appointments-e2e',
      'run-mobile-chat-e2e',
      'run-mobile-specialist-e2e',
    ]) {
      expect(workflow).toContain(label)
    }
    expect(workflow).toContain('environment: staging-mobile-e2e')
    expect(workflow).toContain('ref: ${{ github.event.pull_request.head.sha }}')
    expect(workflow).toContain(
      'EVIDENCE_COMMIT_SHA: ${{ github.event.pull_request.head.sha }}',
    )
    expect(workflow).toContain(
      'PROVIDER_EVIDENCE=protected-controlled-real-contract',
    )
  })

  it('keeps dev and staging evidence claims distinct', () => {
    const developmentWorkflow = readFileSync(
      resolve(repositoryRoot, '.github/workflows/frontend-quality.yml'),
      'utf8',
    )
    const stagingWorkflow = readFileSync(
      resolve(repositoryRoot, '.github/workflows/staging-quality.yml'),
      'utf8',
    )

    expect(developmentWorkflow).toContain('Compile mobile TypeScript')
    expect(stagingWorkflow).toContain('Run mobile quality gate')
    expect(stagingWorkflow).toContain(
      'Staging Android native boot and real-contract journeys',
    )
    expect(stagingWorkflow).toContain('Staging iOS native boot')
  })
})
