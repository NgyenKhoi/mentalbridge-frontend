import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import {
  validateMilestoneProvenance,
  validatePngFile,
  validateUsabilityRecord,
} from './mb666-evidence-validation.mjs'
import { readManifest, validateManifest } from './mb666-fixture-manifest.mjs'

const safeIdentifier = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,127}$/
const runIdentifier = /^[A-Za-z0-9][A-Za-z0-9._:@-]{0,127}$/

function readJson(path, label) {
  if (!existsSync(path)) throw new Error(`${label} is missing.`)
  return JSON.parse(readFileSync(path, 'utf8'))
}

function sameStrings(left, right) {
  const sortedLeft = [...left].sort()
  const sortedRight = [...right].sort()
  return (
    sortedLeft.length === sortedRight.length &&
    sortedLeft.every((value, index) => value === sortedRight[index])
  )
}

function exactReceiptBindings(receipt, provenance, evidenceRunId, label) {
  const expected = {
    evidenceRunId,
    frontendCommitSha: provenance.frontendCommitSha,
    backendCommitSha: provenance.backendCommitSha,
    backendContractTree: provenance.backendContractTree,
    stagingDeploymentId: provenance.stagingDeploymentId,
    datasetVersion: provenance.fixtureDatasetVersion,
  }
  for (const [key, value] of Object.entries(expected)) {
    if (receipt?.[key] !== value) {
      throw new Error(`${label} ${key} does not match provenance.`)
    }
  }
}

function parseStatuses(path) {
  if (!existsSync(path)) throw new Error('MB-666 journey status is missing.')
  const statuses = readFileSync(path, 'utf8')
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const fields = line.split('\t')
      if (fields.length !== 4) {
        throw new Error('Malformed MB-666 journey status row.')
      }
      const [sceneId, status, durationSeconds, evidenceFiles] = fields
      if (!['PASS', 'FAIL', 'DEFERRED'].includes(status)) {
        throw new Error(`Invalid scene status for ${sceneId}.`)
      }
      const duration = Number(durationSeconds)
      if (!Number.isFinite(duration) || duration < 0) {
        throw new Error(`Invalid scene duration for ${sceneId}.`)
      }
      return {
        sceneId,
        status,
        durationSeconds: duration,
        evidenceFiles: evidenceFiles ? evidenceFiles.split(',') : [],
      }
    })
  if (
    new Set(statuses.map(({ sceneId }) => sceneId)).size !== statuses.length
  ) {
    throw new Error('Journey status contains duplicate scenes.')
  }
  return statuses
}

function validateContinuousReceipt(path, scene, provenance, evidenceRunId) {
  const receipt = readJson(path, 'Continuous Persona A verification')
  exactReceiptBindings(receipt, provenance, evidenceRunId, 'Continuous receipt')
  const transitionsMatch =
    Array.isArray(receipt.authorityTransitions) &&
    receipt.authorityTransitions.length ===
      scene.expectedAuthorityTransitions.length &&
    receipt.authorityTransitions.every(
      (transition, index) =>
        transition === scene.expectedAuthorityTransitions[index],
    )
  if (
    receipt.schemaVersion !== 'mb-666-continuous-verification-receipt-v1' ||
    receipt.state !== 'VERIFIED' ||
    receipt.singleBoundIdentity !== true ||
    receipt.backendResetCount !== 1 ||
    receipt.webHandoffCount !== 0 ||
    !safeIdentifier.test(receipt.journeyId ?? '') ||
    !/^[0-9a-f]{64}$/i.test(receipt.subjectBindingHash ?? '') ||
    !transitionsMatch
  ) {
    throw new Error('Continuous Persona A authority narrative is not verified.')
  }
  return receipt
}

function validateSanitizationAttestation(path, expectedFiles, evidenceRunId) {
  const attestation = readJson(path, 'Evidence sanitization attestation')
  if (
    attestation.schemaVersion !== 'mb-666-sanitization-attestation-v1' ||
    attestation.evidenceRunId !== evidenceRunId ||
    attestation.deidentified !== true ||
    attestation.containsProductionPersonalData !== false ||
    !safeIdentifier.test(attestation.reviewerId ?? '') ||
    !sameStrings(attestation.reviewedFiles ?? [], expectedFiles)
  ) {
    throw new Error(
      'Evidence sanitization attestation is incomplete or mismatched.',
    )
  }
  return attestation
}

