// Channel id, name and sound must match the backend Expo payload (ADR 0044, MB-849) and app.json.
export const PUSH_CHANNEL_ID = 'mentalbridge-chime-v1'
export const PUSH_CHANNEL_NAME = 'MentalBridge'
export const PUSH_SOUND = 'mentalbridge_chime.wav'
export const PUSH_ACCENT = '#3D7A6E'

export const INSTALLATION_ID_KEY = 'mb.push.installationId'
// '1' while this device registered for push; the preferences switch reads it so it never claims delivery it does not have.
export const PUSH_ENABLED_KEY = 'mb.push.enabled'
export const PUSH_INVITE_DISMISSED_KEY = 'mb.push.invite.dismissed'

export type PushState = 'OFF' | 'ENABLED' | 'DENIED' | 'UNAVAILABLE'
// Cached by PushBridge after each start/token refresh so the preferences screen can show a revoked permission.
export const PUSH_STATE_KEY = ['push', 'state'] as const
