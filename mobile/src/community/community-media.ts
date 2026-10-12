import { fetch as expoFetch } from 'expo/fetch'
import { File } from 'expo-file-system'
import * as ImagePicker from 'expo-image-picker'
import { Platform } from 'react-native'

import {
  uploadIntentSchema,
  uploadWriteSchema,
  type UploadIntent,
  type UploadWrite,
} from './community-contract'

export type SelectedMedia = { uri: string; request: UploadWrite }
export interface CommunityMediaTransport {
  pick(): Promise<SelectedMedia | null>
  upload(
    file: SelectedMedia,
    intent: UploadIntent,
    signal: AbortSignal,
  ): Promise<void>
}

export const communityMediaTransport: CommunityMediaTransport = {
  async pick() {
    if (Platform.OS === 'ios') {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (!permission.granted) throw new Error('MEDIA_PERMISSION_DENIED')
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsEditing: false,
      quality: 1,
    })
    if (result.canceled) return null
    const asset = result.assets[0]
    if (
      !asset ||
      !asset.fileName ||
      !asset.mimeType ||
      !['image', 'video'].includes(asset.type ?? '')
    )
      throw new Error('UNSUPPORTED_MEDIA')
    if (
      asset.type === 'video' &&
      (asset.duration == null || asset.duration > 60_000)
    )
      throw new Error('UNSUPPORTED_VIDEO_DURATION')
    const request = uploadWriteSchema.parse({
      fileName: asset.fileName,
      mediaType: asset.type === 'image' ? 'IMAGE' : 'VIDEO',
      mimeType: asset.mimeType,
      sizeBytes: asset.fileSize ?? new File(asset.uri).size,
    })
    return { uri: asset.uri, request }
  },
  async upload(file, value, signal) {
    const intent = uploadIntentSchema.parse(value)
    if (Date.parse(intent.expiresAt) <= Date.now())
      throw new Error('UPLOAD_EXPIRED')
    const body = new FormData()
    Object.entries(intent.uploadFields).forEach(([key, field]) =>
      body.append(key, field),
    )
    body.append('file', new File(file.uri), file.request.fileName)
    const response = await expoFetch(intent.uploadUrl, {
      method: 'POST',
      body,
      signal,
      redirect: 'error',
      credentials: 'omit',
    })
    if (!response.ok) throw new Error('UPLOAD_UNAVAILABLE')
  },
}
