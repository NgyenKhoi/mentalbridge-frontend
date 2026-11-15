import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'

import { captureScreenshot } from './capture-mb666-screenshot.mjs'
import { validatePngBuffer } from './mb666-evidence-validation.mjs'
import {
  findScene,
  readManifest,
  validateManifest,
} from './mb666-fixture-manifest.mjs'
import { prepareFixtureScene } from './prepare-mb666-fixture.mjs'
import { verifyContinuousPersona } from './verify-mb666-continuous-persona.mjs'
import { writeEvidenceIndex } from './write-mb666-evidence-index.mjs'

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
)

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
  assert.equal(
    findScene(manifest, 'persona-a-owner-rewards').scene.required,
    false,
  )
  assert.equal(
    findScene(manifest, 'persona-a-bingo-progress').scene.required,
    true,
  )
})

test('manifest validation rejects a missing required evidence screen', () => {
  const manifest = structuredClone(readManifest())
  manifest.requiredScreens.push('UNMAPPED_SCREEN')
  assert.throws(() => validateManifest(manifest), /UNMAPPED_SCREEN/)
})

test('manifest rejects empty and mislabelled per-screen evidence', () => {
  const empty = structuredClone(readManifest())
  empty.requiredScreens = []
  assert.throws(() => validateManifest(empty), /must not be empty/)

  const mismatched = structuredClone(readManifest())
  const scene = findScene(mismatched, 'persona-a-home-plan').scene
  scene.evidence[0].screen = 'WRONG_SCREEN'
  assert.throws(() => validateManifest(mismatched), /HOME/)
})

test('continuous Persona A owns one reset and the ordered authority narrative', () => {
  const manifest = validateManifest(readManifest())
  const { scene } = findScene(manifest, 'persona-a-continuous-core-loop')
  assert.equal(scene.executionMode, 'continuous')
  assert.equal(scene.resetPolicy, 'ONCE_BEFORE_FLOW')
  assert.deepEqual(scene.expectedAuthorityTransitions, [
    'INITIAL_CHECK_COMPLETED',
    'GUIDE_NEXT_STEP_OPENED',
    'ACTIVE_PLAN_CONFIRMED',
    'PLAN_ACTION_COMPLETED',
    'RETURN_TO_PLAN_RECONCILED',
    'REASSESSMENT_SELF_REPORT_SUBMITTED',
    'KEEP_OR_CHANGE_CONFIRMED',
  ])
  const flow = readFileSync(
    new URL('../.maestro/mb-666-persona-a-continuous.yaml', import.meta.url),
    'utf8',
  )
  assert.equal(flow.match(/clearState:\s*true/g)?.length, 1)
  assert.doesNotMatch(flow, /runFlow:/)
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
          frontendCommitSha: command.frontendCommitSha,
          backendCommitSha: command.backendCommitSha,
          backendContractTree: command.backendContractTree,
          stagingDeploymentId: command.stagingDeploymentId,
          evidenceRunId: command.evidenceRunId,
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
      BACKEND_CONTRACT_TREE: 'c'.repeat(40),
      STAGING_DEPLOYMENT_ID: 'staging-deployment-666',
      MB666_EVIDENCE_RUN_ID: 'run-666-1',
      MB666_EVIDENCE_RUN_DIR: evidenceDirectory,
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

function testEnvironment(
  runDirectory,
  provenancePath,
  mode = 'automated-emulator',
) {
  return {
    MB666_FIXTURE_CONTROL_URL: 'https://fixture.test/reset',
    MB666_FIXTURE_CONTROL_TOKEN: 'secret',
    FIXTURE_DATASET_VERSION: 'mb666-dataset-v2',
    EVIDENCE_COMMIT_SHA: 'a'.repeat(40),
    BACKEND_COMMIT_SHA: 'b'.repeat(40),
    BACKEND_CONTRACT_TREE: 'c'.repeat(40),
    STAGING_DEPLOYMENT_ID: 'staging-deployment-666',
    GITHUB_RUN_ID: '666001',
    GITHUB_RUN_ATTEMPT: '1',
    MB666_EVIDENCE_RUN_ID: '666001-1',
    MB666_EVIDENCE_RUN_DIR: runDirectory,
    MB666_MILESTONE_PROVENANCE_PATH: provenancePath,
    MB666_EVIDENCE_MODE: mode,
  }
}

test('fixture preparation rejects missing or mismatched deployment provenance', async () => {
  const manifest = validateManifest(readManifest())
  const environment = testEnvironment('unused', 'unused')
  const { scene, persona } = findScene(manifest, 'persona-a-home-plan')
  const fetchImpl = async (_url, request) => {
    const command = JSON.parse(request.body)
    return {
      ok: true,
      async json() {
        return {
          schemaVersion: 'mb-666-fixture-control-v1',
          state: 'READY',
          datasetVersion: command.datasetVersion,
          personaId: persona.id,
          sceneId: scene.id,
          resetProfile: scene.resetProfile,
          preseededHistoryDays: scene.preseededHistoryDays,
          snapshotId: 'mismatched-snapshot',
          frontendCommitSha: command.frontendCommitSha,
          backendCommitSha: 'd'.repeat(40),
          backendContractTree: command.backendContractTree,
          stagingDeploymentId: command.stagingDeploymentId,
          evidenceRunId: command.evidenceRunId,
        }
      },
    }
  }
  await assert.rejects(
    prepareFixtureScene(scene.id, {
      environment,
      fetchImpl,
      manifest,
      writeReceipt: false,
    }),
    /mismatched receipt/,
  )
})

test('continuous Persona A verification requires one identity and exact ordered authority transitions', async () => {
  const manifest = validateManifest(readManifest())
  const directory = mkdtempSync(join(tmpdir(), 'mb666-continuous-'))
  const environment = testEnvironment(directory, 'unused')
  environment.MB666_ALLOW_HTTP_FIXTURE_CONTROL = 'true'
  const scene = findScene(manifest, 'persona-a-continuous-core-loop').scene
  const fixtureReceipt = {
    evidenceRunId: environment.MB666_EVIDENCE_RUN_ID,
    frontendCommitSha: environment.EVIDENCE_COMMIT_SHA,
    backendCommitSha: environment.BACKEND_COMMIT_SHA,
    backendContractTree: environment.BACKEND_CONTRACT_TREE,
    stagingDeploymentId: environment.STAGING_DEPLOYMENT_ID,
    datasetVersion: environment.FIXTURE_DATASET_VERSION,
    journeyId: 'persona-a-journey-1',
    subjectBindingHash: 'e'.repeat(64),
  }
  writeFileSync(
    join(directory, 'mb-666-fixture-persona-a-continuous-core-loop.json'),
    JSON.stringify(fixtureReceipt),
  )
  const server = createServer((request, response) => {
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
          ...command,
          schemaVersion: 'mb-666-continuous-verification-v1',
          state: 'VERIFIED',
          singleBoundIdentity: true,
          backendResetCount: 1,
          webHandoffCount: 0,
          authorityTransitions: scene.expectedAuthorityTransitions,
        }),
      )
    })
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  try {
    const address = server.address()
    environment.MB666_FIXTURE_CONTROL_URL = `http://127.0.0.1:${address.port}/verify`
    const receipt = await verifyContinuousPersona({ environment, manifest })
    assert.equal(receipt.singleBoundIdentity, true)
    assert.equal(receipt.backendResetCount, 1)
    assert.deepEqual(
      receipt.authorityTransitions,
      scene.expectedAuthorityTransitions,
    )
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    )
  }
})

