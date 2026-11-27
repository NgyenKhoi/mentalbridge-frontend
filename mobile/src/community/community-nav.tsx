import { createContext, useContext } from 'react'

export type CommunityNav = Readonly<{
  openFriends?: () => void
  openGroups?: () => void
  openMember?: (profileId: string) => void
}>

export const CommunityNavContext = createContext<CommunityNav>({})
export const useCommunityNav = () => useContext(CommunityNavContext)
