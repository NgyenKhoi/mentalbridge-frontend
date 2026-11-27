'use client'

import dynamic from 'next/dynamic'
import { useEffect, useRef, useState } from 'react'
import { Phone } from 'lucide-react'
import styles from './Voice.module.css'

const VoiceDialog = dynamic(() => import('./VoiceDialog'), { ssr: false })
export default function VoiceEntry({
  placement,
  conversation,
  autoOpen = false,
}: {
  placement: 'desktop' | 'mobile'
  conversation?: { conversationId: string; title: string }
  /** Opens the call once, as if the button was pressed (Mầm guide "Gọi cho Mầm"); only the visible entry opens. */
  autoOpen?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [instance, setInstance] = useState(0)
  const [selectedConversation, setSelectedConversation] = useState(conversation)
  const button = useRef<HTMLButtonElement | null>(null)
  const opened = useRef(false)
  const start = () => {
    setSelectedConversation(conversation)
    setInstance((value) => value + 1)
    setOpen(true)
  }
  useEffect(() => {
    if (!autoOpen || opened.current) return
    if (!button.current || button.current.offsetParent === null) return
    opened.current = true
    start()
    // `start` reads the conversation of this render; opening once is the point.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpen])
  return (
    <>
      <button
        ref={button}
        type="button"
        className={`${styles.entry} ${styles.iconButton} ${placement === 'mobile' ? styles.mobileEntry : styles.desktopEntry}`}
        aria-label="Gọi AI"
        title="Gọi AI"
        onClick={start}
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
