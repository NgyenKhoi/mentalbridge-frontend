import { constants } from 'node:fs'
import { access, copyFile, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import openapiTS, { astToString, COMMENT_HEADER } from 'openapi-typescript'

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const snapshotPath = path.join(
  appRoot,
  'contracts',
  'openapi',
  'consultation-service-v1.yaml',
)
const generatedPath = path.join(
  appRoot,
  'contracts',
  'consultation.generated.ts',
)
const defaultBackendSource = path.resolve(
  appRoot,
  '..',
  '..',
  'mentalbridge-backend',
  'contracts',
  'openapi',
  'consultation-service-v1.yaml',
)

async function exists(filePath) {
  try {
    await access(filePath, constants.R_OK)
    return true
  } catch {
    return false
  }
}

function normalizeLineEndings(value) {
  return value.replace(/\r\n/g, '\n')
}

async function syncSnapshot() {
  const sourcePath = process.env.CONSULTATION_OPENAPI_SOURCE
    ? path.resolve(appRoot, process.env.CONSULTATION_OPENAPI_SOURCE)
    : defaultBackendSource
  if (!(await exists(sourcePath))) {
    throw new Error(`Consultation OpenAPI source not found at ${sourcePath}.`)
  }
  await copyFile(sourcePath, snapshotPath)
}

const argumentsSet = new Set(process.argv.slice(2))
if (argumentsSet.has('--sync')) await syncSnapshot()
const generated =
  COMMENT_HEADER + astToString(await openapiTS(pathToFileURL(snapshotPath)))

if (argumentsSet.has('--check')) {
  if (!(await exists(generatedPath))) {
    throw new Error('Generated Consultation types are missing.')
  }
  const actual = await readFile(generatedPath, 'utf8')
  if (normalizeLineEndings(actual) !== normalizeLineEndings(generated)) {
    throw new Error('Generated Consultation types are stale.')
  }
  if (process.env.CONSULTATION_OPENAPI_SOURCE) {
    const source = await readFile(
      path.resolve(appRoot, process.env.CONSULTATION_OPENAPI_SOURCE),
    )
    const snapshot = await readFile(snapshotPath)
    if (!source.equals(snapshot)) {
      throw new Error('Committed Consultation OpenAPI snapshot is stale.')
    }
  }
} else {
  await writeFile(generatedPath, generated, 'utf8')
}
