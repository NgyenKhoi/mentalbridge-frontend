import {
  decode,
  VoiceError,
  type Responses,
  type ConsentCommand,
} from './contract'

async function read<K extends keyof Responses>(
  path: string,
  kind: K,
  signal?: AbortSignal,
  command?: { key: string; body: object },
): Promise<Responses[K]> {
  let response: Response
  try {
    response = await fetch(`/api/ai-companion/voice/${path}`, {
      method: command ? 'POST' : 'GET',
      cache: 'no-store',
      credentials: 'same-origin',
      signal: AbortSignal.any([
        ...(signal ? [signal] : []),
        AbortSignal.timeout(12_000),
      ]),
      ...(command
        ? {
            headers: {
              'Content-Type': 'application/json',
              'Idempotency-Key': command.key,
            },
            body: JSON.stringify(command.body),
          }
        : {}),
    })
  } catch {
    throw new VoiceError(command ? 'OUTCOME_UNKNOWN' : 'VOICE_UNAVAILABLE')
  }
  let value: unknown
  try {
    value = await response.json()
  } catch {
    throw new VoiceError('INVALID_RESPONSE')
  }
  if (!response.ok)
    throw new VoiceError(
      typeof value === 'object' &&
        value !== null &&
        'code' in value &&
        typeof value.code === 'string'
        ? value.code
        : 'VOICE_UNAVAILABLE',
    )
  return decode(kind, value)
}
export const voiceClient = {
  eligibility: (signal?: AbortSignal) =>
    read('eligibility', 'eligibility', signal),
  disclosure: (signal?: AbortSignal) =>
    read('disclosure', 'disclosure', signal),
  consent: (body: ConsentCommand, key: string, signal?: AbortSignal) =>
    read('consent', 'consent', signal, { key, body }),
  create: (key: string, signal?: AbortSignal) =>
    read('sessions', 'session', signal, { key, body: {} }),
  session: (id: string, signal?: AbortSignal) =>
    read(`sessions/${id}`, 'session', signal),
  connection: (id: string, key: string, signal?: AbortSignal) =>
    read(`sessions/${id}/connection`, 'connection', signal, { key, body: {} }),
  end: (id: string, key: string, signal?: AbortSignal) =>
    read(`sessions/${id}/end`, 'session', signal, { key, body: {} }),
}
