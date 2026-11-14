import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import {
  findScene,
  readManifest,
  validateManifest,
} from './mb666-fixture-manifest.mjs'
import { fixtureControlUrl } from './prepare-mb666-fixture.mjs'

const safeIdentifier = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,127}$/
const subjectHashPattern = /^[0-9a-f]{64}$/i

function required(environment, name, pattern = /\S/) {
  const value = environment[name] ?? ''
  if (!pattern.test(value)) throw new Error(`${name} is missing or invalid.`)
  return value
}

export async function verifyContinuousPersona({
  environment = process.env,
  fetchImpl = fetch,
  manifest = validateManifest(readManifest()),
} = {}) {
  const sceneId = 'persona-a-continuous-core-loop'
  const { scene } = findScene(manifest, sceneId)
  const runDirectory = resolve(
    process.cwd(),
    required(environment, 'MB666_EVIDENCE_RUN_DIR'),
  )
  const fixtureReceipt = JSON.parse(
    readFileSync(
      resolve(runDirectory, `mb-666-fixture-${sceneId}.json`),
      'utf8',
    ),
  )
  if (
    !safeIdentifier.test(fixtureReceipt.journeyId ?? '') ||
    !subjectHashPattern.test(fixtureReceipt.subjectBindingHash ?? '')
  ) {
    throw new Error(
      'Continuous Persona A fixture receipt is not identity-bound.',
    )
  }

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
      action: 'VERIFY_CONTINUOUS_PERSONA',
      sceneId,
      journeyId: fixtureReceipt.journeyId,
      subjectBindingHash: fixtureReceipt.subjectBindingHash,
      evidenceRunId: fixtureReceipt.evidenceRunId,
      frontendCommitSha: fixtureReceipt.frontendCommitSha,
      backendCommitSha: fixtureReceipt.backendCommitSha,
      backendContractTree: fixtureReceipt.backendContractTree,
      stagingDeploymentId: fixtureReceipt.stagingDeploymentId,
      datasetVersion: fixtureReceipt.datasetVersion,
    }),
  })
  if (!response.ok) {
    throw new Error(
      `Continuous Persona A verification failed: HTTP ${response.status}.`,
    )
  }
  const result = await response.json()
  const expectedTransitions = scene.expectedAuthorityTransitions
  const transitionsMatch =
    Array.isArray(result?.authorityTransitions) &&
    result.authorityTransitions.length === expectedTransitions.length &&
    result.authorityTransitions.every(
      (transition, index) => transition === expectedTransitions[index],
    )
  const exactBindings = [
    'journeyId',
    'subjectBindingHash',
    'evidenceRunId',
    'frontendCommitSha',
    'backendCommitSha',
    'backendContractTree',
    'stagingDeploymentId',
    'datasetVersion',
  ].every((key) => result?.[key] === fixtureReceipt[key])
  if (
    result?.schemaVersion !== 'mb-666-continuous-verification-v1' ||
    result?.state !== 'VERIFIED' ||
    result?.singleBoundIdentity !== true ||
    result?.backendResetCount !== 1 ||
    result?.webHandoffCount !== 0 ||
    !exactBindings ||
    !transitionsMatch
  ) {
    throw new Error(
      'Continuous Persona A verification did not prove one identity and the ordered authority transitions.',
    )
  }

  const receipt = {
    schemaVersion: 'mb-666-continuous-verification-receipt-v1',
    state: 'VERIFIED',
    sceneId,
    journeyId: fixtureReceipt.journeyId,
    subjectBindingHash: fixtureReceipt.subjectBindingHash,
    evidenceRunId: fixtureReceipt.evidenceRunId,
    frontendCommitSha: fixtureReceipt.frontendCommitSha,
    backendCommitSha: fixtureReceipt.backendCommitSha,
    backendContractTree: fixtureReceipt.backendContractTree,
    stagingDeploymentId: fixtureReceipt.stagingDeploymentId,
    datasetVersion: fixtureReceipt.datasetVersion,
    singleBoundIdentity: true,
    backendResetCount: 1,
    webHandoffCount: 0,
    authorityTransitions: expectedTransitions,
  }
  writeFileSync(
    resolve(runDirectory, 'mb-666-continuous-persona-verification.json'),
    `${JSON.stringify(receipt, null, 2)}\n`,
    { encoding: 'utf8', flag: 'wx' },
  )
  return receipt
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  await verifyContinuousPersona()
  console.log('Verified the continuous Persona A authority narrative.')
}
