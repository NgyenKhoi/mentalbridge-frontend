import { router, useLocalSearchParams } from 'expo-router'
import { z } from 'zod'

import { CommunityMemberScreen } from './CommunityMemberScreen'
import { openCommunityPost, openPeerChat } from './community-social-nav'
import { SocialRoute } from './community-social-route'

export function CommunityMemberRoute() {
  const params = useLocalSearchParams<{ profileId?: string | string[] }>()
  const profileId = z.uuid().safeParse(params.profileId)
  return (
    <SocialRoute invalidLink={!profileId.success}>
      {({ subject, social, community }) =>
        profileId.success ? (
          <CommunityMemberScreen
            social={social}
            community={community}
            subject={subject}
            profileId={profileId.data}
            onBack={() => router.back()}
            onMessage={openPeerChat}
            onOpenPost={openCommunityPost}
            onBlocked={() => router.back()}
          />
        ) : null
      }
    </SocialRoute>
  )
}
