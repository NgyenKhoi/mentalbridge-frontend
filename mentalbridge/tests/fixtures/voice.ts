import type {
  Connection,
  Eligibility,
  VoiceSession,
  Disclosure,
} from '@/features/ai-companion/voice/contract'

export const voiceSessionId = '11111111-1111-4111-8111-111111111111'
export const voiceKey = '22222222-2222-4222-8222-222222222222'
export function eligibility(
  plan: 'FREE' | 'PLUS' | 'PREMIUM' = 'PLUS',
  patch: Partial<Eligibility> = {},
): Eligibility {
  const cap = plan === 'FREE' ? 0 : plan === 'PLUS' ? 300 : 600
  return {
    policyVersion: 'companion-voice-policy-v1',
    state: plan === 'FREE' ? 'FREE_LOCKED' : 'ELIGIBLE',
    eligible: plan !== 'FREE',
    packageCode: plan,
    maxSessionSeconds: cap,
    availableSessionSeconds: cap,
    quota: {
      policyVersion: 'companion-voice-policy-v1',
      quotaDay: '2026-10-28',
      timeZone: 'Asia/Ho_Chi_Minh',
      resetAt: '2026-10-28T17:00:00Z',
      remainingSessions: plan === 'FREE' ? 0 : 2,
      remainingSeconds: plan === 'FREE' ? 0 : 600,
      reservedSessions: 0,
      reservedSeconds: 0,
    },
    checkedAt: new Date().toISOString(),
    voiceConsentVersion: 'ai-voice-processing-capstone-v1',
    ...patch,
  }
}
export function session(patch: Partial<VoiceSession> = {}): VoiceSession {
  return {
    voiceSessionId,
    policyVersion: 'companion-voice-policy-v1',
    state: 'ACTIVE',
    createdAt: new Date().toISOString(),
    authorizedAt: new Date().toISOString(),
    hardStopAt: new Date(Date.now() + 120_000).toISOString(),
    quotaDay: '2026-10-28',
    admittedSeconds: 120,
    chargedSeconds: 0,
    deliveredSession: false,
    ...patch,
  }
}
export const connection = (): Connection => ({
  voiceSessionId,
  roomName: `ai-voice-${voiceSessionId}`,
  agentIdentity: `va-${voiceKey}`,
  transport: 'LIVEKIT_CLOUD',
  serverUrl: 'wss://synthetic.livekit.cloud',
  participantToken: 'synthetic-memory-only-participant-token',
  tokenExpiresAt: new Date(Date.now() + 60_000).toISOString(),
  hardStopAt: new Date(Date.now() + 120_000).toISOString(),
  audioOnly: true,
})
export const disclosure: Disclosure = {
  consentType: 'AI_VOICE_PROCESSING',
  consentVersion: 'ai-voice-processing-capstone-v1',
  language: 'vi-VN',
  disclosureText:
    'LiveKit xử lý âm thanh và STT/TTS; Claude qua AWS Bedrock có thể xử lý liên vùng. Không ghi âm hoặc lưu bản chép lời. Metadata tối thiểu giữ 30 ngày từ lúc tạo. Không lấy nhật ký hay lịch sử AI Text.',
  publishedAt: '2026-10-23T00:00:00Z',
}
