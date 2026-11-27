import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const shaPattern = /^[0-9a-f]{40}$/i
const identifierPattern = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,127}$/

function requireValue(name, pattern) {
  const value = process.env[name] ?? ''
  if (!pattern.test(value)) {
    throw new Error(`${name} is missing or is not a safe immutable identifier.`)
  }
  return value
}

const evidenceDirectory = resolve(
  process.cwd(),
  process.env.NATIVE_EVIDENCE_DIR ?? 'native-evidence',
)
const provenance = {
  schemaVersion: 'mb-662-staging-provenance-v1',
  frontendCommitSha: requireValue('EVIDENCE_COMMIT_SHA', shaPattern),
  backendCommitSha: requireValue('BACKEND_COMMIT_SHA', shaPattern),
  backendContractTree: requireValue('BACKEND_CONTRACT_TREE', shaPattern),
  stagingDeploymentId: requireValue('STAGING_DEPLOYMENT_ID', identifierPattern),
  fixtureDatasetVersion: requireValue(
    'FIXTURE_DATASET_VERSION',
    identifierPattern,
  ),
  githubRunId: requireValue('GITHUB_RUN_ID', /^\d+$/),
  githubRunAttempt: requireValue('GITHUB_RUN_ATTEMPT', /^\d+$/),
}

mkdirSync(evidenceDirectory, { recursive: true })
writeFileSync(
  resolve(evidenceDirectory, 'milestone-provenance.json'),
  `${JSON.stringify(provenance, null, 2)}\n`,
  'utf8',
)
console.log('Wrote sanitized staging milestone provenance.')
