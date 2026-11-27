'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import type { ServiceCreditAccount } from '@/lib/consultation/consultation-validation'
import {
  clearUpgradeIntent,
  hasUpgradeIntent,
  planAccessFrom,
} from './plan-access'
import './locked-plan-preview.css'

/**
 * After checkout, offers the way back to Plan once Consultation itself reports
 * paid Plan access. A browser "success" alone never shows it.
 */
export default function PlanUpgradeContinue({
  account,
}: Readonly<{ account: ServiceCreditAccount }>) {
  if (planAccessFrom(account) !== 'paid' || !hasUpgradeIntent()) return null
  return (
    <div className="lpp-continue lpp-rise" role="status">
      <div className="lpp-continue-text">
        <strong>Gói đã sẵn sàng.</strong> Kế hoạch 14 ngày giờ đã mở với bạn.
      </div>
      <Link
        className="lpp-go lpp-cta"
        href="/support-plan"
        onClick={() => clearUpgradeIntent()}
      >
        Tiếp tục tới kế hoạch <ArrowRight size={18} aria-hidden="true" />
      </Link>
    </div>
  )
}
