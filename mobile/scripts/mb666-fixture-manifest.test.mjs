import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import {
  findScene,
  readManifest,
  validateManifest,
} from './mb666-fixture-manifest.mjs'
import { prepareFixtureScene } from './prepare-mb666-fixture.mjs'

test('the committed manifest covers both synthetic personas and every required screen', () => {
  const manifest = validateManifest(readManifest())
  assert.deepEqual(
    manifest.personas.map((persona) => persona.id),
    ['persona-a', 'persona-b'],
  )
  assert.equal(
    findScene(manifest, 'persona-a-reassessment-change').scene
      .preseededHistoryDays,
    14,
  )
  assert.equal(
    findScene(manifest, 'persona-b-authorized-chat').scene.required,
    false,
  )
})

test('manifest validation rejects a missing required evidence screen', () => {
  const manifest = structuredClone(readManifest())
  manifest.requiredScreens.push('UNMAPPED_SCREEN')
  assert.throws(() => validateManifest(manifest), /UNMAPPED_SCREEN/)
})

test('fixture preparation sends a protected reset request and stores only a sanitized receipt', async () => {
  const manifest = validateManifest(readManifest())
  const { persona, scene } = findScene(manifest, 'persona-a-reassessment-keep')
  let authorization = ''
  const server = createServer((request, response) => {
    authorization = request.headers.authorization ?? ''
    let body = ''
    request.setEncoding('utf8')
    request.on('data', (chunk) => {
      body += chunk
    })
    request.on('end', () => {
      const command = JSON.parse(body)
      response.writeHead(200, { 'Content-Type': 'application/json' })
      response.end(
        JSON.stringify({
          schemaVersion: 'mb-666-fixture-control-v1',
          state: 'READY',
          datasetVersion: command.datasetVersion,
          personaId: command.personaId,
          sceneId: command.sceneId,
          resetProfile: command.resetProfile,
          preseededHistoryDays: scene.preseededHistoryDays,
          snapshotId: 'snapshot-persona-a-keep-v1',
        }),
      )
    })
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  try {
    const address = server.address()
    assert.notEqual(address, null)
    const evidenceDirectory = mkdtempSync(join(tmpdir(), 'mb666-evidence-'))
    const secret = 'fixture-control-secret-value'
    const environment = {
      MB666_FIXTURE_CONTROL_URL: `http://127.0.0.1:${address.port}/reset`,
      MB666_ALLOW_HTTP_FIXTURE_CONTROL: 'true',
      MB666_FIXTURE_CONTROL_TOKEN: secret,
      FIXTURE_DATASET_VERSION: 'mb666-dataset-v1',
      EVIDENCE_COMMIT_SHA: 'a'.repeat(40),
      BACKEND_COMMIT_SHA: 'b'.repeat(40),
      NATIVE_EVIDENCE_DIR: evidenceDirectory,
    }
    const receipt = await prepareFixtureScene(scene.id, {
      environment,
      manifest,
    })
    assert.equal(authorization, `Bearer ${secret}`)
    assert.equal(receipt.personaId, persona.id)
    const stored = readFileSync(
      join(evidenceDirectory, `mb-666-fixture-${scene.id}.json`),
      'utf8',
    )
    assert.doesNotMatch(stored, new RegExp(secret))
    assert.match(stored, /snapshot-persona-a-keep-v1/)
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    )
  }
})
