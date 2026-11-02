'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import { Phone } from 'lucide-react'
import styles from './Voice.module.css'

const VoiceDialog = dynamic(() => import('./VoiceDialog'), { ssr: false })
export default function VoiceEntry({
  placement,
  conversation,
}: {
  placement: 'desktop' | 'mobile'
  conversation?: { conversationId: string; title: string }
}) {
  const [open, setOpen] = useState(false)
  const [instance, setInstance] = useState(0)
  const [selectedConversation, setSelectedConversation] = useState(conversation)
  return (
    <>
      <button
        type="button"
        className={`${styles.entry} ${styles.iconButton} ${placement === 'mobile' ? styles.mobileEntry : styles.desktopEntry}`}
        aria-label="Gọi AI"
        title="Gọi AI"
        onClick={() => {
          setSelectedConversation(conversation)
          setInstance((value) => value + 1)
          setOpen(true)
        }}
        aria-haspopup="dialog"
      >
        <Phone size={20} aria-hidden="true" />
      </button>
      {instance > 0 ? (
        <VoiceDialog
          key={instance}
          open={open}
          onOpenChange={setOpen}
          conversation={selectedConversation}
        />
      ) : null}
    </>
  )
}
