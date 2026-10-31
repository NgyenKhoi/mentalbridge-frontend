import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { validateEvidenceManifest } from './verify-android-livekit-evidence.mjs'

const gitSha = '1'.repeat(40)
const backendSha = '2'.repeat(40)
const buildSha = '3'.repeat(64)
const artifactSha = '4'.repeat(64)

function passingManifest() {
  return {
    task: 'MB-715',
    classification: 'STAGING_PASS',
    capturedAt: '2026-10-31T14:00:00Z',
    revisions: {
      frontendSha: gitSha,
      backendSha,
      androidBuildSha256: buildSha,
    },
    blockers: [],
    fixture: {
      syntheticUser: true,
      syntheticSpecialist: true,
      sameConfirmedInAppVideoAppointment: true,
      eligibleCreditAndSlot: true,
      sessionPolicyVersion: 'livekit-video-completion-v1',
    },
    android: {
      runtime: 'PHYSICAL_ANDROID_DEVICE',
      deviceModel: 'Sanitized Android test device',
      androidVersion: 'Android 16',
      approvedBuildInstalled: true,
      artifacts: [
        {
          kind: 'DEVICE_REPORT',
          path: 'evidence/mb-715/device-report.json',
          sha256: artifactSha,
        },
        {
          kind: 'SCREEN_RECORDING',
          path: 'evidence/mb-715/two-party-call.mp4',
          sha256: '5'.repeat(64),
        },
      ],
    },
    provider: {
      mode: 'LIVEKIT_CLOUD',
      providerProbeState: 'PASSED',
      callbackPath: '/internal/v1/video/livekit/webhook',
      callbackState: 'SIGNED_CALLBACKS_VERIFIED',
      attendanceVerified: true,
      signedEventCount: 7,
    },
    media: {
      userReceivedSpecialistAudio: true,
      userReceivedSpecialistVideo: true,
      specialistReceivedUserAudio: true,
      specialistReceivedUserVideo: true,
      microphoneToggleObserved: true,
      cameraToggleObserved: true,
      audioRouteObserved: true,
    },
    permissions: {
      cameraDeniedObserved: true,
      cameraGrantedObserved: true,
      microphoneDeniedObserved: true,
      microphoneGrantedObserved: true,
    },
    continuity: {
      backgroundMediaStopped: true,
      foregroundExplicitRejoin: true,
      networkReconnectObserved: true,
      mediaRestoredAfterReconnect: true,
    },
    windowCases: {
      tooEarlyJoinRejected: true,
      waitingPreviewWithoutProviderJoin: true,
      activeJoinAllowed: true,
      expiredJoinRejected: true,
      noShowDidNotComplete: true,
      restrictedRoleRejected: true,
      missingOrInvalidWebhookDidNotComplete: true,
      duplicateConfirmationIdempotent: true,
      duplicateWebhookIdempotent: true,
      fabricatedAttendanceAbsent: true,
    },
    completion: {
      verificationState: 'VERIFIED',
      appointmentStatus: 'COMPLETED',
      sessionOutcomeReason: 'EVIDENCE_REQUIREMENTS_MET',
      creditState: 'CONSUMED',
      completionFactPresent: true,
      consumedLedgerEvents: 1,
      specialistEarningPresent: true,
      specialistEarningEvents: 1,
    },
  }
}

