import { describe, expect, it } from 'vitest'
import {
  parseVideoAccess,
  parseVideoCompletion,
  parseVideoSession,
} from './video-validation'

const id = '11111111-1111-4111-8111-111111111111'
const completion = {
  appointmentId: id,
  confirmationId: '22222222-2222-4222-8222-222222222222',
  verificationState: 'PENDING_VERIFICATION',
  appointmentStatus: 'SESSION_ENDED',
  creditState: 'HELD',
  completionFactId: null,
  acceptedAt: '2026-10-12T10:05:00Z',
  manualReviewAt: '2026-10-13T10:05:00Z',
  version: 3,
}
const session = {
  appointmentId: id,
  phase: 'ACTIVE',
  previewAllowed: true,
  joinAllowed: true,
  startsAt: '2026-10-12T10:00:00Z',
  endsAt: '2026-10-12T11:00:00Z',
  serverTime: '2026-10-12T10:01:00Z',
  version: 2,
  completion: null,
}
const access = {
  appointmentId: id,
  provider: 'LIVEKIT',
  serverUrl: 'wss://synthetic-project.livekit.cloud',
  roomName: `mb-${id}`,
  participantToken: 'synthetic.fixture.signature',
  expiresAt: '2026-10-12T10:03:00Z',
  endsAt: session.endsAt,
}

describe('MB-384 video public boundaries', () => {
  it.each([
    'TOO_EARLY',
    'WAITING',
    'ACTIVE',
    'ENDED',
    'COMPLETED',
    'NOT_AVAILABLE',
    'UNAVAILABLE',
  ])('accepts authoritative %s flags', (phase) => {
    const value = {
      ...session,
      phase,
      joinAllowed: phase === 'ACTIVE',
      previewAllowed: ['WAITING', 'ACTIVE'].includes(phase),
    }
    expect(parseVideoSession(value)).toEqual(value)
    expect(
      parseVideoSession({ ...value, joinAllowed: !value.joinAllowed }),
    ).toBeNull()
  })
  it('keeps unverified credit held and rejects a fabricated completion fact', () => {
    expect(parseVideoCompletion(completion)).toEqual(completion)
    expect(
      parseVideoCompletion({
        ...completion,
        verificationState: 'EVIDENCE_REVIEW',
      }),
    ).not.toBeNull()
    expect(
      parseVideoCompletion({ ...completion, creditState: 'AVAILABLE' }),
    ).toBeNull()
    expect(
      parseVideoCompletion({ ...completion, completionFactId: id }),
    ).toBeNull()
    expect(
      parseVideoCompletion({
        ...completion,
        manualReviewAt: completion.acceptedAt,
      }),
    ).toBeNull()
    const verified = {
      ...completion,
      verificationState: 'VERIFIED',
      appointmentStatus: 'COMPLETED',
      creditState: 'CONSUMED',
      completionFactId: id,
    }
    expect(parseVideoCompletion(verified)).toEqual(verified)
    expect(
      parseVideoCompletion({ ...verified, creditState: 'AVAILABLE' }),
    ).not.toBeNull()
    expect(
      parseVideoCompletion({ ...verified, completionFactId: null }),
    ).toBeNull()
  })
  it('binds completion identity/version/phase to the exact session', () => {
    expect(
      parseVideoSession({
        ...session,
        phase: 'ENDED',
        previewAllowed: false,
        joinAllowed: false,
        version: 3,
        completion,
      }),
    ).not.toBeNull()
    expect(parseVideoSession({ ...session, completion })).toBeNull()
    expect(
      parseVideoSession({
        ...session,
        phase: 'ENDED',
        previewAllowed: false,
        joinAllowed: false,
        version: 3,
        completion: { ...completion, appointmentId: completion.confirmationId },
      }),
    ).toBeNull()
    expect(parseVideoSession({ ...session, actorId: id })).toBeNull()
  })
  it('accepts only opaque Cloud connection responses without API credentials', () => {
    expect(parseVideoAccess(access)).toEqual(access)
    for (const serverUrl of [
      'ws://synthetic-project.livekit.cloud',
      'wss://evil.example',
      'wss://project.livekit.cloud.evil.example',
      'wss://project.livekit.cloud?token=hidden',
      'wss://name:secret@project.livekit.cloud',
    ])
      expect(parseVideoAccess({ ...access, serverUrl })).toBeNull()
    expect(parseVideoAccess({ ...access, apiSecret: 'synthetic' })).toBeNull()
    expect(
      parseVideoAccess({ ...access, expiresAt: '2026-10-12T11:01:00Z' }),
    ).toBeNull()
    expect(parseVideoAccess({ ...access, roomName: 'patient-name' })).toBeNull()
  })
})
