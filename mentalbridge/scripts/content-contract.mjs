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
  'content-notification-service.yaml',
)
const generatedPath = path.join(appRoot, 'contracts', 'content.generated.ts')
const defaultBackendSource = path.resolve(
  appRoot,
  '..',
  '..',
  'mentalbridge-backend',
  'contracts',
  'openapi',
  'content-notification-service.yaml',
)

async function exists(filePath) {
  try {
    await access(filePath, constants.R_OK)
    return true
  } catch {
    return false
  }
}

async function generate() {
  const ast = await openapiTS(pathToFileURL(snapshotPath))
  return COMMENT_HEADER + astToString(ast)
}

function normalizeLineEndings(value) {
  return value.replace(/\r\n/g, '\n')
}

async function syncSnapshot() {
  const configuredSource = process.env.CONTENT_OPENAPI_SOURCE
  const sourcePath = configuredSource
    ? path.resolve(appRoot, configuredSource)
    : defaultBackendSource

  if (!(await exists(sourcePath))) {
    throw new Error(
      `Content OpenAPI source not found at ${sourcePath}. ` +
        'Set CONTENT_OPENAPI_SOURCE to the backend contract path.',
    )
  }

  await copyFile(sourcePath, snapshotPath)
  console.log(`Synced Content OpenAPI snapshot from ${sourcePath}`)
}

async function checkGeneratedContract(expected) {
  if (!(await exists(generatedPath))) {
    throw new Error(
      'Generated Content types are missing. Run npm run contracts:generate.',
    )
  }

  const actual = await readFile(generatedPath, 'utf8')
  if (normalizeLineEndings(actual) !== normalizeLineEndings(expected)) {
    throw new Error(
      'Generated Content types are stale. Run npm run contracts:generate.',
    )
  }

  const configuredSource = process.env.CONTENT_OPENAPI_SOURCE
  if (configuredSource) {
    const sourcePath = path.resolve(appRoot, configuredSource)
    const [source, snapshot] = await Promise.all([
      readFile(sourcePath),
      readFile(snapshotPath),
    ])

    if (!source.equals(snapshot)) {
      throw new Error(
        'The committed Content OpenAPI snapshot differs from ' +
          `${sourcePath}. Run npm run contracts:sync.`,
      )
    }
  }

  console.log('Content OpenAPI snapshot and generated types are valid.')
}

const argumentsSet = new Set(process.argv.slice(2))

if (argumentsSet.has('--sync')) await syncSnapshot()

const generatedContract = await generate()

if (argumentsSet.has('--check')) {
  await checkGeneratedContract(generatedContract)
} else {
  await writeFile(generatedPath, generatedContract, 'utf8')
  console.log(`Generated ${generatedPath}`)
}
