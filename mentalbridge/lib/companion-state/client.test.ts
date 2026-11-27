// @vitest-environment node
import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { mockServer } from '@/tests/mocks/server'
import { companionStateClient } from './client'

const baseUrl = 'http://journal.test'
const id = '30000000-0000-4000-8000-000000000001'
const stamp = '2026-11-27T02:00:00.000Z'
const commitment = {
  id,
  kind: 'REST' as const,
  minutes: 5 as const,
  dueOn: '2026-11-28',
  source: 'HOME' as const,
  status: 'OPEN' as const,
  createdAt: stamp,
  resolvedAt: null,
}
const state = {
  focus: { goal: 'SLEEP' as const, chosenOn: '2026-11-27' },
  chapters: [],
  commitments: [commitment],
  ui: { guide: null, seen: ['declined:abc'] },
  revision: 3,
}

describe('Companion state server-only client', () => {
  afterEach(() => vi.unstubAllEnvs())

  const configure = () => {
    vi.stubEnv('JOURNAL_AI_SERVICE_URL', baseUrl)
    vi.stubEnv('JOURNAL_AI_SERVICE_TIMEOUT_MS', '5000')
  }

  it('reads the state with the server-held credential', async () => {
    configure()
    mockServer.use(
      http.get(`${baseUrl}/api/v1/companion-state`, ({ request }) => {
        expect(request.headers.get('authorization')).toBe('Bearer access-token')
        expect(request.headers.get('x-correlation-id')).toBe('correlation-id')
        return HttpResponse.json(state)
      }),
    )

    await expect(
      companionStateClient.get('access-token', 'correlation-id'),
    ).resolves.toEqual(state)
  })

  it('sends a partial update and a new commitment', async () => {
    configure()
    mockServer.use(
      http.patch(`${baseUrl}/api/v1/companion-state`, async ({ request }) => {
        expect(await request.json()).toEqual({ seenAdd: ['declined:abc'] })
        return HttpResponse.json(state)
      }),
      http.post(
        `${baseUrl}/api/v1/companion-state/commitments`,
        async ({ request }) => {
          expect(await request.json()).toMatchObject({ kind: 'REST' })
          return HttpResponse.json(commitment, { status: 201 })
        },
      ),
    )

    await expect(
      companionStateClient.update('t', { seenAdd: ['declined:abc'] }, 'c'),
    ).resolves.toEqual(state)
    await expect(
      companionStateClient.createCommitment(
        't',
        { kind: 'REST', minutes: 5, dueOn: '2026-11-28', source: 'HOME' },
        'c',
      ),
    ).resolves.toEqual(commitment)
  })

  it('keeps the upstream problem code on a 409', async () => {
    configure()
    mockServer.use(
      http.patch(`${baseUrl}/api/v1/companion-state/commitments/${id}`, () =>
        HttpResponse.json(
          {
            type: '/problems/commitment-resolved',
            title: 'Already resolved',
            status: 409,
            code: 'COMMITMENT_RESOLVED',
            correlationId: 'provider-correlation',
          },
          {
            status: 409,
            headers: { 'content-type': 'application/problem+json' },
          },
        ),
      ),
    )

    await expect(
      companionStateClient.resolveCommitment('t', id, { status: 'DONE' }, 'c'),
    ).rejects.toMatchObject({ code: 'COMMITMENT_RESOLVED', status: 409 })
  })

  it('rejects a response that is not a companion state', async () => {
    configure()
    mockServer.use(
      http.get(`${baseUrl}/api/v1/companion-state`, () =>
        HttpResponse.json({ ...state, revision: 'three' }),
      ),
    )

    await expect(companionStateClient.get('t', 'c')).rejects.toMatchObject({
      code: 'COMPANION_STATE_MALFORMED_RESPONSE',
    })
  })

  it('reports an unknown outcome when a write cannot be confirmed', async () => {
    configure()
    mockServer.use(
      http.patch(`${baseUrl}/api/v1/companion-state`, () =>
        HttpResponse.error(),
      ),
    )

    await expect(
      companionStateClient.update('t', { guide: null }, 'c'),
    ).rejects.toMatchObject({
      code: 'COMPANION_STATE_MUTATION_OUTCOME_UNKNOWN',
    })
  })
})
