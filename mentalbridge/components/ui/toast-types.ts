export type ToastTone = 'success' | 'error' | 'warning' | 'info'

export type ToastInput = Readonly<{
  title: string
  description?: string
  tone?: ToastTone
  duration?: number
}>

export type ToastItem = ToastInput &
  Readonly<{
    id: string
    tone: ToastTone
    duration: number
  }>
