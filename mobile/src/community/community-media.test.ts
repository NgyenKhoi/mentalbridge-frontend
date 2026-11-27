import * as ImagePicker from 'expo-image-picker'
import { fetch as expoFetch } from 'expo/fetch'
import { communityMediaTransport } from './community-media'
import { fixturePostId } from './community-fixtures'

jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
}))
jest.mock('expo/fetch', () => ({ fetch: jest.fn() }))
jest.mock('expo-file-system', () => ({
  File: class MockFile extends Blob {
    uri: string
    constructor(mockUri: string) {
      super(['selected-file'])
      this.uri = mockUri
    }
  },
}))

describe('native Community media transport', () => {
  const file = {
    uri: 'file:///private/selected.jpg',
    request: {
      fileName: 'selected.jpg',
      mediaType: 'IMAGE' as const,
      mimeType: 'image/jpeg',
      sizeBytes: 25,
    },
  }
  const intent = {
    mediaId: fixturePostId,
    state: 'PENDING' as const,
    version: 0,
    uploadUrl: 'https://api.cloudinary.com/v1_1/demo/image/upload',
    expiresAt: '2099-01-01T00:00:00Z',
    uploadFields: {
      signature: 'signed',
      timestamp: '1',
      type: 'authenticated',
    },
  }
  beforeEach(() => {
    jest.clearAllMocks()
    ;(
      ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock
    ).mockResolvedValue({ granted: true })
  })
  it('uses explicit library selection and refuses unsupported media or long video', async () => {
    jest
      .mocked(ImagePicker.launchImageLibraryAsync)
      .mockResolvedValueOnce({ canceled: true, assets: null })
    expect(await communityMediaTransport.pick()).toBeNull()
    const asset = {
      uri: file.uri,
      width: 10,
      height: 10,
      type: 'image' as const,
      fileName: 'selected.jpg',
      mimeType: 'image/jpeg',
      fileSize: 25,
    }
    jest
      .mocked(ImagePicker.launchImageLibraryAsync)
      .mockResolvedValueOnce({ canceled: false, assets: [asset] })
    expect(await communityMediaTransport.pick()).toEqual(file)
    expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledWith({
      mediaTypes: ['images', 'videos'],
      allowsEditing: false,
      quality: 1,
    })
    jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValueOnce({
      canceled: false,
      assets: [{ ...asset, type: 'video', duration: 60_001 }],
    })
    await expect(communityMediaTransport.pick()).rejects.toThrow(
      'UNSUPPORTED_VIDEO_DURATION',
    )
  })
  it('copies signed fields unchanged without bearer/cookie credentials or followed redirects', async () => {
    ;(expoFetch as jest.Mock).mockResolvedValue({ ok: true })
    const signal = new AbortController().signal
    await communityMediaTransport.upload(file, intent, signal)
    expect(expoFetch).toHaveBeenCalledWith(
      intent.uploadUrl,
      expect.objectContaining({
        method: 'POST',
        signal,
        redirect: 'error',
        credentials: 'omit',
      }),
    )
    const options = jest.mocked(expoFetch).mock.calls[0]?.[1]
    expect(options).not.toHaveProperty('headers')
    const form = options?.body
    expect(form).toBeInstanceOf(FormData)
    if (form instanceof FormData) {
      expect(form.get('signature')).toBe('signed')
      expect(form.get('type')).toBe('authenticated')
    }
  })
  it('never uploads to an unapproved host or with an expired intent', async () => {
    await expect(
      communityMediaTransport.upload(
        file,
        { ...intent, uploadUrl: 'https://evil.test/upload' },
        new AbortController().signal,
      ),
    ).rejects.toThrow()
    await expect(
      communityMediaTransport.upload(
        file,
        { ...intent, expiresAt: '2020-01-01T00:00:00Z' },
        new AbortController().signal,
      ),
    ).rejects.toThrow('UPLOAD_EXPIRED')
    expect(expoFetch).not.toHaveBeenCalled()
  })
})
