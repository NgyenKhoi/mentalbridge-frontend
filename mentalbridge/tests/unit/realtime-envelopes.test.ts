import { describe, expect, it } from 'vitest'

import { createMessageCommand } from '@/lib/realtime/commands'
import {
  parseAcknowledgementV1,
  parseCommandV1,
  parseHandshakeV1,
  parseSafeErrorV1,
  parseServerEventV1,
} from '@/lib/realtime/envelopes'

const commandId = '11111111-1111-4111-8111-111111111111'
const conversationId = '22222222-2222-4222-8222-222222222222'
const correlationId = '33333333-3333-4333-8333-333333333333'
const timestamp = '2026-09-04T12:00:00Z'

describe('realtime v1 envelope adapters', () => {
  it('accepts strict handshake, command, acknowledgement, safe error and server event envelopes', () => {
    expect(
      parseHandshakeV1({ schemaVersion: 1, accessToken: 'synthetic-only' }).ok,
    ).toBe(true)
    expect(
      parseCommandV1({
        schemaVersion: 1,
        commandId,
        commandType: 'message.send',
        correlationId,
        sentAt: timestamp,
        payload: {
          conversationId,
          clientMessageId: commandId,
          type: 'TEXT',
          content: 'Synthetic',
        },
      }).ok,
    ).toBe(true)
    expect(
      parseAcknowledgementV1({
        schemaVersion: 1,
        commandId,
        correlationId,
        status: 'accepted',
        acknowledgedAt: timestamp,
        liveDelivery: 'not_applicable',
      }).ok,
    ).toBe(true)
    expect(
      parseSafeErrorV1({
        schemaVersion: 1,
        correlationId,
        code: 'RATE_LIMITED',
        message: 'Command rate limit was exceeded',
        retryable: true,
      }).ok,
    ).toBe(true)
    expect(
      parseServerEventV1({
        schemaVersion: 1,
        eventId: commandId,
        eventType: 'connection.ready',
        correlationId,
        occurredAt: timestamp,
        payload: { accountId: commandId, role: 'USER', presence: 'connected' },
      }).ok,
    ).toBe(true)
  })

  it.each([
    ['unknown version', { schemaVersion: 2, accessToken: 'synthetic-only' }],
    [
      'unknown field',
      { schemaVersion: 1, accessToken: 'synthetic-only', tokenType: 'bearer' },
    ],
    ['empty token', { schemaVersion: 1, accessToken: '' }],
  ])('rejects incompatible handshake: %s', (_name, input) => {
    expect(parseHandshakeV1(input).ok).toBe(false)
  })

  it('rejects invalid UUIDs, timestamps, oversized content and malformed frames', () => {
    const invalid = {
      schemaVersion: 1,
      commandId: 'not-a-uuid',
      commandType: 'message.send',
      correlationId,
      sentAt: 'yesterday',
      payload: {
        conversationId,
        clientMessageId: commandId,
        type: 'TEXT',
        content: 'x'.repeat(4001),
      },
    }
    expect(parseCommandV1(invalid).ok).toBe(false)
    expect(parseServerEventV1('{broken')).toMatchObject({
      ok: false,
      reason: 'malformed_json',
    })
    expect(parseServerEventV1(`"${'x'.repeat(17_000)}"`)).toMatchObject({
      ok: false,
      reason: 'oversized_frame',
    })
  })

  it('keeps command and client-message IDs stable when an eligible retry is rebuilt', () => {
    const identity = {
      commandId,
      correlationId,
      clientMessageId: conversationId,
    }
    const clock = {
      now: () => new Date(timestamp),
      uuid: () => {
        throw new Error('uuid must not be regenerated')
      },
    }
    const first = createMessageCommand(
      conversationId,
      'Synthetic retry',
      identity,
      clock,
    )
    const retry = createMessageCommand(
      conversationId,
      'Synthetic retry',
      identity,
      clock,
    )
    expect(retry).toEqual(first)
  })
})
