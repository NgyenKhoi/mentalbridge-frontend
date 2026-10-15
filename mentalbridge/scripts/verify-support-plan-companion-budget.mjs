import { readFile, writeFile } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'

const files = [
  'features/support-plan/components/SupportPlanCompanionShell.tsx',
  'features/support-plan/components/SupportPlanCompanionPanel.tsx',
  'features/support-plan/components/SupportPlanContextualCompanion.tsx',
  'features/support-plan/components/support-plan-companion-state.ts',
  'features/support-plan/components/support-plan-companion-interruption.ts',
  'features/support-plan/components/support-plan-contextual-companion.ts',
  'features/support-plan/components/support-plan-companion.css',
]
const limits = {
  sourceBytes: 100_000,
  gzipBytes: 20_000,
}

const sources = await Promise.all(
  files.map(async (file) => ({ file, source: await readFile(file, 'utf8') })),
)
const combined = sources.map(({ source }) => source).join('\n')
const result = {
  evidenceClass: 'static-client-source-budget',
  measuredAt: new Date().toISOString(),
  files,
  sourceBytes: Buffer.byteLength(combined),
  gzipBytes: gzipSync(combined).byteLength,
  limits,
  externalAnimationRuntimeImports: sources.flatMap(({ file, source }) =>
    /from ['"](?:framer-motion|gsap|three)['"]/.test(source) ? [file] : [],
  ),
}

if (
  result.sourceBytes > limits.sourceBytes ||
  result.gzipBytes > limits.gzipBytes ||
  result.externalAnimationRuntimeImports.length > 0
) {
  throw new Error(
    `SupportPlan Companion budget exceeded: ${JSON.stringify(result)}`,
  )
}

if (process.env.MB653_WRITE_STATIC_BUDGET === 'true') {
  await writeFile(
    'docs/evidence/mb-653-companion-static-budget.json',
    `${JSON.stringify(result, null, 2)}\n`,
    'utf8',
  )
}

console.log(JSON.stringify(result, null, 2))
