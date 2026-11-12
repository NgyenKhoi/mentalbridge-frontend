import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import {
  findScene,
  readManifest,
  validateManifest,
} from './mb666-fixture-manifest.mjs'

const shaPattern = /^[0-9a-f]{40}$/i
const safeIdentifier = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,127}$/
const runIdentifier = /^[A-Za-z0-9][A-Za-z0-9._:@-]{0,127}$/
const subjectHashPattern = /^[0-9a-f]{64}$/i

function required(environment, name, pattern = /\S/) {
  const value = environment[name] ?? ''
  if (!pattern.test(value)) throw new Error(`${name} is missing or invalid.`)
  return value
}

export function fixtureControlUrl(environment) {
  const raw = required(environment, 'MB666_FIXTURE_CONTROL_URL')
  const url = new URL(raw)
  const loopback = ['127.0.0.1', 'localhost', '::1'].includes(url.hostname)
  if (
    url.protocol !== 'https:' &&
    !(loopback && environment.MB666_ALLOW_HTTP_FIXTURE_CONTROL === 'true')
  ) {
    throw new Error(
      'Fixture control must use HTTPS; HTTP is allowed only for an explicit loopback test.',
    )
  }
  return url
}

export async function prepareFixtureScene(
  sceneId,
  {
    environment = process.env,
    fetchImpl = fetch,
    writeReceipt = true,
    manifest = validateManifest(readManifest()),
  } = {},
) {
  const { persona, scene } = findScene(manifest, sceneId)
  const datasetVersion = required(
    environment,
    manifest.datasetVersionEnvironment,
    safeIdentifier,
  )
  const frontendCommitSha = required(
    environment,
    'EVIDENCE_COMMIT_SHA',
    shaPattern,
  )
  const backendCommitSha = required(
    environment,
    'BACKEND_COMMIT_SHA',
    shaPattern,
  )
  const backendContractTree = required(
    environment,
    'BACKEND_CONTRACT_TREE',
    shaPattern,
  )
  const stagingDeploymentId = required(
    environment,
    'STAGING_DEPLOYMENT_ID',
    safeIdentifier,
  )
  const evidenceRunId = required(
    environment,
    'MB666_EVIDENCE_RUN_ID',
    runIdentifier,
  )
  const token = required(environment, manifest.fixtureControl.tokenEnvironment)
  const response = await fetchImpl(fixtureControlUrl(environment), {
    method: 'POST',
    redirect: 'error',
    signal: AbortSignal.timeout(30_000),
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      schemaVersion: 'mb-666-fixture-control-request-v1',
      action: 'RESET_SCENE',
      datasetVersion,
      personaId: persona.id,
      sceneId: scene.id,
      resetProfile: scene.resetProfile,
      frontendCommitSha,
      backendCommitSha,
      backendContractTree,
      stagingDeploymentId,
      evidenceRunId,
    }),
  })
  if (!response.ok) {
    throw new Error(
      `Fixture control rejected ${scene.id}: HTTP ${response.status}.`,
    )
  }
  const result = await response.json()
  if (
    result?.schemaVersion !== 'mb-666-fixture-control-v1' ||
    result?.state !== 'READY' ||
    result?.datasetVersion !== datasetVersion ||
    result?.personaId !== persona.id ||
    result?.sceneId !== scene.id ||
    result?.resetProfile !== scene.resetProfile ||
    result?.preseededHistoryDays !== scene.preseededHistoryDays ||
    result?.frontendCommitSha !== frontendCommitSha ||
    result?.backendCommitSha !== backendCommitSha ||
    result?.backendContractTree !== backendContractTree ||
    result?.stagingDeploymentId !== stagingDeploymentId ||
    result?.evidenceRunId !== evidenceRunId ||
    !safeIdentifier.test(result?.snapshotId ?? '')
  ) {
    throw new Error(
      `Fixture control returned a mismatched receipt for ${scene.id}.`,
    )
  }
  if (
    scene.executionMode === 'continuous' &&
    (!safeIdentifier.test(result?.journeyId ?? '') ||
      !subjectHashPattern.test(result?.subjectBindingHash ?? ''))
  ) {
    throw new Error(
      `Fixture control omitted the continuous identity binding for ${scene.id}.`,
    )
  }

  const receipt = {
    schemaVersion: 'mb-666-fixture-receipt-v1',
    datasetVersion,
    personaId: persona.id,
    sceneId: scene.id,
    resetProfile: scene.resetProfile,
    snapshotId: result.snapshotId,
    journeyId: result.journeyId ?? null,
    subjectBindingHash: result.subjectBindingHash ?? null,
    preseededHistoryDays: scene.preseededHistoryDays,
    frontendCommitSha,
    backendCommitSha,
    backendContractTree,
    stagingDeploymentId,
    evidenceRunId,
    state: 'READY',
  }
  if (writeReceipt) {
    const evidenceDirectory = resolve(
      process.cwd(),
      environment.MB666_EVIDENCE_RUN_DIR ?? 'native-evidence',
    )
    mkdirSync(evidenceDirectory, { recursive: true })
    writeFileSync(
      resolve(evidenceDirectory, `mb-666-fixture-${scene.id}.json`),
      `${JSON.stringify(receipt, null, 2)}\n`,
      'utf8',
    )
  }
  return receipt
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const sceneId = process.argv[2]
  if (!sceneId)
    throw new Error('Usage: node scripts/prepare-mb666-fixture.mjs <scene-id>')
  await prepareFixtureScene(sceneId)
  console.log(`Prepared protected synthetic fixture scene ${sceneId}.`)
}
