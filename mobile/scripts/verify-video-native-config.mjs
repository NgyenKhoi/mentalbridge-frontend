import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'

const executable = process.platform === 'win32' ? 'cmd.exe' : 'npx'
const args =
  process.platform === 'win32'
    ? ['/d', '/s', '/c', 'npx expo config --type introspect --json']
    : ['expo', 'config', '--type', 'introspect', '--json']
const config = JSON.parse(
  execFileSync(executable, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }),
)
const manifest = config._internal.modResults.android.manifest.manifest
const permissions = manifest['uses-permission'].map(
  (item) => item.$['android:name'],
)
for (const permission of [
  'android.permission.CAMERA',
  'android.permission.RECORD_AUDIO',
  'android.permission.MODIFY_AUDIO_SETTINGS',
])
  assert(permissions.includes(permission))
const metadata = manifest.application[0]['meta-data']
assert(
  metadata.some(
    (item) =>
      item.$['android:name'] ===
        'io.livekit.reactnative.expo.ANDROID_AUDIO_TYPE' &&
      item.$['android:value'] === 'communication',
  ),
)
assert(
  metadata.some(
    (item) =>
      item.$['android:name'] ===
        'io.livekit.reactnative.expo.ENABLE_SCREEN_SHARE_SERVICE' &&
      item.$['android:value'] === 'false',
  ),
)
const plist = config._internal.modResults.ios.infoPlist
assert(plist.NSCameraUsageDescription.includes('tư vấn video'))
assert(plist.NSMicrophoneUsageDescription.includes('tư vấn video'))
assert.notEqual(
  plist['io.livekit.reactnative.expo.ENABLE_MULTITASKING_CAMERA_ACCESS'],
  true,
)
console.log(
  'LiveKit CNG config: camera/microphone permissions and communication audio configured; screen share and multitasking camera disabled. This is not a native build or runtime test.',
)