test('screenshot capture fails on adb errors, empty PNGs, invalid PNGs and stale destinations', () => {
  assert.throws(
    () =>
      captureScreenshot('emulator-5554', 'unused.png', {
        spawnImpl: () => ({ status: 1, stdout: Buffer.alloc(0) }),
      }),
    /adb screencap failed/,
  )
  assert.throws(
    () =>
      captureScreenshot('emulator-5554', 'unused.png', {
        spawnImpl: () => ({ status: 0, stdout: Buffer.alloc(0) }),
      }),
    /empty or too small/,
  )
  assert.throws(
    () =>
      captureScreenshot('emulator-5554', 'unused.png', {
        spawnImpl: () => ({ status: 0, stdout: Buffer.alloc(80, 1) }),
      }),
    /invalid PNG signature/,
  )
  validatePngBuffer(png)
  const directory = mkdtempSync(join(tmpdir(), 'mb666-stale-'))
  const output = join(directory, 'already-exists.png')
  writeFileSync(output, png)
  assert.throws(
    () =>
      captureScreenshot('emulator-5554', output, {
        spawnImpl: () => ({ status: 0, stdout: png }),
      }),
    /EEXIST/,
  )
})

function createEvidenceRun({
  missingFile,
  emptyFile,
  mismatchedFilename = false,
  mismatchedProvenance = false,
  mode = 'automated-emulator',
  deviceClass = 'emulator',
} = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'mb666-index-'))
  const provenancePath = join(directory, 'milestone-provenance.json')
  const environment = testEnvironment(directory, provenancePath, mode)
  const manifest = validateManifest(readManifest())
  const provenance = {
    schemaVersion: 'mb-662-staging-provenance-v1',
    frontendCommitSha: mismatchedProvenance
      ? 'f'.repeat(40)
      : environment.EVIDENCE_COMMIT_SHA,
    backendCommitSha: environment.BACKEND_COMMIT_SHA,
    backendContractTree: environment.BACKEND_CONTRACT_TREE,
    stagingDeploymentId: environment.STAGING_DEPLOYMENT_ID,
    fixtureDatasetVersion: environment.FIXTURE_DATASET_VERSION,
    githubRunId: environment.GITHUB_RUN_ID,
    githubRunAttempt: environment.GITHUB_RUN_ATTEMPT,
  }
  writeFileSync(provenancePath, JSON.stringify(provenance))
  const rows = []
  for (const persona of manifest.personas) {
    for (const scene of persona.scenes) {
      const expectedFiles = scene.evidence.map(({ file }) => file)
      const status = scene.required ? 'PASS' : 'DEFERRED'
      const reportedFiles =
        mismatchedFilename && scene.id === 'persona-a-home-plan'
          ? ['mb-666-wrong-name.png']
          : expectedFiles
      rows.push([scene.id, status, 1, reportedFiles.join(',')].join('\t'))
      if (status !== 'PASS') continue
      for (const file of expectedFiles) {
        if (file === missingFile) continue
        writeFileSync(resolve(directory, file), file === emptyFile ? '' : png)
      }
      writeFileSync(
        resolve(directory, `mb-666-fixture-${scene.id}.json`),
        JSON.stringify({
          schemaVersion: 'mb-666-fixture-receipt-v1',
          state: 'READY',
          sceneId: scene.id,
          personaId: persona.id,
          preseededHistoryDays: scene.preseededHistoryDays,
          evidenceRunId: environment.MB666_EVIDENCE_RUN_ID,
          frontendCommitSha: environment.EVIDENCE_COMMIT_SHA,
          backendCommitSha: environment.BACKEND_COMMIT_SHA,
          backendContractTree: environment.BACKEND_CONTRACT_TREE,
          stagingDeploymentId: environment.STAGING_DEPLOYMENT_ID,
          datasetVersion: environment.FIXTURE_DATASET_VERSION,
        }),
      )
    }
  }
  writeFileSync(
    join(directory, 'mb-666-journey-status.tsv'),
    `${rows.join('\n')}\n`,
  )
  const continuous = findScene(manifest, 'persona-a-continuous-core-loop').scene
  writeFileSync(
    join(directory, 'mb-666-continuous-persona-verification.json'),
    JSON.stringify({
      schemaVersion: 'mb-666-continuous-verification-receipt-v1',
      state: 'VERIFIED',
      evidenceRunId: environment.MB666_EVIDENCE_RUN_ID,
      frontendCommitSha: environment.EVIDENCE_COMMIT_SHA,
      backendCommitSha: environment.BACKEND_COMMIT_SHA,
      backendContractTree: environment.BACKEND_CONTRACT_TREE,
      stagingDeploymentId: environment.STAGING_DEPLOYMENT_ID,
      datasetVersion: environment.FIXTURE_DATASET_VERSION,
      journeyId: 'persona-a-journey-1',
      subjectBindingHash: 'e'.repeat(64),
      singleBoundIdentity: true,
      backendResetCount: 1,
      webHandoffCount: 0,
      authorityTransitions: continuous.expectedAuthorityTransitions,
    }),
  )
  writeFileSync(
    join(directory, 'mb-666-device-receipt.json'),
    JSON.stringify({
      schemaVersion: 'mb-666-device-receipt-v1',
      evidenceRunId: environment.MB666_EVIDENCE_RUN_ID,
      evidenceMode: mode,
      deviceClass,
      serialSha256: 'e'.repeat(64),
      model: 'test-device',
      sdk: '36',
    }),
  )
  return { directory, environment, manifest }
}

