import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'

import { MamCharacter, type MamRenderStatus } from '@/features/mam/MamCharacter'
import {
  MAM_LOOPING_BEHAVIORS,
  type MamOneShot,
} from '@/features/mam/mam-contract'

import '../../app/globals.css'

// Standalone renderer review: every V1 state plus the controls MB-767 owns.
const params = new URLSearchParams(window.location.search)
const size = Number(params.get('size') ?? 160)

function Harness() {
  const [statuses, setStatuses] = useState<Record<string, MamRenderStatus>>({})
  const [shot, setShot] = useState<{ kind: MamOneShot; key: number } | null>(
    null,
  )
  const [reduced, setReduced] = useState(params.get('reduced') === '1')
  const [visible, setVisible] = useState(true)
  const [heroBehavior, setHeroBehavior] = useState<'idle' | 'thinking'>('idle')
  const track = (id: string) => (status: MamRenderStatus) =>
    setStatuses((current) => ({ ...current, [id]: status }))

  return (
    <main style={{ padding: 24, display: 'grid', gap: 24 }}>
      <section
        data-testid="states"
        style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}
      >
        {MAM_LOOPING_BEHAVIORS.map((behavior) => (
          <figure key={behavior} style={{ margin: 0, textAlign: 'center' }}>
            <MamCharacter
              size={size}
              behavior={behavior}
              reducedMotion={reduced}
              onStatusChange={track(behavior)}
            />
            <figcaption>{behavior}</figcaption>
          </figure>
        ))}
      </section>
      <section style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
        <div data-testid="hero-cell" style={{ background: 'var(--bg)' }}>
          <MamCharacter
            size={240}
            oneShot={shot}
            behavior={heroBehavior}
            visible={visible}
            reducedMotion={reduced}
            onStatusChange={track('hero')}
          />
        </div>
        <div style={{ display: 'grid', gap: 8 }}>
          {(['celebrate_hero', 'celebrate_soft', 'light_success'] as const).map(
            (kind) => (
              <button
                key={kind}
                type="button"
                onClick={() =>
                  setShot((current) => ({ kind, key: (current?.key ?? 0) + 1 }))
                }
              >
                {kind}
              </button>
            ),
          )}
          <button
            type="button"
            onClick={() =>
              setHeroBehavior((value) =>
                value === 'idle' ? 'thinking' : 'idle',
              )
            }
          >
            behavior: {heroBehavior}
          </button>
          <button type="button" onClick={() => setReduced((value) => !value)}>
            reduced motion: {String(reduced)}
          </button>
          <button type="button" onClick={() => setVisible((value) => !value)}>
            visible: {String(visible)}
          </button>
        </div>
      </section>
      <output data-testid="statuses">{JSON.stringify(statuses)}</output>
    </main>
  )
}

const root = document.getElementById('root')
if (!root) throw new Error('Mầm harness root is missing.')
createRoot(root).render(
  <StrictMode>
    <Harness />
  </StrictMode>,
)
