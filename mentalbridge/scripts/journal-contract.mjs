import { constants } from 'node:fs'
import { access, copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import openapiTS, { astToString, COMMENT_HEADER } from 'openapi-typescript'
import { load as loadYaml } from 'js-yaml'

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const snapshotPath = path.join(
  appRoot,
  'contracts',
  'openapi',
  'journal-ai-service-v1.yaml',
)
const generatedPath = path.join(appRoot, 'contracts', 'journal.generated.ts')
const voiceGeneratedPath = path.join(
  appRoot,
  'contracts',
  'voice-public.generated.json',
)
const referencedSchemas = [
  '../proposals/companion-voice-v1.openapi.json',
  '../proposals/support-plan-companion-intent-v1.schema.json',
  '../proposals/support-plan-companion-context-v1.schema.json',
]
const defaultBackendSource = path.resolve(
  appRoot,
  '..',
  '..',
  'mentalbridge-backend',
  'contracts',
  'openapi',
  'journal-ai-service-v1.yaml',
)
const exists = async (filePath) => {
  try {
    await access(filePath, constants.R_OK)
    return true
  } catch {
    return false
  }
}
const generate = async () =>
  COMMENT_HEADER + astToString(await openapiTS(pathToFileURL(snapshotPath)))
const normalize = (value) => value.replace(/\r\n/g, '\n')

async function syncSnapshot() {
  const sourcePath = process.env.JOURNAL_OPENAPI_SOURCE
    ? path.resolve(appRoot, process.env.JOURNAL_OPENAPI_SOURCE)
    : defaultBackendSource
  if (!(await exists(sourcePath)))
    throw new Error(`Journal OpenAPI source not found at ${sourcePath}.`)
  await copyFile(sourcePath, snapshotPath)
  for (const reference of referencedSchemas) {
    const target = path.resolve(path.dirname(snapshotPath), reference)
    await mkdir(path.dirname(target), { recursive: true })
    await copyFile(path.resolve(path.dirname(sourcePath), reference), target)
  }
  console.log(`Synced Journal OpenAPI snapshot from ${sourcePath}`)
}
async function check(expected) {
  if (!(await exists(generatedPath)))
    throw new Error(
      'Generated Journal types are missing. Run npm run contracts:generate.',
    )
  if (normalize(await readFile(generatedPath, 'utf8')) !== normalize(expected))
    throw new Error(
      'Generated Journal types are stale. Run npm run contracts:generate.',
    )
  const sourcePath =
    process.env.JOURNAL_OPENAPI_SOURCE &&
    path.resolve(appRoot, process.env.JOURNAL_OPENAPI_SOURCE)
  if (sourcePath && !(await exists(sourcePath)))
    throw new Error(`Journal OpenAPI source not found at ${sourcePath}.`)
  if (
    sourcePath &&
    !(await readFile(sourcePath)).equals(await readFile(snapshotPath))
  )
    throw new Error(
      'The committed Journal OpenAPI snapshot differs from its provider source.',
    )
  if (sourcePath) {
    for (const reference of referencedSchemas) {
      const source = path.resolve(path.dirname(sourcePath), reference)
      const snapshot = path.resolve(path.dirname(snapshotPath), reference)
      if (!(await readFile(source)).equals(await readFile(snapshot)))
        throw new Error(
          `Journal referenced schema differs from its provider: ${reference}`,
        )
    }
  }
  console.log('Journal OpenAPI snapshot and generated types are valid.')
}
const argumentsSet = new Set(process.argv.slice(2))
if (argumentsSet.has('--sync')) await syncSnapshot()
const generated = await generate()
const journalVoice = loadYaml(await readFile(snapshotPath, 'utf8'))
const careVoice = loadYaml(
  await readFile(
    path.join(appRoot, 'contracts/openapi/care-service-v1.yaml'),
    'utf8',
  ),
)
const publicVoiceSources = {
  Eligibility: [journalVoice, 'VoiceEligibility'],
  VoiceQuota: [journalVoice, 'VoiceQuota'],
  Session: [journalVoice, 'VoiceSession'],
  Connection: [journalVoice, 'VoiceConnection'],
  EmptyCommand: [journalVoice, 'VoiceEmptyCommand'],
  StartCommand: [journalVoice, 'VoiceStartCommand'],
  ContextHandoffCommand: [journalVoice, 'VoiceContextHandoffCommand'],
  ContextHandoff: [journalVoice, 'VoiceContextHandoff'],
  VoiceConsent: [careVoice, 'VoiceConsent'],
  VoiceConsentCommand: [careVoice, 'VoiceConsentCommand'],
  VoiceDisclosure: [careVoice, 'VoiceDisclosure'],
  Problem: [journalVoice, 'VoiceProblem'],
}
const schemaNames = new Map(
  Object.entries(publicVoiceSources).map(([name, [, source]]) => [
    source,
    name,
  ]),
)
const publicSchema = (name, document, source) => {
  const schema = document?.components?.schemas?.[source]
  if (!schema) throw new Error(`Missing active public Voice schema: ${name}`)
  return JSON.parse(
    JSON.stringify(schema).replaceAll(
      /#\/components\/schemas\/([A-Za-z0-9_-]+)/g,
      (_match, ref) => {
        const target = schemaNames.get(ref)
        if (!target)
          throw new Error(`Unpublished public Voice schema reference: ${ref}`)
        return `#/$defs/${target}`
      },
    ),
  )
}
const voiceSchema =
  JSON.stringify(
    {
      $id: 'mentalbridge-voice-public',
      $defs: Object.fromEntries(
        Object.entries(publicVoiceSources).map(([name, [document, source]]) => [
          name,
          publicSchema(name, document, source),
        ]),
      ),
    },
    null,
    2,
  ) + '\n'
if (argumentsSet.has('--check')) {
  if (
    !(await exists(voiceGeneratedPath)) ||
    normalize(await readFile(voiceGeneratedPath, 'utf8')) !==
      normalize(voiceSchema)
  )
    throw new Error(
      'Generated public Voice schemas are stale. Run npm run contracts:generate.',
    )
} else await writeFile(voiceGeneratedPath, voiceSchema, 'utf8')
if (argumentsSet.has('--check')) await check(generated)
else {
  await writeFile(generatedPath, generated, 'utf8')
  console.log(`Generated ${generatedPath}`)
}