test('evidence index accepts valid isolated screenshots but keeps emulator UX claims unverified', () => {
  const fixture = createEvidenceRun()
  const index = writeEvidenceIndex(fixture)
  assert.equal(index.result, 'STAGING_PASS_EMULATOR')
  assert.equal(index.claimBoundary.physicalAndroidAcceptance, 'NOT_VERIFIED')
  assert.equal(index.claimBoundary.usabilityCohort, 'NOT_VERIFIED')
  assert.equal(
    index.claimBoundary.containsProductionPersonalData,
    'NOT_VERIFIED',
  )
})

test('evidence index rejects missing, empty and mismatched per-screen artifacts', () => {
  const missing = createEvidenceRun({
    missingFile: 'mb-666-persona-a-home-plan.png',
  })
  assert.throws(() => writeEvidenceIndex(missing), /missing/)

  const empty = createEvidenceRun({
    emptyFile: 'mb-666-persona-a-home-plan.png',
  })
  assert.throws(() => writeEvidenceIndex(empty), /empty or too small/)

  const mismatch = createEvidenceRun({ mismatchedFilename: true })
  assert.throws(() => writeEvidenceIndex(mismatch), /filenames do not match/)
})

test('evidence index rejects mismatched provenance and emulator-only physical claims', () => {
  const provenance = createEvidenceRun({ mismatchedProvenance: true })
  assert.throws(
    () => writeEvidenceIndex(provenance),
    /frontendCommitSha does not match/,
  )

  const physical = createEvidenceRun({
    mode: 'physical-acceptance',
    deviceClass: 'emulator',
  })
  assert.throws(
    () => writeEvidenceIndex(physical),
    /Physical acceptance refuses emulator-only evidence/,
  )
})
