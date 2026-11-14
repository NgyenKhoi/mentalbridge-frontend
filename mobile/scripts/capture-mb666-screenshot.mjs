import { spawnSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

import { validatePngBuffer } from './mb666-evidence-validation.mjs'

export function captureScreenshot(
  device,
  outputPath,
  { spawnImpl = spawnSync, adbCommand = 'adb' } = {},
) {
  if (!device || !outputPath)
    throw new Error('Device and output path are required.')
  const result = spawnImpl(
    adbCommand,
    ['-s', device, 'exec-out', 'screencap', '-p'],
    { encoding: null, maxBuffer: 32 * 1024 * 1024 },
  )
  if (result.error || result.signal || result.status !== 0) {
    throw new Error(
      `adb screencap failed with status ${result.status ?? 'unknown'}.`,
    )
  }
  validatePngBuffer(result.stdout, outputPath)
  writeFileSync(outputPath, result.stdout, { flag: 'wx' })
  return result.stdout.length
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const [, , device, outputPath] = process.argv
  const size = captureScreenshot(device, outputPath)
  console.log(`Captured validated PNG (${size} bytes).`)
}
