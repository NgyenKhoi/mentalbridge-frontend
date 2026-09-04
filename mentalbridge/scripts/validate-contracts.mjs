#!/usr/bin/env node

import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function runScript(scriptName) {
  return new Promise((resolve, reject) => {
    const proc = spawn(
      'node',
      [path.join(appRoot, 'scripts', scriptName), '--check'],
      { stdio: 'inherit' },
    )

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`${scriptName} failed with code ${code}`))
      } else {
        resolve()
      }
    })

    proc.on('error', reject)
  })
}

try {
  console.log('Validating Care contract...')
  await runScript('care-contract.mjs')

  console.log('Validating Identity contract...')
  await runScript('identity-contract.mjs')

  console.log('✓ All contracts are valid')
} catch (error) {
  console.error('✗ Contract validation failed:', error.message)
  process.exit(1)
}
