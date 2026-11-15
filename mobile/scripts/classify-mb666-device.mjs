import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

function adbProperty(device, property, spawnImpl = spawnSync) {
  const result = spawnImpl(
    'adb',
    ['-s', device, 'shell', 'getprop', property],
    {
      encoding: 'utf8',
    },
  )
  if (result.error || result.signal || result.status !== 0) {
    throw new Error(`Unable to read Android property ${property}.`)
  }
  return result.stdout.trim()
}

export function classifyDevice(device, spawnImpl = spawnSync) {
  if (!device) throw new Error('ANDROID_DEVICE is required.')
  const qemu = adbProperty(device, 'ro.kernel.qemu', spawnImpl)
  const fingerprint = adbProperty(device, 'ro.build.fingerprint', spawnImpl)
  const model = adbProperty(device, 'ro.product.model', spawnImpl)
  const sdk = adbProperty(device, 'ro.build.version.sdk', spawnImpl)
  const emulator =
    qemu === '1' ||
    /generic|emulator|sdk_gphone/i.test(`${fingerprint} ${model}`)
  return {
    deviceClass: emulator ? 'emulator' : 'physical',
    model,
    sdk,
    serialSha256: createHash('sha256').update(device).digest('hex'),
  }
}

export function writeDeviceReceipt({
  environment = process.env,
  spawnImpl = spawnSync,
} = {}) {
  const device = environment.ANDROID_DEVICE ?? ''
  const evidenceRunId = environment.MB666_EVIDENCE_RUN_ID ?? ''
  const evidenceMode = environment.MB666_EVIDENCE_MODE ?? ''
  const runDirectory = environment.MB666_EVIDENCE_RUN_DIR ?? ''
  if (!evidenceRunId || !runDirectory)
    throw new Error('MB-666 run identity is missing.')
  if (!['automated-emulator', 'physical-acceptance'].includes(evidenceMode)) {
    throw new Error('MB666_EVIDENCE_MODE is invalid.')
  }
  const classification = classifyDevice(device, spawnImpl)
  if (
    evidenceMode === 'automated-emulator' &&
    classification.deviceClass !== 'emulator'
  ) {
    throw new Error('The automated-emulator milestone requires an emulator.')
  }
  if (
    evidenceMode === 'physical-acceptance' &&
    classification.deviceClass !== 'physical'
  ) {
    throw new Error('Physical Android acceptance refuses emulator evidence.')
  }
  const receipt = {
    schemaVersion: 'mb-666-device-receipt-v1',
    evidenceRunId,
    evidenceMode,
    ...classification,
  }
  writeFileSync(
    resolve(process.cwd(), runDirectory, 'mb-666-device-receipt.json'),
    `${JSON.stringify(receipt, null, 2)}\n`,
    { encoding: 'utf8', flag: 'wx' },
  )
  return receipt
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const receipt = writeDeviceReceipt()
  console.log(`Verified MB-666 ${receipt.deviceClass} device class.`)
}
