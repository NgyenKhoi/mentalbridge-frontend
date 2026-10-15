import { registerGlobals, setLogLevel } from '@livekit/react-native'
import { LogLevel } from 'livekit-client'

registerGlobals()
setLogLevel(LogLevel.silent)
