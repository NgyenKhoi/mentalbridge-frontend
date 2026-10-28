import Ajv2020, { type ValidateFunction } from 'ajv/dist/2020'
import addFormats from 'ajv-formats'
import schema from '@/contracts/voice-public.generated.json'
import type { components as Journal } from '@/contracts/journal.generated'
import type { components as Care } from '@/contracts/care.generated'

export type Eligibility = Journal['schemas']['VoiceEligibility']
export type VoiceSession = Journal['schemas']['VoiceSession']
export type Connection = Journal['schemas']['VoiceConnection']
export type Disclosure = Care['schemas']['VoiceDisclosure']
export type VoiceConsent = Care['schemas']['VoiceConsent']
export type ConsentCommand = Care['schemas']['VoiceConsentCommand']
export type Responses = {
  eligibility: Eligibility
  session: VoiceSession
  connection: Connection
  disclosure: Disclosure
  consent: VoiceConsent
}
const ajv = new Ajv2020({ strict: true, allErrors: false })
addFormats(ajv)
ajv.addSchema(schema)
const compile = <T>(name: string) =>
  ajv.compile<T>({ $ref: `mentalbridge-voice-public#/$defs/${name}` })
export const validators: {
  [K in keyof Responses]: ValidateFunction<Responses[K]>
} = {
  eligibility: compile<Eligibility>('Eligibility'),
  session: compile<VoiceSession>('Session'),
  connection: compile<Connection>('Connection'),
  disclosure: compile<Disclosure>('VoiceDisclosure'),
  consent: compile<VoiceConsent>('VoiceConsent'),
}
export const validConsentCommand = compile<ConsentCommand>(
  'VoiceConsentCommand',
)
export const validEmptyCommand = compile<Record<string, never>>('EmptyCommand')
export const publicVoiceCode = (value: unknown) =>
  typeof value === 'string' &&
  schema.$defs.Problem.properties.code.enum.some((code) => code === value)
    ? value
    : 'VOICE_UNAVAILABLE'
export const voiceId = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  )
export const terminal = (session: VoiceSession) =>
  ['ENDED', 'FAILED', 'EXPIRED'].includes(session.state)
export class VoiceError extends Error {
  constructor(readonly code: string) {
    super('Voice request could not be completed.')
  }
}
export function decode<K extends keyof Responses>(
  kind: K,
  value: unknown,
): Responses[K] {
  const validate = validators[kind]
  if (!validate(value)) throw new VoiceError('INVALID_RESPONSE')
  return value
}
