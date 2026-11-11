import AiCompanionChat from '@/features/ai-companion/components/AiCompanionChat'
import { requireCurrentAccount } from '@/lib/auth/dal'

export default async function AiCompanionPage() {
  const account = await requireCurrentAccount(['USER'])

  return (
    <div className="ref-still" data-page-motion="off">
      <AiCompanionChat key={account.accountId} accountId={account.accountId} />
    </div>
  )
}
