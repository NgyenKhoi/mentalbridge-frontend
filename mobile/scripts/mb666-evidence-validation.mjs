import { Buffer } from 'node:buffer'
import { readFileSync } from 'node:fs'

const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
const shaPattern = /^[0-9a-f]{40}$/i
const identifierPattern = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,127}$/

const crcTable = Array.from({ length: 256 }, (_, value) => {
  let crc = value
  for (let bit = 0; bit < 8; bit += 1) {
    crc = (crc & 1) === 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1
  }
  return crc >>> 0
})

function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

export function validatePngBuffer(buffer, label = 'screenshot') {
  if (!Buffer.isBuffer(buffer) || buffer.length < 45) {
    throw new Error(`${label} is empty or too small to be a PNG.`)
  }
  if (!buffer.subarray(0, 8).equals(pngSignature)) {
    throw new Error(`${label} has an invalid PNG signature.`)
  }
  let offset = 8
  let chunkIndex = 0
  let sawIend = false
  while (offset < buffer.length) {
    if (offset + 12 > buffer.length)
      throw new Error(`${label} has a truncated PNG chunk.`)
    const length = buffer.readUInt32BE(offset)
    const end = offset + 12 + length
    if (end > buffer.length)
      throw new Error(`${label} has a truncated PNG payload.`)
    const type = buffer.toString('ascii', offset + 4, offset + 8)
    const storedCrc = buffer.readUInt32BE(offset + 8 + length)
    const actualCrc = crc32(buffer.subarray(offset + 4, offset + 8 + length))
    if (storedCrc !== actualCrc)
      throw new Error(`${label} has an invalid ${type} CRC.`)
    if (chunkIndex === 0) {
      if (type !== 'IHDR' || length !== 13)
        throw new Error(`${label} has no valid IHDR.`)
      if (
        buffer.readUInt32BE(offset + 8) === 0 ||
        buffer.readUInt32BE(offset + 12) === 0
      ) {
        throw new Error(`${label} has invalid PNG dimensions.`)
      }
    }
    offset = end
    chunkIndex += 1
    if (type === 'IEND') {
      if (length !== 0 || offset !== buffer.length) {
        throw new Error(`${label} has invalid bytes after IEND.`)
      }
      sawIend = true
      break
    }
  }
  if (!sawIend) throw new Error(`${label} has no IEND chunk.`)
  return true
}

export function validatePngFile(path, label = path) {
  return validatePngBuffer(readFileSync(path), label)
}

function exactValue(object, key, expected, pattern) {
  if (typeof object?.[key] !== 'string' || !pattern.test(object[key])) {
    throw new Error(`Milestone provenance ${key} is missing or invalid.`)
  }
  if (expected !== undefined && object[key] !== expected) {
    throw new Error(`Milestone provenance ${key} does not match the run.`)
  }
}

export function validateMilestoneProvenance(
  provenance,
  environment = process.env,
) {
  if (provenance?.schemaVersion !== 'mb-662-staging-provenance-v1') {
    throw new Error('Milestone provenance is missing or has the wrong schema.')
  }
  exactValue(
    provenance,
    'frontendCommitSha',
    environment.EVIDENCE_COMMIT_SHA,
    shaPattern,
  )
  exactValue(
    provenance,
    'backendCommitSha',
    environment.BACKEND_COMMIT_SHA,
    shaPattern,
  )
  exactValue(
    provenance,
    'backendContractTree',
    environment.BACKEND_CONTRACT_TREE,
    shaPattern,
  )
  exactValue(
    provenance,
    'stagingDeploymentId',
    environment.STAGING_DEPLOYMENT_ID,
    identifierPattern,
  )
  exactValue(
    provenance,
    'fixtureDatasetVersion',
    environment.FIXTURE_DATASET_VERSION,
    identifierPattern,
  )
  exactValue(provenance, 'githubRunId', environment.GITHUB_RUN_ID, /^\d+$/)
  exactValue(
    provenance,
    'githubRunAttempt',
    environment.GITHUB_RUN_ATTEMPT,
    /^\d+$/,
  )
  return provenance
}

export function validateUsabilityRecord(
  record,
  { evidenceRunId, deviceSerialSha256 } = {},
) {
  if (record?.schemaVersion !== 'mb-666-usability-record-v1') {
    throw new Error('Usability record is missing or has the wrong schema.')
  }
  if (record.deidentified !== true || record.containsClinicalData !== false) {
    throw new Error('Usability record must be de-identified and non-clinical.')
  }
  if (
    record.evidenceRunId !== evidenceRunId ||
    record.deviceSerialSha256 !== deviceSerialSha256
  ) {
    throw new Error(
      'Usability record does not belong to this physical-device run.',
    )
  }
  if (
    !Array.isArray(record.sessions) ||
    record.sessions.length < 5 ||
    record.sessions.length > 8
  ) {
    throw new Error('Usability record must contain 5 to 8 sessions.')
  }
  const sessionIds = new Set()
  for (const session of record.sessions) {
    if (
      !identifierPattern.test(session?.sessionId ?? '') ||
      sessionIds.has(session.sessionId)
    ) {
      throw new Error('Usability sessions require unique safe identifiers.')
    }
    sessionIds.add(session.sessionId)
    if (
      session.deviceClass !== 'physical' ||
      typeof session.task !== 'string' ||
      session.task.trim().length < 3 ||
      typeof session.observation !== 'string' ||
      session.observation.trim().length < 3 ||
      typeof session.evidenceReference !== 'string' ||
      session.evidenceReference.trim().length < 3
    ) {
      throw new Error(
        'Every usability session needs a physical device and a task observation reference.',
      )
    }
  }
  return record
}
