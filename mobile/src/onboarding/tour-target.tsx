import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  type ReactNode,
  type RefObject,
} from 'react'
import { View, type ViewProps } from 'react-native'
import type { TourRect } from './tour-layout'

export type TourAnchor = {
  route: string
  node: RefObject<View | null>
  reveal?: (node: View) => void
  title?: string | undefined
  description?: string | undefined
}
type Registry = Map<string, Map<symbol, TourAnchor>>
const Targets = createContext<Registry | null>(null)
export const TourScrollContext = createContext<
  ((node: View) => void) | undefined
>(undefined)

export function TourTargetsProvider({ children }: { children: ReactNode }) {
  const registry = useMemo<Registry>(() => new Map(), [])
  return <Targets.Provider value={registry}>{children}</Targets.Provider>
}

export function useTourTargets() {
  return useContext(Targets)
}

export function useRegisterTourTarget(
  id: string | undefined,
  route: string,
  node: RefObject<View | null>,
  title?: string,
  description?: string,
) {
  const registry = useTourTargets()
  const reveal = useContext(TourScrollContext)
  useLayoutEffect(() => {
    if (!registry || !id) return
    const token = Symbol(id)
    const entries = registry.get(id) ?? new Map<symbol, TourAnchor>()
    entries.set(token, {
      route,
      node,
      title,
      description,
      ...(reveal ? { reveal } : {}),
    })
    registry.set(id, entries)
    return () => {
      entries.delete(token)
      if (!entries.size) registry.delete(id)
    }
  }, [registry, id, route, reveal, title, description, node])
}

export function TourTarget({
  id,
  route,
  title,
  description,
  children,
  ...props
}: ViewProps & {
  id?: string | undefined
  route: string
  title?: string | undefined
  description?: string | undefined
  children: ReactNode
}) {
  const node = useRef<View>(null)
  useRegisterTourTarget(id, route, node, title, description)
  return (
    <View {...props} ref={node} collapsable={false} nativeID={id} testID={id}>
      {children}
    </View>
  )
}

export function findTourTarget(
  registry: Registry | null,
  id: string,
  route: string,
) {
  return [...(registry?.get(id)?.values() ?? [])]
    .reverse()
    .find((anchor) => anchor.route === route && anchor.node.current)
}

export function measureTourTarget(node: View): Promise<TourRect | null> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(null), 250)
    node.measureInWindow((x, y, width, height) => {
      clearTimeout(timeout)
      resolve(width > 0 && height > 0 ? { x, y, width, height } : null)
    })
  })
}
