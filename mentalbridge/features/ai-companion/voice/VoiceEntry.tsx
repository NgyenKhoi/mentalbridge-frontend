'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import { Phone } from 'lucide-react'
import styles from './Voice.module.css'

const VoiceDialog = dynamic(() => import('./VoiceDialog'), { ssr: false })
export default function VoiceEntry({
  placement,
}: {
  placement: 'desktop' | 'mobile'
}) {
  const [open, setOpen] = useState(false)
  const [instance, setInstance] = useState(0)
  return (
    <>
      <button
        type="button"
        className={`${styles.entry} ${placement === 'mobile' ? styles.mobileEntry : styles.desktopEntry}`}
        onClick={() => {
          setInstance((value) => value + 1)
          setOpen(true)
        }}
        aria-haspopup="dialog"
      >
        <Phone size={16} aria-hidden="true" /> Gọi AI
      </button>
      {instance > 0 ? (
        <VoiceDialog key={instance} open={open} onOpenChange={setOpen} />
      ) : null}
    </>
  )
}
