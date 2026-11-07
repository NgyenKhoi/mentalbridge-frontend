import type { Metadata } from 'next'

import CommunityShell from '@/features/community/components/CommunityShell'
import { CommunityPresenceProvider } from '@/features/community-chat/components/CommunityPresenceProvider'
import { CommunityInboxProvider } from '@/features/community-chat/components/CommunityInboxProvider'
import { requireCurrentAccount } from '@/lib/auth/dal'

import './community/community.css'

export const metadata: Metadata = {
  title: 'Cộng đồng đồng hành | MentalBridge',
  description:
    'Không gian đồng hành ẩn danh hoặc dùng danh tính cộng đồng, dành cho những câu chuyện và nguồn lực hỗ trợ an toàn.',
}

export default async function CommunityLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requireCurrentAccount(['USER'])

  return (
    <CommunityInboxProvider>
      <CommunityPresenceProvider>
        <CommunityShell>{children}</CommunityShell>
      </CommunityPresenceProvider>
    </CommunityInboxProvider>
  )
}
