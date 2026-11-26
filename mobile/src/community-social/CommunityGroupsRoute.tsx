import { router, useLocalSearchParams } from 'expo-router'
import { z } from 'zod'

import { CommunityCircleScreen } from './CommunityCircleScreen'
import { CommunityGroupsScreen } from './CommunityGroupsScreen'
import { SocialRoute } from './community-social-route'

const circleParam = z.uuid().optional()

export function CommunityGroupsRoute() {
  const params = useLocalSearchParams<{ circleId?: string | string[] }>()
  const circle = circleParam.safeParse(params.circleId)
  return (
    <SocialRoute invalidLink={!circle.success}>
      {({ subject, social, community }) =>
        circle.data ? (
          <CommunityCircleScreen
            api={social}
            community={community}
            subject={subject}
            circleId={circle.data}
            onBack={() => router.back()}
            onLeft={() => router.back()}
          />
        ) : (
          <CommunityGroupsScreen
            api={social}
            subject={subject}
            onBack={() => router.back()}
            onOpenCircle={(circleId) =>
              router.push({
                pathname: '/(user)/community-groups',
                params: { circleId },
              })
            }
          />
        )
      }
    </SocialRoute>
  )
}
