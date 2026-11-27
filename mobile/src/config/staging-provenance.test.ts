import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const script = resolve(__dirname, '../../scripts/write-staging-provenance.mjs')
const frontendSha = '0123456789abcdef0123456789abcdef01234567'
const backendSha = 'abcdef0123456789abcdef0123456789abcdef01'
const contractTree = '1111111111111111111111111111111111111111'

describe('staging milestone provenance', () => {
  const evidenceDirectory = mkdtempSync(resolve(tmpdir(), 'mb-662-provenance-'))

  afterAll(() => rmSync(evidenceDirectory, { recursive: true, force: true }))

  it('writes only immutable, non-secret milestone identifiers', () => {
    const result = spawnSync(process.execPath, [script], {
      encoding: 'utf8',
      cwd: resolve(__dirname, '../..'),
      env: {
        ...process.env,
        NATIVE_EVIDENCE_DIR: evidenceDirectory,
        EVIDENCE_COMMIT_SHA: frontendSha,
        BACKEND_COMMIT_SHA: backendSha,
        BACKEND_CONTRACT_TREE: contractTree,
        STAGING_DEPLOYMENT_ID: 'staging-2026.10.27.1',
        FIXTURE_DATASET_VERSION: 'mobile-e2e-v4',
        GITHUB_RUN_ID: '123456',
        GITHUB_RUN_ATTEMPT: '2',
        MAESTRO_MB_USER_PASSWORD: 'must-not-appear',
      },
    })

    expect(result.status).toBe(0)
    const contents = readFileSync(
      resolve(evidenceDirectory, 'milestone-provenance.json'),
      'utf8',
    )
    expect(JSON.parse(contents)).toEqual({
      schemaVersion: 'mb-662-staging-provenance-v1',
      frontendCommitSha: frontendSha,
      backendCommitSha: backendSha,
      backendContractTree: contractTree,
      stagingDeploymentId: 'staging-2026.10.27.1',
      fixtureDatasetVersion: 'mobile-e2e-v4',
      githubRunId: '123456',
      githubRunAttempt: '2',
    })
    expect(contents).not.toContain('must-not-appear')
  })

  it('fails closed for mutable or unsafe provenance values', () => {
    const result = spawnSync(process.execPath, [script], {
      encoding: 'utf8',
      cwd: resolve(__dirname, '../..'),
      env: {
        ...process.env,
        NATIVE_EVIDENCE_DIR: evidenceDirectory,
        EVIDENCE_COMMIT_SHA: 'dev',
        BACKEND_COMMIT_SHA: backendSha,
        BACKEND_CONTRACT_TREE: contractTree,
        STAGING_DEPLOYMENT_ID: 'staging latest',
        FIXTURE_DATASET_VERSION: 'mobile-e2e-v4',
        GITHUB_RUN_ID: '123456',
        GITHUB_RUN_ATTEMPT: '2',
      },
    })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('safe immutable identifier')
  })
})