export function writeEvidenceIndex({
  environment = process.env,
  manifest = validateManifest(readManifest()),
} = {}) {
  const evidenceRunId = environment.MB666_EVIDENCE_RUN_ID ?? ''
  if (!runIdentifier.test(evidenceRunId)) {
    throw new Error('MB666_EVIDENCE_RUN_ID is invalid.')
  }
  const runDirectory = resolve(
    process.cwd(),
    environment.MB666_EVIDENCE_RUN_DIR ?? '',
  )
  const provenancePath = resolve(
    process.cwd(),
    environment.MB666_MILESTONE_PROVENANCE_PATH ?? '',
  )
  const provenance = validateMilestoneProvenance(
    readJson(provenancePath, 'Milestone provenance'),
    environment,
  )
  const statuses = parseStatuses(
    resolve(runDirectory, 'mb-666-journey-status.tsv'),
  )
  const knownScenes = new Set(
    manifest.personas.flatMap((persona) =>
      persona.scenes.map((scene) => scene.id),
    ),
  )
  for (const status of statuses) {
    if (!knownScenes.has(status.sceneId)) {
      throw new Error(`Unknown status scene ${status.sceneId}.`)
    }
  }
  const byScene = new Map(statuses.map((status) => [status.sceneId, status]))
  const validEvidenceFiles = []
  const scenes = manifest.personas.flatMap((persona) =>
    persona.scenes.map((scene) => {
      const result = byScene.get(scene.id) ?? {
        sceneId: scene.id,
        status: scene.required ? 'FAIL' : 'DEFERRED',
        durationSeconds: 0,
        evidenceFiles: scene.evidence.map(({ file }) => file),
      }
      const expectedFiles = scene.evidence.map(({ file }) => file)
      if (!sameStrings(result.evidenceFiles, expectedFiles)) {
        throw new Error(
          `${scene.id} status filenames do not match the manifest.`,
        )
      }
      const evidence = scene.evidence.map(
        ({ screen, step, checkpoint, file }) => {
          const path = resolve(runDirectory, file)
          const present = existsSync(path)
          let validPng = false
          if (result.status === 'PASS') {
            if (!present) throw new Error(`${scene.id} is missing ${file}.`)
            validatePngFile(path, `${scene.id}:${screen}`)
            validPng = true
            validEvidenceFiles.push(file)
          }
          return { screen, step, checkpoint, file, present, validPng }
        },
      )
      if (result.status === 'PASS') {
        const fixtureReceipt = readJson(
          resolve(runDirectory, `mb-666-fixture-${scene.id}.json`),
          `${scene.id} fixture receipt`,
        )
        if (
          fixtureReceipt.schemaVersion !== 'mb-666-fixture-receipt-v1' ||
          fixtureReceipt.state !== 'READY' ||
          fixtureReceipt.sceneId !== scene.id ||
          fixtureReceipt.personaId !== persona.id ||
          fixtureReceipt.preseededHistoryDays !== scene.preseededHistoryDays
        ) {
          throw new Error(
            `${scene.id} fixture receipt is incomplete or mismatched.`,
          )
        }
        exactReceiptBindings(
          fixtureReceipt,
          provenance,
          evidenceRunId,
          `${scene.id} fixture receipt`,
        )
      }
      return {
        sceneId: scene.id,
        personaId: persona.id,
        executionMode: scene.executionMode,
        required: scene.required,
        optionalReason: scene.optionalReason ?? null,
        stories: scene.stories,
        preseededHistoryDays: scene.preseededHistoryDays,
        status: result.status,
        durationSeconds: result.durationSeconds,
        evidence,
      }
    }),
  )
  const requiredFailure = scenes.some(
    (scene) => scene.required && scene.status !== 'PASS',
  )
  const continuousScene = manifest.personas
    .flatMap(({ scenes: personaScenes }) => personaScenes)
    .find(({ executionMode }) => executionMode === 'continuous')
  const continuousVerification = validateContinuousReceipt(
    resolve(runDirectory, 'mb-666-continuous-persona-verification.json'),
    continuousScene,
    provenance,
    evidenceRunId,
  )
  const device = readJson(
    resolve(runDirectory, 'mb-666-device-receipt.json'),
    'Android device receipt',
  )
  if (
    device.schemaVersion !== 'mb-666-device-receipt-v1' ||
    device.evidenceRunId !== evidenceRunId ||
    device.evidenceMode !== environment.MB666_EVIDENCE_MODE ||
    !['emulator', 'physical'].includes(device.deviceClass)
  ) {
    throw new Error('Android device receipt is missing or mismatched.')
  }

  let usability = { status: 'NOT_VERIFIED', sessionCount: 0 }
  let sanitization = { status: 'NOT_VERIFIED' }
  if (device.evidenceMode === 'physical-acceptance') {
    if (device.deviceClass !== 'physical') {
      throw new Error('Physical acceptance refuses emulator-only evidence.')
    }
    const usabilityRecord = validateUsabilityRecord(
      readJson(environment.MB666_USABILITY_RECORD ?? '', 'Usability record'),
      { evidenceRunId, deviceSerialSha256: device.serialSha256 },
    )
    usability = {
      status: 'VERIFIED',
      sessionCount: usabilityRecord.sessions.length,
    }
    validateSanitizationAttestation(
      environment.MB666_SANITIZATION_ATTESTATION ?? '',
      validEvidenceFiles,
      evidenceRunId,
    )
    sanitization = { status: 'VERIFIED' }
  }

  const result = requiredFailure
    ? 'STAGING_FAIL'
    : device.deviceClass === 'emulator'
      ? 'STAGING_PASS_EMULATOR'
      : usability.status === 'VERIFIED' && sanitization.status === 'VERIFIED'
        ? 'STAGING_PASS_PHYSICAL'
        : 'PHYSICAL_ACCEPTANCE_PENDING'
  const index = {
    schemaVersion: 'mb-666-evidence-index-v2',
    evidenceRunId,
    result,
    provenance,
    device,
    continuousVerification,
    personas: manifest.personas.map(({ id, label, synthetic }) => ({
      id,
      label,
      synthetic,
    })),
    scenes,
    claimBoundary: {
      preseededHistoryIsNotLiveElapsedTime: true,
      evidenceSanitization: sanitization.status,
      containsProductionPersonalData:
        sanitization.status === 'VERIFIED' ? false : 'NOT_VERIFIED',
      usabilityCohort: usability.status,
      usabilitySessionCount: usability.sessionCount,
      physicalAndroidAcceptance:
        result === 'STAGING_PASS_PHYSICAL' ? 'VERIFIED' : 'NOT_VERIFIED',
    },
  }
  writeFileSync(
    resolve(runDirectory, 'mb-666-evidence-index.json'),
    `${JSON.stringify(index, null, 2)}\n`,
    { encoding: 'utf8', flag: 'wx' },
  )
  if (requiredFailure || result === 'PHYSICAL_ACCEPTANCE_PENDING') {
    process.exitCode = 1
  }
  return index
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const index = writeEvidenceIndex()
  console.log(`Wrote MB-666 evidence index with result ${index.result}.`)
}
