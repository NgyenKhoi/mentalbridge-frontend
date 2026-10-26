'use client'

import { useEffect, useRef, useState } from 'react'

import { useReactiveReducedMotion } from '@/lib/animations/use-reduced-motion'

import styles from './MamCharacter.module.css'
import {
  isMamOneShot,
  MAM_ASSET,
  type MamLoopingBehavior,
  type MamOneShot,
} from './mam-contract'
import { createMamControls, type MamControls } from './mam-controls'

export type MamRenderStatus = 'loading' | 'ready' | 'fallback'

export interface MamOneShotCommand {
  kind: MamOneShot
  /**
   * Give every command its own key and keep it stable across re-renders. Only the
   * last fired key is remembered: a re-render with it never replays, a different
   * key fires, so reusing an older key (A, B, A) fires again.
   */
  key: string | number
}

export interface MamCharacterProps {
  size: number
  behavior?: MamLoopingBehavior
  attention?: number
  visible?: boolean
  /** The user's Mầm motion preference; the OS setting forces it on. */
  reducedMotion?: boolean
  oneShot?: MamOneShotCommand | null
  className?: string
  onStatusChange?: (status: MamRenderStatus) => void
}

type RiveModule = typeof import('@rive-app/canvas-lite')
type RiveInstance = InstanceType<RiveModule['Rive']>

function runtimeSupported(canvas: HTMLCanvasElement) {
  return (
    typeof WebAssembly === 'object' &&
    typeof canvas.getContext === 'function' &&
    canvas.getContext('2d') !== null
  )
}

async function initRuntime() {
  const rive = await import('@rive-app/canvas-lite')
  // Self-hosted WASM only: no CDN fallback, so nothing leaves the app origin.
  rive.RuntimeLoader.setWasmUrl(MAM_ASSET.wasmUrl)
  rive.RuntimeLoader.setWasmFallbackUrl(null)
  await new Promise<void>((resolve, reject) =>
    rive.RuntimeLoader.getInstance(() => resolve(), reject),
  )
  return rive
}

async function fetchAsset() {
  const response = await fetch(MAM_ASSET.src)
  if (!response.ok) throw new Error(`Mầm asset HTTP ${response.status}`)
  return response.arrayBuffer()
}

// One runtime and one download per page for every instance; a failure is retried on the next mount.
let loading: Promise<[RiveModule, ArrayBuffer]> | null = null
function loadMam() {
  loading ??= Promise.all([initRuntime(), fetchAsset()])
  loading.catch(() => {
    loading = null
  })
  return loading
}

/**
 * Decorative Mầm renderer. The host supplies every word the user needs, so the
 * character is hidden from assistive technology. Any load or runtime failure,
 * including a lost canvas context, keeps the static pose and never blocks the page.
 */
