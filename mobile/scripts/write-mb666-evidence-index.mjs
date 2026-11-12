import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { readManifest, validateManifest } from './mb666-fixture-manifest.mjs'

const evidenceDirectory = resolve(
  process.cwd(),
  process.env.NATIVE_EVIDENCE_DIR ?? 'native-evidence',
)
const statusPath = resolve(evidenceDirectory, 'mb-666-journey-status.tsv')
const provenancePath = resolve(evidenceDirectory, 'milestone-provenance.json')
const manifest = validateManifest(readManifest())

mkdirSync(evidenceDirectory, { recursive: true })
const provenance = existsSync(provenancePath)
  ? JSON.parse(readFileSync(provenancePath, 'utf8'))
  : {
      schemaVersion: 'mb-662-staging-provenance-v1',
      frontendCommitSha: process.env.EVIDENCE_COMMIT_SHA ?? 'missing',
      backendCommitSha: process.env.BACKEND_COMMIT_SHA ?? 'missing',
      fixtureDatasetVersion: process.env.FIXTURE_DATASET_VERSION ?? 'missing',
    }
const statuses = existsSync(statusPath)
  ? readFileSync(statusPath, 'utf8')
      .trim()
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        const [sceneId, status, durationSeconds, evidenceFile] =
          line.split('\t')
        return {
          sceneId,
          status,
          durationSeconds: Number(durationSeconds),
          evidenceFile,
        }
      })
  : []

const byScene = new Map(statuses.map((status) => [status.sceneId, status]))
const scenes = manifest.personas.flatMap((persona) =>
  persona.scenes.map((scene) => {
    const result = byScene.get(scene.id) ?? {
      sceneId: scene.id,
      status: scene.required ? 'STAGING_FAIL' : 'DEFERRED',
      durationSeconds: 0,
      evidenceFile: scene.evidenceFile,
    }
    return {
      ...result,
      personaId: persona.id,
      required: scene.required,
      stories: scene.stories,
      preseededHistoryDays: scene.preseededHistoryDays,
      evidencePresent: existsSync(
        resolve(evidenceDirectory, scene.evidenceFile),
      ),
    }
  }),
)
const requiredFailure = scenes.some(
  (scene) =>
    scene.required &&
    (scene.status !== 'STAGING_PASS' || !scene.evidencePresent),
)
const index = {
  schemaVersion: 'mb-666-evidence-index-v1',
  result: requiredFailure ? 'STAGING_FAIL' : 'STAGING_PASS',
  provenance,
  personas: manifest.personas.map(({ id, label, synthetic }) => ({
    id,
    label,
    synthetic,
  })),
  scenes,
  claimBoundary: {
    preseededHistoryIsNotLiveElapsedTime: true,
    containsProductionPersonalData: false,
    usabilityCohortRecordedSeparately: true,
  },
}
writeFileSync(
  resolve(evidenceDirectory, 'mb-666-evidence-index.json'),
  `${JSON.stringify(index, null, 2)}\n`,
  'utf8',
)
console.log(`Wrote MB-666 evidence index with result ${index.result}.`)
if (requiredFailure) process.exitCode = 1
