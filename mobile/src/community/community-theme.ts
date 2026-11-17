import { dashboardColors } from '@/theme/dashboard'

// White + green, the palette of the web Dashboard and mobile Home. Every Community and community-chat file takes colours from here.
export const communityColors = {
  background: dashboardColors.white,
  soft: dashboardColors.surfaceSoft,
  ink: dashboardColors.ink,
  inkSoft: dashboardColors.inkSoft,
  inkMuted: '#6B737B',
  primary: dashboardColors.teal,
  primaryDeep: dashboardColors.tealDeep,
  mint: dashboardColors.tealPale,
  line: 'rgba(26, 28, 30, 0.08)',
  danger: '#9B352D',
  white: dashboardColors.white,
  terracotta: dashboardColors.terracotta,
  terracottaLine: 'rgba(199, 123, 92, 0.34)',
  lavender: '#9A8CAE',
  lavenderPale: '#EAE5F0',
  scrim: 'rgba(26, 28, 30, 0.45)',
  // Moments viewer: a dark page with flat translucent layers over the video.
  momentsBackground: '#0B0F0D',
  onDarkTrack: 'rgba(255, 255, 255, 0.25)',
  onDarkSoft: 'rgba(255, 255, 255, 0.78)',
  onDarkLayer: 'rgba(11, 15, 13, 0.5)',
  shadow: '#000000',
} as const

// Avatar preset tints, ported from web community.css.
export const communityAvatarTints = {
  green: { background: '#DCEBE2', icon: communityColors.primaryDeep },
  sun: { background: '#F8E8BC', icon: '#9B631B' },
  blue: { background: '#DCECF2', icon: '#35667B' },
  rose: { background: '#F5DFE7', icon: '#8D4963' },
  deleted: { background: '#ECEFED', icon: communityColors.inkSoft },
} as const