export function MamCharacter({
  size,
  behavior = 'idle',
  attention = 0,
  visible = true,
  reducedMotion = false,
  oneShot = null,
  className,
  onStatusChange,
}: MamCharacterProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const controlsRef = useRef<MamControls | null>(null)
  const instanceRef = useRef<RiveInstance | null>(null)
  const firedKeyRef = useRef<MamOneShotCommand['key'] | null>(null)
  const appliedBehaviorRef = useRef<MamLoopingBehavior | null>(null)
  const [status, setStatus] = useState<MamRenderStatus>('loading')
  const osReducedMotion = useReactiveReducedMotion()
  const reduced = reducedMotion || osReducedMotion

  const statusListener = useRef(onStatusChange)
  useEffect(() => {
    statusListener.current = onStatusChange
  }, [onStatusChange])
  useEffect(() => {
    statusListener.current?.(status)
  }, [status])

  const desiredBehavior = useRef(behavior)
  useEffect(() => {
    desiredBehavior.current = behavior
  }, [behavior])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !runtimeSupported(canvas)) {
      setStatus('fallback')
      return
    }
    let cancelled = false
    let failed = false
    let instance: RiveInstance | null = null
    let unsubscribe: (() => void) | null = null
    const release = () => {
      unsubscribe?.()
      unsubscribe = null
      controlsRef.current = null
      instanceRef.current = null
      instance?.cleanup()
      instance = null
    }
    // Permanent for this mount: a later load callback can never restore readiness.
    const fail = () => {
      failed = true
      release()
      if (!cancelled) setStatus('fallback')
    }
    canvas.addEventListener('contextlost', fail)

    loadMam()
      .then(([rive, bytes]) => {
        if (cancelled || failed) return
        instance = new rive.Rive({
          // Each instance gets its own copy; the runtime may take ownership of the buffer.
          buffer: bytes.slice(0),
          canvas,
          artboard: MAM_ASSET.artboard,
          stateMachines: MAM_ASSET.stateMachine,
          autoplay: true,
          autoBind: true,
          layout: new rive.Layout({
            fit: rive.Fit.Contain,
            alignment: rive.Alignment.Center,
          }),
          onLoad: () => {
            if (cancelled || failed || !instance) return
            const viewModel = instance.viewModelInstance
            if (!viewModel) return fail()
            let controls: MamControls
            try {
              controls = createMamControls(viewModel)
            } catch {
              return fail()
            }
            // The asset writes `idle` when a one-shot ends or is interrupted;
            // put the host's looping state back once no one-shot is running.
            unsubscribe = controls.onBehaviorChange(() => {
              const current = controls.read().behavior
              if (!isMamOneShot(current) && current !== desiredBehavior.current)
                controls.setBehavior(desiredBehavior.current)
            })
            controlsRef.current = controls
            instanceRef.current = instance
            setStatus('ready')
          },
          onLoadError: fail,
        })
      })
      .catch(fail)

    return () => {
      cancelled = true
      canvas.removeEventListener('contextlost', fail)
      release()
    }
  }, [])

  // Keeps the drawing surface sharp when the host changes the size.
  useEffect(() => {
    if (status === 'ready') instanceRef.current?.resizeDrawingSurfaceToCanvas()
  }, [status, size])

  // Gates first: hidden and reduced motion also stop a running one-shot in the asset.
  useEffect(() => {
    const controls = controlsRef.current
    if (status !== 'ready' || !controls) return
    controls.setVisible(visible)
    controls.setReducedMotion(reduced)
    controls.setAttention(attention)
  }, [status, visible, reduced, attention])

  // A new looping state outranks a running one-shot (ADR arbitration); an
  // unchanged one leaves the one-shot alone.
  useEffect(() => {
    const controls = controlsRef.current
    if (status !== 'ready' || !controls) return
    if (appliedBehaviorRef.current === behavior) return
    const interrupting =
      appliedBehaviorRef.current !== null &&
      isMamOneShot(controls.read().behavior)
    appliedBehaviorRef.current = behavior
    if (interrupting) controls.returnToDock()
    controls.setBehavior(behavior)
  }, [status, behavior])

  useEffect(() => {
    const controls = controlsRef.current
    if (status !== 'ready' || !controls || !oneShot) return
    if (firedKeyRef.current === oneShot.key) return
    firedKeyRef.current = oneShot.key
    controls.playOnce(oneShot.kind)
  }, [status, oneShot])

  return (
    <span
      className={[styles.root, className].filter(Boolean).join(' ')}
      style={{ width: size, height: size }}
      data-mam-status={status}
      data-mam-visible={visible}
      data-mam-reduced={reduced}
      aria-hidden="true"
    >
      {visible ? (
        // Stays mounted under the canvas and hides once the fade-in ends, so the pose never blinks.
        // eslint-disable-next-line @next/next/no-img-element -- static SVG; next/image adds nothing here.
        <img
          className={styles.fallback}
          data-ready={status === 'ready'}
          src={MAM_ASSET.fallbackSrc}
          alt=""
          width={size}
          height={size}
          draggable={false}
        />
      ) : null}
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        data-ready={status === 'ready'}
        width={size}
        height={size}
      />
    </span>
  )
}
