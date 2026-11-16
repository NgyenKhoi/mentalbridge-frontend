import { router } from 'expo-router'

import { CommunityFriendsScreen } from './CommunityFriendsScreen'
import { openMemberPage, openPeerChat } from './community-social-nav'
import { SocialRoute } from './community-social-route'

export function CommunityFriendsRoute() {
  return (
    <SocialRoute invalidLink={false}>
      {({ subject, social }) => (
        <CommunityFriendsScreen
          api={social}
          subject={subject}
          onBack={() => router.back()}
          onOpenMember={openMemberPage}
          onMessage={openPeerChat}
        />
      )}
    </SocialRoute>
  )
}
