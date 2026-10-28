'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'

import {
  resolveMamTarget,
  type MamAnswer,
  type MamIntent,
  type MamTarget,
  type MamTargetDescriptor,
  type MamTargetKind,
} from './mam-targets'

/**
 * A target's own answer for a starter (SupportPlan). Null falls through to the
 * reviewed copy; a rejection becomes the target's fallback text.
 */
export type MamResolver = (
  intent: MamIntent,
  context: Readonly<{
    signal: AbortSignal
    isRegistered: (kind: MamTargetKind) => boolean
  }>,
) => Promise<MamAnswer | null>

// Elements and the page target register here from props. The dock host reads
// them; with the flag off nothing listens, so registering costs nothing.
const elements = new Map<Element, MamTarget>()
const resolvers = new WeakMap<MamTarget, MamResolver>()
let pageTarget: MamTarget | null = null
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((listener) => listener())

export function subscribeMamTargets(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** The nearest registered ancestor of `node`, or null. */
export function findMamTarget(
  node: EventTarget | null,
): { element: Element; target: MamTarget } | null {
  for (
    let element = node instanceof Element ? node : null;
    element;
    element = element.parentElement
  ) {
    const target = elements.get(element)
    if (target) return { element, target }
  }
  return null
}

export function findMamTargetElement(kind: MamTargetKind) {
  for (const [element, target] of elements)
    if (target.kind === kind && element.isConnected) return element
  return null
}

export const isMamTargetMounted = (element: Element) => elements.has(element)

export const getMamPageTarget = () => pageTarget

export const getMamResolver = (target: MamTarget) => resolvers.get(target)

// The registered resolver always calls the latest one, so a re-render never
// re-registers the target.
function useLatestResolver(resolver: MamResolver | undefined) {
  const latest = useRef(resolver)
  useEffect(() => {
    latest.current = resolver
  })
  const [stable] = useState<MamResolver>(() => {
    const call: MamResolver = (intent, context) =>
      latest.current ? latest.current(intent, context) : Promise.resolve(null)
    return call
  })
  return resolver ? stable : undefined
}

/**
 * Registers the element the returned ref lands on. Only the kind and
 * allowlisted context IDs are kept; an invalid descriptor registers nothing.
 */
export function useMamTarget(
  descriptor: MamTargetDescriptor | null,
  resolver?: MamResolver,
) {
  const [element, setElement] = useState<Element | null>(null)
  const kind = descriptor?.kind ?? null
  const context = JSON.stringify(descriptor?.context ?? {})
  const stableResolver = useLatestResolver(resolver)
  useEffect(() => {
    const target = kind
      ? resolveMamTarget({ kind, context: JSON.parse(context) })
      : null
    if (!element || !target) return
    elements.set(element, target)
    if (stableResolver) resolvers.set(target, stableResolver)
    notify()
    return () => {
      elements.delete(element)
      notify()
    }
  }, [element, kind, context, stableResolver])
  return setElement
}

/**
 * Registers the page-level target behind "Hỏi Mầm về trang này". A changed
 * `identity` (the tab, the focus) re-registers it, which closes an open answer
 * about the old one without starting a request.
 */
export function useMamPageTarget(
  descriptor: MamTargetDescriptor | null,
  resolver?: MamResolver,
  identity?: string,
) {
  const kind = descriptor?.kind ?? null
  const stableResolver = useLatestResolver(resolver)
  useEffect(() => {
    const target = kind ? resolveMamTarget({ kind }) : null
    if (!target?.page) return
    pageTarget = target
    if (stableResolver) resolvers.set(target, stableResolver)
    notify()
    return () => {
      if (pageTarget === target) pageTarget = null
      notify()
    }
  }, [kind, stableResolver, identity])
}

export function useMamPageTargetValue() {
  return useSyncExternalStore(subscribeMamTargets, getMamPageTarget, () => null)
}
