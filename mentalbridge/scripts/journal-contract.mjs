import { constants } from 'node:fs'
import { access, copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import openapiTS, { astToString, COMMENT_HEADER } from 'openapi-typescript'

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const snapshotPath = path.join(
  appRoot,
  'contracts',
  'openapi',
  'journal-ai-service-v1.yaml',
)
const generatedPath = path.join(appRoot, 'contracts', 'journal.generated.ts')
const referencedSchemas = [
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
if (argumentsSet.has('--check')) await check(generated)
else {
  await writeFile(generatedPath, generated, 'utf8')
  console.log(`Generated ${generatedPath}`)
}
