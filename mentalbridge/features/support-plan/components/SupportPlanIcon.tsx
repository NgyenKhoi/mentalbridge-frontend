import {
  ArrowRight,
  BookOpen,
  Brain,
  CalendarDays,
  CalendarRange,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  CirclePause,
  CirclePlay,
  Flower2,
  Heart,
  History,
  Info,
  LayoutList,
  LockKeyhole,
  MessageSquare,
  Minus,
  NotebookPen,
  Phone,
  RotateCw,
  Share2,
  ShieldCheck,
  SlidersHorizontal,
  Smile,
  Sparkles,
  TrendingUp,
} from 'lucide-react'

const icons = {
  arrow_forward: ArrowRight,
  arrow_right_alt: ArrowRight,
  auto_mode: RotateCw,
  calendar_month: CalendarDays,
  calendar_today: CalendarDays,
  calendar_view_week: CalendarRange,
  call: Phone,
  chat: MessageSquare,
  check: Check,
  check_circle: CircleCheck,
  chevron_left: ChevronLeft,
  chevron_right: ChevronRight,
  edit_note: NotebookPen,
  expand_more: ChevronDown,
  favorite: Heart,
  health_and_safety: ShieldCheck,
  history: History,
  hotel_class: Sparkles,
  info: Info,
  lock: LockKeyhole,
  menu_book: BookOpen,
  message: MessageSquare,
  pause_circle: CirclePause,
  play_circle: CirclePlay,
  psychology: Brain,
  remove: Minus,
  self_improvement: Flower2,
  sentiment_satisfied: Smile,
  settings_suggest: SlidersHorizontal,
  share: Share2,
  show_chart: TrendingUp,
  star: Sparkles,
  verified_user: ShieldCheck,
  view_agenda: LayoutList,
} as const

export type SupportPlanIconName = keyof typeof icons

type Props = Readonly<{
  name: SupportPlanIconName
  size?: number
  className?: string
}>

export default function SupportPlanIcon({ name, size = 18, className }: Props) {
  const Icon = icons[name] ?? Sparkles
  if (!Icon) return null
  return <Icon aria-hidden={true} className={className} size={size} />
}
