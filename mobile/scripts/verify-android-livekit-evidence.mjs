import { readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

const FULL_GIT_SHA = /^[0-9a-f]{40}$/
const SHA256 = /^[0-9a-f]{64}$/
const ISSUE_KEY = /^MB-[1-9][0-9]*$/
const ISO_INSTANT =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/
const SAFE_ARTIFACT_PATH =
  /^(?![A-Za-z]:)(?![\\/])(?!.*(?:^|[\\/])\.\.(?:[\\/]|$))[A-Za-z0-9._/ -]+$/

const SECRET_KEY =
  /(?:password|passphrase|secret|token|authorization|api[_-]?key|cookie|credential|private[_-]?key|participant[_-]?identity|room[_-]?name|device[_-]?serial|email|phone(?:[_-]?number)?$|webhook[_-]?body|callback[_-]?url|server[_-]?url)/i
const SECRET_VALUES = [
  /\bBearer\s+\S+/i,
  /\b[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\b(?:LIVEKIT_)?(?:API_KEY|API_SECRET|ACCESS_TOKEN|REFRESH_TOKEN)\s*=/i,
  /\b(?:sk-[A-Za-z0-9_-]{16,}|AKIA[0-9A-Z]{16}|API[A-Za-z0-9]{12,})\b/,
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  /\b(?:https?|wss?):\/\/\S+/i,
  /[a-z][a-z0-9+.-]*:\/\/[^\s/@:]+:[^\s/@]+@/i,
]

function fail(message) {
  throw new Error(message)
}

function object(value, path) {
  if (
    value === null ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  )
    fail(`${path} must be a plain object`)
  return value
}

function exactKeys(value, keys, path) {
  const actual = Object.keys(object(value, path)).sort()
  const expected = [...keys].sort()
  const missing = expected.filter((key) => !actual.includes(key))
  const unknown = actual.filter((key) => !expected.includes(key))
  if (missing.length || unknown.length)
    fail(
      `${path} fields are invalid` +
        (missing.length ? `; missing ${missing.join(', ')}` : '') +
        (unknown.length ? `; unknown ${unknown.join(', ')}` : ''),
    )
  return value
}

function literal(value, expected, path) {
  if (value !== expected) fail(`${path} must be ${JSON.stringify(expected)}`)
}

function nonEmptyString(value, path, max = 160) {
  if (
    typeof value !== 'string' ||
    value.trim() !== value ||
    value.length === 0 ||
    value.length > max
  )
    fail(`${path} must be a non-empty trimmed string up to ${max} characters`)
}

function matches(value, pattern, path, label) {
  if (typeof value !== 'string' || !pattern.test(value))
    fail(`${path} must be ${label}`)
}

function trueEvidence(value, path) {
  if (value !== true) fail(`${path} must be true`)
}

function findSecret(value, path = 'manifest') {
  if (Array.isArray(value)) {
    value.forEach((item, index) => findSecret(item, `${path}[${index}]`))
    return
  }
  if (value !== null && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if (SECRET_KEY.test(key)) fail(`${path}.${key} is a secret-shaped field`)
      findSecret(item, `${path}.${key}`)
    }
    return
  }
  if (
    typeof value === 'string' &&
    SECRET_VALUES.some((pattern) => pattern.test(value))
  )
    fail(`${path} contains a secret-shaped value`)
}

function validateCapturedAt(value) {
  matches(value, ISO_INSTANT, 'manifest.capturedAt', 'an ISO-8601 instant')
  if (Number.isNaN(Date.parse(value)))
    fail('manifest.capturedAt must be a valid ISO-8601 instant')
}

function validateRevisions(value, allowMissing) {
  exactKeys(
    value,
    ['frontendSha', 'backendSha', 'androidBuildSha256'],
    'manifest.revisions',
  )
  for (const [key, pattern, label] of [
    ['frontendSha', FULL_GIT_SHA, 'a full 40-character Git SHA'],
    ['backendSha', FULL_GIT_SHA, 'a full 40-character Git SHA'],
    ['androidBuildSha256', SHA256, 'a full 64-character SHA-256'],
  ]) {
    if (allowMissing && value[key] === null) continue
    matches(value[key], pattern, `manifest.revisions.${key}`, label)
  }
}

function validateBlockers(blockers, required) {
  if (!Array.isArray(blockers)) fail('manifest.blockers must be an array')
  if (required && blockers.length === 0)
    fail('BLOCKED_PROVIDER requires at least one blocker')
  if (!required && blockers.length !== 0)
    fail('STAGING_PASS cannot contain blockers')
  for (const [index, blocker] of blockers.entries()) {
    const path = `manifest.blockers[${index}]`
    exactKeys(blocker, ['issueKey', 'status', 'code', 'summary'], path)
    matches(blocker.issueKey, ISSUE_KEY, `${path}.issueKey`, 'an MB issue key')
    nonEmptyString(blocker.status, `${path}.status`, 80)
    if (
      ![
        'MISSING_STAGING_CREDENTIALS',
        'CALLBACK_NOT_CONFIGURED',
        'CALLBACK_UNREACHABLE',
        'LIVEKIT_UNAVAILABLE',
        'STAGING_BACKEND_UNAVAILABLE',
        'APPROVED_BUILD_UNAVAILABLE',
        'PAIRED_FIXTURE_UNAVAILABLE',
        'PHYSICAL_ANDROID_UNAVAILABLE',
        'OTHER_PROVIDER_BLOCKER',
      ].includes(blocker.code)
    )
      fail(`${path}.code is not an allowed provider blocker`)
    nonEmptyString(blocker.summary, `${path}.summary`, 300)
  }
}

function validateFixture(value) {
  exactKeys(
    value,
    [
      'syntheticUser',
      'syntheticSpecialist',
      'sameConfirmedInAppVideoAppointment',
      'eligibleCreditAndSlot',
      'sessionPolicyVersion',
    ],
    'manifest.fixture',
  )
  for (const key of [
    'syntheticUser',
    'syntheticSpecialist',
    'sameConfirmedInAppVideoAppointment',
    'eligibleCreditAndSlot',
  ])
    trueEvidence(value[key], `manifest.fixture.${key}`)
  literal(
    value.sessionPolicyVersion,
    'livekit-video-completion-v1',
    'manifest.fixture.sessionPolicyVersion',
  )
}

function validateAndroid(value) {
  exactKeys(
    value,
    [
      'runtime',
      'deviceModel',
      'androidVersion',
      'approvedBuildInstalled',
      'artifacts',
    ],
    'manifest.android',
  )
  literal(value.runtime, 'PHYSICAL_ANDROID_DEVICE', 'manifest.android.runtime')
  nonEmptyString(value.deviceModel, 'manifest.android.deviceModel', 120)
  nonEmptyString(value.androidVersion, 'manifest.android.androidVersion', 80)
  trueEvidence(
    value.approvedBuildInstalled,
    'manifest.android.approvedBuildInstalled',
  )
  if (!Array.isArray(value.artifacts) || value.artifacts.length < 2)
    fail('manifest.android.artifacts must contain physical-device proof')
  const kinds = new Set()
  const paths = new Set()
  for (const [index, artifact] of value.artifacts.entries()) {
    const path = `manifest.android.artifacts[${index}]`
    exactKeys(artifact, ['kind', 'path', 'sha256'], path)
    if (
      !['DEVICE_REPORT', 'SCREEN_RECORDING', 'SCREENSHOT'].includes(
        artifact.kind,
      )
    )
      fail(`${path}.kind is not an allowed sanitized evidence type`)
    if (
      typeof artifact.path !== 'string' ||
      !SAFE_ARTIFACT_PATH.test(artifact.path) ||
      artifact.path.includes('\\')
    )
      fail(`${path}.path must be a safe relative artifact path`)
    matches(
      artifact.sha256,
      SHA256,
      `${path}.sha256`,
      'a full 64-character SHA-256',
    )
    if (paths.has(artifact.path)) fail('artifact paths must be unique')
    paths.add(artifact.path)
    kinds.add(artifact.kind)
  }
  for (const required of ['DEVICE_REPORT', 'SCREEN_RECORDING'])
    if (!kinds.has(required))
      fail(`manifest.android.artifacts must include ${required}`)
}

function validateProvider(value) {
  exactKeys(
    value,
    [
      'mode',
      'providerProbeState',
      'callbackPath',
      'callbackState',
      'attendanceVerified',
      'signedEventCount',
    ],
    'manifest.provider',
  )
  literal(value.mode, 'LIVEKIT_CLOUD', 'manifest.provider.mode')
  literal(
    value.providerProbeState,
    'PASSED',
    'manifest.provider.providerProbeState',
  )
  literal(
    value.callbackPath,
    '/internal/v1/video/livekit/webhook',
    'manifest.provider.callbackPath',
  )
  literal(
    value.callbackState,
    'SIGNED_CALLBACKS_VERIFIED',
    'manifest.provider.callbackState',
  )
  trueEvidence(value.attendanceVerified, 'manifest.provider.attendanceVerified')
  if (
    !Number.isSafeInteger(value.signedEventCount) ||
    value.signedEventCount < 5
  )
    fail('manifest.provider.signedEventCount must be an integer of at least 5')
}

function validateAllTrue(value, keys, path) {
  exactKeys(value, keys, path)
  for (const key of keys) trueEvidence(value[key], `${path}.${key}`)
}

function validateCompletion(value) {
  exactKeys(
    value,
    [
      'verificationState',
      'appointmentStatus',
      'sessionOutcomeReason',
      'creditState',
      'completionFactPresent',
      'consumedLedgerEvents',
      'specialistEarningPresent',
      'specialistEarningEvents',
    ],
    'manifest.completion',
  )
  literal(
    value.verificationState,
    'VERIFIED',
    'manifest.completion.verificationState',
  )
  literal(
    value.appointmentStatus,
    'COMPLETED',
    'manifest.completion.appointmentStatus',
  )
  literal(
    value.sessionOutcomeReason,
    'EVIDENCE_REQUIREMENTS_MET',
    'manifest.completion.sessionOutcomeReason',
  )
  literal(value.creditState, 'CONSUMED', 'manifest.completion.creditState')
  trueEvidence(
    value.completionFactPresent,
    'manifest.completion.completionFactPresent',
  )
  literal(
    value.consumedLedgerEvents,
    1,
    'manifest.completion.consumedLedgerEvents',
  )
  trueEvidence(
    value.specialistEarningPresent,
    'manifest.completion.specialistEarningPresent',
  )
  literal(
    value.specialistEarningEvents,
    1,
    'manifest.completion.specialistEarningEvents',
  )
}

export function validateEvidenceManifest(input) {
  object(input, 'manifest')
  findSecret(input)
  literal(input.task, 'MB-715', 'manifest.task')
  if (!['STAGING_PASS', 'BLOCKED_PROVIDER'].includes(input.classification))
    fail('manifest.classification must be STAGING_PASS or BLOCKED_PROVIDER')
  validateCapturedAt(input.capturedAt)

  if (input.classification === 'BLOCKED_PROVIDER') {
    exactKeys(
      input,
      ['task', 'classification', 'capturedAt', 'revisions', 'blockers'],
      'manifest',
    )
    validateRevisions(input.revisions, true)
    validateBlockers(input.blockers, true)
    return {
      classification: input.classification,
      blockerCount: input.blockers.length,
    }
  }

  exactKeys(
    input,
    [
      'task',
      'classification',
      'capturedAt',
      'revisions',
      'blockers',
      'fixture',
      'android',
      'provider',
      'media',
      'permissions',
      'continuity',
      'windowCases',
      'completion',
    ],
    'manifest',
  )
  validateRevisions(input.revisions, false)
  validateBlockers(input.blockers, false)
  validateFixture(input.fixture)
  validateAndroid(input.android)
  validateProvider(input.provider)
  validateAllTrue(
    input.media,
    [
      'userReceivedSpecialistAudio',
      'userReceivedSpecialistVideo',
      'specialistReceivedUserAudio',
      'specialistReceivedUserVideo',
      'microphoneToggleObserved',
      'cameraToggleObserved',
      'audioRouteObserved',
    ],
    'manifest.media',
  )
  validateAllTrue(
    input.permissions,
    [
      'cameraDeniedObserved',
      'cameraGrantedObserved',
      'microphoneDeniedObserved',
      'microphoneGrantedObserved',
    ],
    'manifest.permissions',
  )
  validateAllTrue(
    input.continuity,
    [
      'backgroundMediaStopped',
      'foregroundExplicitRejoin',
      'networkReconnectObserved',
      'mediaRestoredAfterReconnect',
    ],
    'manifest.continuity',
  )
  validateAllTrue(
    input.windowCases,
    [
      'tooEarlyJoinRejected',
      'waitingPreviewWithoutProviderJoin',
      'activeJoinAllowed',
      'expiredJoinRejected',
      'noShowDidNotComplete',
      'restrictedRoleRejected',
      'missingOrInvalidWebhookDidNotComplete',
      'duplicateConfirmationIdempotent',
      'duplicateWebhookIdempotent',
      'fabricatedAttendanceAbsent',
    ],
    'manifest.windowCases',
  )
  validateCompletion(input.completion)
  return { classification: input.classification, blockerCount: 0 }
}

function parseManifest(path) {
  if (statSync(path).size > 65_536) fail('manifest exceeds the 64 KiB limit')
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    fail('manifest is not valid JSON')
  }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 3)
      fail(
        'usage: node scripts/verify-android-livekit-evidence.mjs <manifest.json>',
      )
    const result = validateEvidenceManifest(
      parseManifest(resolve(process.argv[2])),
    )
    console.log(
      result.classification === 'STAGING_PASS'
        ? 'PASS MB-715: sanitized physical Android LiveKit staging evidence is complete.'
        : `VALID MB-715 BLOCKED_PROVIDER: ${result.blockerCount} blocker(s) recorded; no PASS inferred.`,
    )
  } catch (error) {
    console.error(
      `MB-715 evidence validation failed: ${
        error instanceof Error ? error.message : 'unknown validation error'
      }`,
    )
    process.exitCode = 1
  }
}
