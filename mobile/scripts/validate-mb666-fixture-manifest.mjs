import { readManifest, validateManifest } from './mb666-fixture-manifest.mjs'

const manifest = validateManifest(readManifest())
const scenes = manifest.personas.flatMap((persona) => persona.scenes)
const required = scenes.filter((scene) => scene.required).length

console.log(
  `Validated MB-666 synthetic fixture manifest: ${manifest.personas.length} personas, ${required}/${scenes.length} required scenes.`,
)
