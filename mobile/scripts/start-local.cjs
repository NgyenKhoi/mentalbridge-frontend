const { spawn } = require('node:child_process')

const expo = spawn(
  process.execPath,
  [
    require.resolve('expo/bin/cli'),
    'start',
    '--dev-client',
    '--scheme',
    'mentalbridge-dev',
    ...process.argv.slice(2),
  ],
  {
    stdio: 'inherit',
    env: { ...process.env, APP_VARIANT: 'development' },
  },
)

expo.on('error', (error) => {
  console.error(error.message)
  process.exitCode = 1
})
expo.on('exit', (code) => {
  process.exitCode = code ?? 1
})