describe('MB-715 Android LiveKit evidence manifest', () => {
  it('accepts complete sanitized physical Android staging evidence', () => {
    assert.deepEqual(validateEvidenceManifest(passingManifest()), {
      classification: 'STAGING_PASS',
      blockerCount: 0,
    })
  })

  it('fails closed when any required PASS proof is absent or false', () => {
    const mutations = [
      (manifest) => {
        manifest.revisions.frontendSha = '1'.repeat(12)
      },
      (manifest) => {
        manifest.android.runtime = 'EMULATOR'
      },
      (manifest) => {
        manifest.provider.callbackState = 'NOT_CONFIGURED'
      },
      (manifest) => {
        manifest.provider.attendanceVerified = false
      },
      (manifest) => {
        manifest.media.specialistReceivedUserAudio = false
      },
      (manifest) => {
        manifest.permissions.microphoneDeniedObserved = false
      },
      (manifest) => {
        manifest.continuity.networkReconnectObserved = false
      },
      (manifest) => {
        manifest.windowCases.expiredJoinRejected = false
      },
      (manifest) => {
        manifest.completion.verificationState = 'PENDING_VERIFICATION'
      },
      (manifest) => {
        manifest.completion.sessionOutcomeReason = 'SCHEDULED_WINDOW_ENDED'
      },
      (manifest) => {
        manifest.completion.consumedLedgerEvents = 2
      },
      (manifest) => {
        manifest.completion.specialistEarningEvents = 2
      },
    ]
    for (const mutate of mutations) {
      const manifest = passingManifest()
      mutate(manifest)
      assert.throws(() => validateEvidenceManifest(manifest))
    }
  })

  it('requires hashed device report and screen recording artifacts', () => {
    const manifest = passingManifest()
    manifest.android.artifacts = [manifest.android.artifacts[0]]
    assert.throws(
      () => validateEvidenceManifest(manifest),
      /physical-device proof/,
    )
  })

  it('rejects secret-shaped fields and values before accepting evidence', () => {
    const secretField = passingManifest()
    secretField.provider.participantToken = 'not-retained'
    assert.throws(
      () => validateEvidenceManifest(secretField),
      /secret-shaped field/,
    )

    const secretValue = passingManifest()
    secretValue.android.deviceModel = 'Bearer synthetic-sensitive-value'
    assert.throws(
      () => validateEvidenceManifest(secretValue),
      /secret-shaped value/,
    )

    const privateUrl = passingManifest()
    privateUrl.android.deviceModel = 'https://private-staging.example/device'
    assert.throws(
      () => validateEvidenceManifest(privateUrl),
      /secret-shaped value/,
    )
  })

  it('accepts an explicit provider blocker without inferring PASS', () => {
    const manifest = {
      task: 'MB-715',
      classification: 'BLOCKED_PROVIDER',
      capturedAt: '2026-10-31T14:00:00+07:00',
      revisions: {
        frontendSha: gitSha,
        backendSha,
        androidBuildSha256: null,
      },
      blockers: [
        {
          issueKey: 'MB-715',
          status: 'In Progress',
          code: 'CALLBACK_NOT_CONFIGURED',
          summary: 'Approved staging callback is not configured.',
        },
      ],
    }
    assert.deepEqual(validateEvidenceManifest(manifest), {
      classification: 'BLOCKED_PROVIDER',
      blockerCount: 1,
    })
  })

  it('rejects BLOCKED_PROVIDER without an exact blocker issue and status', () => {
    const manifest = {
      task: 'MB-715',
      classification: 'BLOCKED_PROVIDER',
      capturedAt: '2026-10-31T14:00:00Z',
      revisions: {
        frontendSha: null,
        backendSha: null,
        androidBuildSha256: null,
      },
      blockers: [],
    }
    assert.throws(
      () => validateEvidenceManifest(manifest),
      /requires at least one blocker/,
    )
  })

  it('accepts an exact physical-device staging blocker', () => {
    const manifest = {
      task: 'MB-715',
      classification: 'BLOCKED_PROVIDER',
      capturedAt: '2026-10-31T14:00:00Z',
      revisions: {
        frontendSha: gitSha,
        backendSha: null,
        androidBuildSha256: null,
      },
      blockers: [
        {
          issueKey: 'MB-715',
          status: 'In Progress',
          code: 'PHYSICAL_ANDROID_UNAVAILABLE',
          summary: 'No approved physical Android device is connected.',
        },
      ],
    }
    assert.equal(
      validateEvidenceManifest(manifest).classification,
      'BLOCKED_PROVIDER',
    )
  })
})
