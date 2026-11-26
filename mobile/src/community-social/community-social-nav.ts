import { router } from 'expo-router'
import { z } from 'zod'

const uuid = z.uuid()

export function openMemberPage(profileId: string) {
  if (uuid.safeParse(profileId).success)
    router.push({ pathname: '/(user)/community-member', params: { profileId } })
}

export function openPeerChat(peerId: string) {
  if (uuid.safeParse(peerId).success)
    router.push({ pathname: '/(user)/community-chat', params: { peerId } })
}

export function openCommunityPost(postId: string) {
  if (uuid.safeParse(postId).success)
    router.push({ pathname: '/(user)/community', params: { postId } })
}
