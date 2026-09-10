import Ajv2020 from 'ajv/dist/2020'
import addFormats from 'ajv-formats'

import {
  acknowledgementV1Schema,
  commandEnvelopeV1Schema,
  errorV1Schema,
  handshakeV1Schema,
  serverEventV1Schema,
  type AcknowledgementV1,
  type CommandEnvelopeV1,
  type HandshakeV1,
  type SafeErrorV1,
  type ServerEventV1,
} from './contracts.generated'

export const MAX_REALTIME_FRAME_BYTES = 16_384

export type ParseFailure = {
  ok: false
  reason: 'malformed_json' | 'oversized_frame' | 'invalid_envelope'
  details: readonly string[]
}

export type ParseResult<T> = { ok: true; value: T } | ParseFailure

const ajv = new Ajv2020({ allErrors: true, strict: true })
addFormats(ajv)

const validators = {
  handshake: ajv.compile<HandshakeV1>(handshakeV1Schema),
  command: ajv.compile<CommandEnvelopeV1>(commandEnvelopeV1Schema),
  acknowledgement: ajv.compile<AcknowledgementV1>(acknowledgementV1Schema),
  error: ajv.compile<SafeErrorV1>(errorV1Schema),
  event: ajv.compile<ServerEventV1>(serverEventV1Schema),
}

function bytes(value: string): number {
  return new TextEncoder().encode(value).byteLength
}

function decodeFrame(input: unknown): ParseResult<unknown> {
  if (typeof input !== 'string') {
    try {
      const serialized = JSON.stringify(input)
      if (serialized === undefined) {
        return {
          ok: false,
          reason: 'invalid_envelope',
          details: ['Frame is not serializable'],
        }
      }
      if (bytes(serialized) > MAX_REALTIME_FRAME_BYTES) {
        return {
          ok: false,
          reason: 'oversized_frame',
          details: ['Frame exceeds 16384 bytes'],
        }
      }
      return { ok: true, value: input }
    } catch {
      return {
        ok: false,
        reason: 'malformed_json',
        details: ['Frame is not serializable'],
      }
    }
  }

  if (bytes(input) > MAX_REALTIME_FRAME_BYTES) {
    return {
      ok: false,
      reason: 'oversized_frame',
      details: ['Frame exceeds 16384 bytes'],
    }
  }
  try {
    return { ok: true, value: JSON.parse(input) as unknown }
  } catch {
    return {
      ok: false,
      reason: 'malformed_json',
      details: ['Frame is not valid JSON'],
    }
  }
}

function parse<T>(
  input: unknown,
  validate: (typeof validators)[keyof typeof validators],
): ParseResult<T> {
  const decoded = decodeFrame(input)
  if (!decoded.ok) return decoded
  if (validate(decoded.value)) return { ok: true, value: decoded.value as T }
  return {
    ok: false,
    reason: 'invalid_envelope',
    details: (validate.errors ?? []).map(
      (error) =>
        `${error.instancePath || '/'} ${error.message ?? 'is invalid'}`,
    ),
  }
}

export const parseHandshakeV1 = (input: unknown) =>
  parse<HandshakeV1>(input, validators.handshake)
export const parseCommandV1 = (input: unknown) =>
  parse<CommandEnvelopeV1>(input, validators.command)
export const parseAcknowledgementV1 = (input: unknown) =>
  parse<AcknowledgementV1>(input, validators.acknowledgement)
export const parseSafeErrorV1 = (input: unknown) =>
  parse<SafeErrorV1>(input, validators.error)
export const parseServerEventV1 = (input: unknown) =>
  parse<ServerEventV1>(input, validators.event)

export type {
  AcknowledgementV1,
  CommandEnvelopeV1,
  HandshakeV1,
  SafeErrorV1,
  ServerEventV1,
}
