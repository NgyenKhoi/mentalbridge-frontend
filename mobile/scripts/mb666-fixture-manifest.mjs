import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const manifestPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../fixtures/mb-666-personas.json',
)

const identifier = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const environmentName = /^[A-Z][A-Z0-9_]+$/
const evidenceName = /^mb-666-[a-z0-9-]+\.png$/

function requireString(value, label, pattern) {
  if (typeof value !== 'string' || !pattern.test(value)) {
    throw new Error(`${label} is missing or invalid.`)
  }
}

export function readManifest(path = manifestPath) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

export function validateManifest(manifest, options = {}) {
  const mobileRoot = options.mobileRoot ?? resolve(dirname(manifestPath), '..')
  if (manifest?.schemaVersion !== 'mb-666-persona-fixtures-v1') {
    throw new Error('Unexpected MB-666 fixture manifest schema version.')
  }
  requireString(
    manifest.datasetVersionEnvironment,
    'datasetVersionEnvironment',
    environmentName,
  )
  requireString(
    manifest.fixtureControl?.urlEnvironment,
    'fixtureControl.urlEnvironment',
    environmentName,
  )
  requireString(
    manifest.fixtureControl?.tokenEnvironment,
    'fixtureControl.tokenEnvironment',
    environmentName,
  )
  if (!Array.isArray(manifest.personas) || manifest.personas.length !== 2) {
    throw new Error(
      'MB-666 requires exactly the documented Persona A and Persona B.',
    )
  }

  const personaIds = new Set()
  const sceneIds = new Set()
  const coveredScreens = new Set()
  for (const persona of manifest.personas) {
    requireString(persona.id, 'persona.id', identifier)
    if (personaIds.has(persona.id))
      throw new Error(`Duplicate persona ${persona.id}.`)
    personaIds.add(persona.id)
    if (persona.synthetic !== true) {
      throw new Error(`${persona.id} must be explicitly synthetic.`)
    }
    requireString(
      persona.credentialPrefix,
      'persona.credentialPrefix',
      environmentName,
    )
    if (!Array.isArray(persona.scenes) || persona.scenes.length === 0) {
      throw new Error(`${persona.id} has no executable scenes.`)
    }
    for (const scene of persona.scenes) {
      requireString(scene.id, 'scene.id', identifier)
      if (!scene.id.startsWith(`${persona.id}-`)) {
        throw new Error(`${scene.id} is not owned by ${persona.id}.`)
      }
      if (sceneIds.has(scene.id))
        throw new Error(`Duplicate scene ${scene.id}.`)
      sceneIds.add(scene.id)
      requireString(scene.resetProfile, `${scene.id}.resetProfile`, identifier)
      requireString(
        scene.evidenceFile,
        `${scene.id}.evidenceFile`,
        evidenceName,
      )
      if (typeof scene.required !== 'boolean') {
        throw new Error(`${scene.id}.required must be boolean.`)
      }
      if (![0, 14].includes(scene.preseededHistoryDays)) {
        throw new Error(
          `${scene.id} must declare either 0 or 14 seeded history days.`,
        )
      }
      if (
        typeof scene.flow !== 'string' ||
        !scene.flow.startsWith('.maestro/') ||
        scene.flow.includes('..') ||
        !scene.flow.endsWith('.yaml')
      ) {
        throw new Error(`${scene.id} has an unsafe Maestro flow path.`)
      }
      if (!existsSync(resolve(mobileRoot, scene.flow))) {
        throw new Error(`${scene.id} references a missing Maestro flow.`)
      }
      if (
        !Array.isArray(scene.stories) ||
        scene.stories.some((key) => !/^MB-\d+$/.test(key))
      ) {
        throw new Error(`${scene.id} has invalid Jira traceability.`)
      }
      if (!Array.isArray(scene.screens) || scene.screens.length === 0) {
        throw new Error(`${scene.id} has no evidence screen mapping.`)
      }
      scene.screens.forEach((screen) => coveredScreens.add(screen))
    }
  }

  if (!personaIds.has('persona-a') || !personaIds.has('persona-b')) {
    throw new Error('The documented Persona A and Persona B are both required.')
  }
  for (const requiredScreen of manifest.requiredScreens ?? []) {
    if (!coveredScreens.has(requiredScreen)) {
      throw new Error(
        `Required evidence screen ${requiredScreen} is not covered.`,
      )
    }
  }
  return manifest
}

export function findScene(manifest, sceneId) {
  for (const persona of manifest.personas) {
    const scene = persona.scenes.find((candidate) => candidate.id === sceneId)
    if (scene) return { persona, scene }
  }
  throw new Error(`Unknown MB-666 fixture scene: ${sceneId}`)
}
