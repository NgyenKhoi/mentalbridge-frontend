export type MobileRole = 'USER' | 'SPECIALIST'

export type AppSession = Readonly<{
  subject: string
  role: MobileRole
}>
