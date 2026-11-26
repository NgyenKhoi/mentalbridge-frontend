import { createContext } from 'react'

export const CrisisSupportOffsetContext = createContext<
  (height: number) => void
>(() => undefined)
