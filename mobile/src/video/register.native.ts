// LiveKit imports livekit-client before its bundled encoder polyfill is applied.
// Hermes does not provide TextDecoder, so install a public polyfill first.
import 'fast-text-encoding'

import { registerGlobals, setLogLevel } from '@livekit/react-native'
import { LogLevel } from 'livekit-client'

if (typeof globalThis.navigator !== 'object') {
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {},
    writable: true,
  })
}

// LiveKit 3.0.0 still reads window.navigator while registering its WebRTC
// adapter. React Native exposes globalThis instead of the browser window.
if (typeof globalThis.window !== 'object') {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: globalThis,
    writable: true,
  })
}

registerGlobals()
setLogLevel(LogLevel.silent)
