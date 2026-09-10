import { parseCommandV1, type CommandEnvelopeV1 } from './envelopes'

export interface CommandIdentity {
  readonly commandId: string
  readonly correlationId: string
}

export interface MessageIdentity extends CommandIdentity {
  readonly clientMessageId: string
}

export interface CommandClock {
  now(): Date
  uuid(): string
}

const browserClock: CommandClock = {
  now: () => new Date(),
  uuid: () => crypto.randomUUID(),
}

function checked(command: unknown): CommandEnvelopeV1 {
  const result = parseCommandV1(command)
  if (!result.ok)
    throw new Error(
      `Generated realtime command is invalid: ${result.details.join('; ')}`,
    )
  return result.value
}

export function createHeartbeatCommand(
  identity?: CommandIdentity,
  clock: CommandClock = browserClock,
): CommandEnvelopeV1 {
  return checked({
    schemaVersion: 1,
    commandId: identity?.commandId ?? clock.uuid(),
    commandType: 'presence.heartbeat',
    correlationId: identity?.correlationId ?? clock.uuid(),
    sentAt: clock.now().toISOString(),
    payload: {},
  })
}

export function createSubscribeCommand(
  conversationId: string,
  identity?: CommandIdentity,
  clock: CommandClock = browserClock,
): CommandEnvelopeV1 {
  return checked({
    schemaVersion: 1,
    commandId: identity?.commandId ?? clock.uuid(),
    commandType: 'conversation.subscribe',
    correlationId: identity?.correlationId ?? clock.uuid(),
    sentAt: clock.now().toISOString(),
    payload: { conversationId },
  })
}

export function createMessageCommand(
  conversationId: string,
  content: string,
  identity?: MessageIdentity,
  clock: CommandClock = browserClock,
): CommandEnvelopeV1 {
  return checked({
    schemaVersion: 1,
    commandId: identity?.commandId ?? clock.uuid(),
    commandType: 'message.send',
    correlationId: identity?.correlationId ?? clock.uuid(),
    sentAt: clock.now().toISOString(),
    payload: {
      conversationId,
      clientMessageId: identity?.clientMessageId ?? clock.uuid(),
      type: 'TEXT',
      content,
    },
  })
}
