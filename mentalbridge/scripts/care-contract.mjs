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
  'care-service-v1.yaml',
)
const generatedPath = path.join(appRoot, 'contracts', 'care.generated.ts')
const supportGuideSnapshotPath = path.join(
  appRoot,
  'contracts',
  'openapi',
  'care-support-guide-v1.yaml',
)
const supportGuideGeneratedPath = path.join(
  appRoot,
  'contracts',
  'care-support-guide.generated.ts',
)
const supportEvaluationSnapshotPath = path.join(
  appRoot,
  'contracts',
  'openapi',
  'care-support-evaluation-v2.yaml',
)
const supportEvaluationGeneratedPath = path.join(
  appRoot,
  'contracts',
  'care-support-evaluation-v2.generated.ts',
)
const defaultBackendSource = path.resolve(
  appRoot,
  '..',
  '..',
  'mentalbridge-backend',
  'contracts',
  'openapi',
  'care-service-v1.yaml',
)
const defaultSupportGuideBackendSource = path.resolve(
  appRoot,
  '..',
  '..',
  'mentalbridge-backend',
  'contracts',
  'openapi',
  'care-support-guide-v1.yaml',
)
const defaultSupportEvaluationBackendSource = path.resolve(
  appRoot,
  '..',
  '..',
  'mentalbridge-backend',
  'contracts',
  'openapi',
  'care-support-evaluation-v2.yaml',
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

async function generateSupportGuide() {
  const ast = await openapiTS(pathToFileURL(supportGuideSnapshotPath))
  return COMMENT_HEADER + astToString(ast)
}

async function generateSupportEvaluation() {
  const ast = await openapiTS(pathToFileURL(supportEvaluationSnapshotPath))
  return COMMENT_HEADER + astToString(ast)
}

function normalizeLineEndings(value) {
  return value.replace(/\r\n/g, '\n')
}

async function syncSnapshot({ includePrimaryCare = true } = {}) {
  const configuredSource = process.env.CARE_OPENAPI_SOURCE
  const configuredSupportGuideSource =
    process.env.CARE_SUPPORT_GUIDE_OPENAPI_SOURCE
  const configuredSupportEvaluationSource =
    process.env.CARE_SUPPORT_EVALUATION_OPENAPI_SOURCE
  const sourcePath = configuredSource
    ? path.resolve(appRoot, configuredSource)
    : defaultBackendSource
  const supportGuideSourcePath = configuredSupportGuideSource
    ? path.resolve(appRoot, configuredSupportGuideSource)
    : defaultSupportGuideBackendSource
  const supportEvaluationSourcePath = configuredSupportEvaluationSource
    ? path.resolve(appRoot, configuredSupportEvaluationSource)
    : defaultSupportEvaluationBackendSource

  if (includePrimaryCare && !(await exists(sourcePath))) {
    throw new Error(
      `Care OpenAPI source not found at ${sourcePath}. ` +
        'Set CARE_OPENAPI_SOURCE to the backend contract path.',
    )
  }
  if (!(await exists(supportGuideSourcePath))) {
    throw new Error(
      `Care Support Guide OpenAPI source not found at ${supportGuideSourcePath}. ` +
        'Set CARE_SUPPORT_GUIDE_OPENAPI_SOURCE to the backend contract path.',
    )
  }
  if (!(await exists(supportEvaluationSourcePath))) {
    throw new Error(
      `Care SupportEvaluation v2 OpenAPI source not found at ${supportEvaluationSourcePath}. ` +
        'Set CARE_SUPPORT_EVALUATION_OPENAPI_SOURCE to the backend contract path.',
    )
  }

  if (includePrimaryCare) await copyFile(sourcePath, snapshotPath)
  await copyFile(supportGuideSourcePath, supportGuideSnapshotPath)
  await copyFile(supportEvaluationSourcePath, supportEvaluationSnapshotPath)
  console.log(
    includePrimaryCare
      ? `Synced Care OpenAPI snapshots from ${sourcePath}, ${supportGuideSourcePath}, and ${supportEvaluationSourcePath}`
      : `Synced Care feature OpenAPI snapshots from ${supportGuideSourcePath} and ${supportEvaluationSourcePath}`,
  )
}

async function checkGeneratedContract(expected) {
  if (!(await exists(generatedPath))) {
    throw new Error(
      'Generated Care types are missing. Run npm run contracts:generate.',
    )
  }

  const actual = await readFile(generatedPath, 'utf8')
  if (normalizeLineEndings(actual) !== normalizeLineEndings(expected)) {
    throw new Error(
      'Generated Care types are stale. Run npm run contracts:generate.',
    )
  }

  const configuredSource = process.env.CARE_OPENAPI_SOURCE
  if (configuredSource) {
    const sourcePath = path.resolve(appRoot, configuredSource)
    const [source, snapshot] = await Promise.all([
      readFile(sourcePath),
      readFile(snapshotPath),
    ])

    if (!source.equals(snapshot)) {
      throw new Error(
        'The committed Care OpenAPI snapshot differs from ' +
          `${sourcePath}. Run npm run contracts:sync.`,
      )
    }
  }

  console.log('Care OpenAPI snapshot and generated types are valid.')
}

async function checkSupportGuideContract(expected) {
  if (!(await exists(supportGuideGeneratedPath))) {
    throw new Error(
      'Generated Support Guide types are missing. Run npm run contracts:generate.',
    )
  }
  const actual = await readFile(supportGuideGeneratedPath, 'utf8')
  if (normalizeLineEndings(actual) !== normalizeLineEndings(expected)) {
    throw new Error(
      'Generated Support Guide types are stale. Run npm run contracts:generate.',
    )
  }

  const configuredSource = process.env.CARE_SUPPORT_GUIDE_OPENAPI_SOURCE
  if (configuredSource) {
    const sourcePath = path.resolve(appRoot, configuredSource)
    const [source, snapshot] = await Promise.all([
      readFile(sourcePath),
      readFile(supportGuideSnapshotPath),
    ])
    if (!source.equals(snapshot)) {
      throw new Error(
        'The committed Care Support Guide OpenAPI snapshot differs from ' +
          `${sourcePath}. Run npm run contracts:sync.`,
      )
    }
  }

  console.log(
    'Care Support Guide OpenAPI snapshot and generated types are valid.',
  )
}

async function checkSupportEvaluationContract(expected) {
  if (!(await exists(supportEvaluationGeneratedPath))) {
    throw new Error(
      'Generated SupportEvaluation v2 types are missing. Run npm run contracts:generate.',
    )
  }
  const actual = await readFile(supportEvaluationGeneratedPath, 'utf8')
  if (normalizeLineEndings(actual) !== normalizeLineEndings(expected)) {
    throw new Error(
      'Generated SupportEvaluation v2 types are stale. Run npm run contracts:generate.',
    )
  }

  const configuredSource = process.env.CARE_SUPPORT_EVALUATION_OPENAPI_SOURCE
  if (configuredSource) {
    const sourcePath = path.resolve(appRoot, configuredSource)
    const [source, snapshot] = await Promise.all([
      readFile(sourcePath),
      readFile(supportEvaluationSnapshotPath),
    ])
    if (!source.equals(snapshot)) {
      throw new Error(
        'The committed SupportEvaluation v2 OpenAPI snapshot differs from ' +
          `${sourcePath}. Run npm run contracts:sync.`,
      )
    }
  }

  console.log(
    'Care SupportEvaluation v2 OpenAPI snapshot and generated types are valid.',
  )
}

const argumentsSet = new Set(process.argv.slice(2))

if (argumentsSet.has('--sync')) await syncSnapshot()
if (argumentsSet.has('--sync-support-guide')) {
  await syncSnapshot({ includePrimaryCare: false })
}

const generatedContract = await generate()
const generatedSupportGuideContract = await generateSupportGuide()
const generatedSupportEvaluationContract = await generateSupportEvaluation()

if (argumentsSet.has('--check')) {
  await checkGeneratedContract(generatedContract)
  await checkSupportGuideContract(generatedSupportGuideContract)
  await checkSupportEvaluationContract(generatedSupportEvaluationContract)
} else {
  await writeFile(generatedPath, generatedContract, 'utf8')
  await writeFile(
    supportGuideGeneratedPath,
    generatedSupportGuideContract,
    'utf8',
  )
  await writeFile(
    supportEvaluationGeneratedPath,
    generatedSupportEvaluationContract,
    'utf8',
  )
  console.log(`Generated ${generatedPath}`)
}
