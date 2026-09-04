# Migration Notes: HTML → Next.js

## Chuyển đổi hoàn tất ✅

File `mentalbridge-trangchu.html` đã được chuyển đổi 100% sang Next.js 14+ với TypeScript.

## Chi tiết chuyển đổi

### 1. CSS (app/globals.css)

- ✅ Copy toàn bộ `<style>` tag từ HTML gốc
- ✅ Thay thế font-family references:
  - `'Fraunces',serif` → `var(--font-fraunces),serif`
  - `'Be Vietnam Pro',sans-serif` → `var(--font-be-vietnam),sans-serif`
- ✅ Giữ nguyên tất cả:
  - CSS variables (`:root`)
  - Keyframes (@keyframes)
  - Media queries
  - Pseudo-elements
  - Animations

### 2. HTML → JSX Components

#### Header.tsx

- ✅ `<header>` structure giữ nguyên
- ✅ `useEffect` cho scroll listener
- ✅ `headerRef` thay cho `document.getElementById`
- ✅ SVG attributes: `stroke-width` → `strokeWidth`

#### Hero.tsx

- ✅ Structure giữ nguyên đầy đủ
- ✅ 3 useEffect riêng biệt cho:
  1. Breathing label (4s interval)
  2. Mouse parallax (mousemove/mouseleave)
  3. Float cards collection
- ✅ CSS custom properties trong inline style:
  ```tsx
  style={{left:'8%', '--dur':'9s'} as React.CSSProperties}
  ```
- ✅ Respect `prefers-reduced-motion`
- ✅ Refs: `heroVisualRef`, `heroGlowRef`, `breatheStageRef`, `breatheLabelRef`

#### Showcase.tsx

- ✅ Phone mockup structure giữ nguyên
- ✅ 3 slides: AI chat, Journal, Chart
- ✅ `useEffect` cho slide cycling (3.6s)
- ✅ `phoneRef` để query slides
- ✅ First slide active on mount

#### Journey.tsx

- ✅ Journey path với 5 steps
- ✅ IntersectionObserver cho progress bar
- ✅ `data-step` attributes giữ nguyên
- ✅ SVG arc path giữ nguyên
- ✅ `journeyFillRef` cho progress bar width

#### Các components khác (Barriers, Features, RiskLevels, Hotline, Cta, Footer)

- ✅ Pure presentational components
- ✅ HTML structure giữ nguyên 100%
- ✅ SVG inline với JSX syntax
- ✅ Escape quotes: `"` → `&quot;`

#### ScrollReveal.tsx

- ✅ Client component riêng cho reveal animation
- ✅ IntersectionObserver (threshold: 0.15)
- ✅ Auto unobserve sau khi visible
- ✅ Null component (không render gì)

### 3. JavaScript → React Hooks

#### Original JS → React mapping:

**1. Header scroll (line 958-961)**

```js
// Original
const header = document.getElementById('site-header')
window.addEventListener(
  'scroll',
  () => {
    header.classList.toggle('scrolled', window.scrollY > 12)
  },
  { passive: true },
)
```

```tsx
// React
const headerRef = useRef<HTMLElement>(null)
useEffect(() => {
  const handleScroll = () => {
    headerRef.current?.classList.toggle('scrolled', window.scrollY > 12)
  }
  window.addEventListener('scroll', handleScroll, { passive: true })
  return () => window.removeEventListener('scroll', handleScroll)
}, [])
```

**2. Scroll reveal (line 963-971)**

```js
// Original
const revealEls = document.querySelectorAll('.reveal')
const io = new IntersectionObserver(
  (entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add('visible')
        io.unobserve(e.target)
      }
    })
  },
  { threshold: 0.15 },
)
```

```tsx
// React
useEffect(() => {
  const revealEls = document.querySelectorAll('.reveal')
  const io = new IntersectionObserver(...)
  revealEls.forEach(el => io.observe(el))
  return () => revealEls.forEach(el => io.unobserve(el))
}, [])
```

**3. Journey progress (line 973-984)**

```js
// Original
const journeyFill = document.getElementById('journeyFill')
const journeyIO = new IntersectionObserver(
  (entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        const step = parseInt(e.target.dataset.step, 10)
        e.target.classList.add('on')
        const pct = ((step - 1) / 4) * 100
        if (parseFloat(journeyFill.style.width || '0') < pct) {
          journeyFill.style.width = pct + '%'
        }
      }
    })
  },
  { threshold: 0.6 },
)
```

```tsx
// React
const journeyFillRef = useRef<HTMLDivElement>(null)
useEffect(() => {
  const journeyFill = journeyFillRef.current
  const journeySteps = document.querySelectorAll('.journey-step')
  const journeyIO = new IntersectionObserver(...)
  // ... same logic
  return () => journeySteps.forEach(el => journeyIO.unobserve(el))
}, [])
```

**4. Breathing label (line 986-991)**

```js
// Original
const label = document.getElementById('breatheLabel')
let breatheIn = true
setInterval(() => {
  breatheIn = !breatheIn
  label.textContent = breatheIn ? 'Hít vào...' : 'Thở ra...'
}, 4000)
```

```tsx
// React
const breatheLabelRef = useRef<HTMLSpanElement>(null)
useEffect(() => {
  const label = breatheLabelRef.current
  let breatheIn = true
  const interval = setInterval(() => {
    breatheIn = !breatheIn
    label!.textContent = breatheIn ? 'Hít vào...' : 'Thở ra...'
  }, 4000)
  return () => clearInterval(interval)
}, [])
```

**5. Hero parallax (line 993-1023)**

```js
// Original
const heroVisual = document.getElementById('heroVisual');
const heroGlow = document.getElementById('heroGlow');
const breatheStage = document.getElementById('breatheStage');
const floatCards = heroVisual ? heroVisual.querySelectorAll('.float-card') : [];
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (heroVisual && !reduceMotion) {
  heroVisual.addEventListener('mousemove', (e) => { ... });
  heroVisual.addEventListener('mouseleave', () => { ... });
}
```

```tsx
// React
const heroVisualRef = useRef<HTMLDivElement>(null)
const heroGlowRef = useRef<HTMLDivElement>(null)
const breatheStageRef = useRef<HTMLDivElement>(null)

useEffect(() => {
  const heroVisual = heroVisualRef.current
  // ... same logic with refs
  const handleMouseMove = (e: MouseEvent) => { ... }
  const handleMouseLeave = () => { ... }

  heroVisual?.addEventListener('mousemove', handleMouseMove)
  heroVisual?.addEventListener('mouseleave', handleMouseLeave)

  return () => {
    heroVisual?.removeEventListener('mousemove', handleMouseMove)
    heroVisual?.removeEventListener('mouseleave', handleMouseLeave)
  }
}, [])
```

**6. Phone slides (line 1025-1032)**

```js
// Original
const phoneSlides = document.querySelectorAll('.phone-slide')
if (phoneSlides.length) {
  let slideIdx = 0
  setInterval(() => {
    phoneSlides[slideIdx].classList.remove('active')
    slideIdx = (slideIdx + 1) % phoneSlides.length
    phoneSlides[slideIdx].classList.add('active')
  }, 3600)
}
```

```tsx
// React
const phoneRef = useRef<HTMLDivElement>(null)
useEffect(() => {
  const phoneSlides = phoneRef.current?.querySelectorAll('.phone-slide')
  if (!phoneSlides?.length) return

  phoneSlides[0].classList.add('active')
  let slideIdx = 0

  const interval = setInterval(() => {
    phoneSlides[slideIdx].classList.remove('active')
    slideIdx = (slideIdx + 1) % phoneSlides.length
    phoneSlides[slideIdx].classList.add('active')
  }, 3600)

  return () => clearInterval(interval)
}, [])
```

### 4. Fonts (app/layout.tsx)

```tsx
import { Fraunces, Be_Vietnam_Pro } from 'next/font/google'

const fraunces = Fraunces({
  subsets: ['latin', 'vietnamese'],
  weight: ['300', '400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-fraunces-variable',
  display: 'swap',
})

const beVietnamPro = Be_Vietnam_Pro({
  subsets: ['latin', 'vietnamese'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-be-vietnam-variable',
  display: 'swap',
})

// Apply to body
<body className={`${fraunces.variable} ${beVietnamPro.variable}`}>
```

### 5. Structure (app/page.tsx)

```tsx
import Header from '@/components/Header'
// ... all components

export default function Home() {
  return (
    <>
      <Header />
      <main id="top">
        <Hero />
        <Showcase />
        <Barriers />
        <Journey />
        <Features />
        <RiskLevels />
        <Hotline />
        <Cta />
      </main>
      <Footer />
      <ScrollReveal />
    </>
  )
}
```

## Verification Checklist

- ✅ Build thành công: `npm run build`
- ✅ Không có TypeScript errors
- ✅ Không có ESLint warnings
- ✅ Static generation successful (○ Static)
- ✅ Tất cả animations hoạt động
- ✅ Scroll reveal hoạt động
- ✅ Header scroll state hoạt động
- ✅ Journey progress bar hoạt động
- ✅ Breathing label animation hoạt động
- ✅ Hero parallax hoạt động
- ✅ Phone slide cycling hoạt động
- ✅ Responsive design giữ nguyên (980px, 640px)
- ✅ Font loading qua Next.js optimization
- ✅ No hydration mismatch
- ✅ Client-side JavaScript safe

## Testing

```bash
# Development
cd mentalbridge
npm run dev
# → http://localhost:3000

# Production build
npm run build
npm start
# → http://localhost:3000
```

## Notes

- Tất cả `"use client"` directives được đặt ở đầu các components cần client-side JS
- Refs thay thế `getElementById` và `querySelector`
- Event listeners đều có cleanup trong `useEffect` return
- IntersectionObserver có cleanup (unobserve)
- Intervals có cleanup (clearInterval)
- TypeScript types cho refs: `useRef<HTMLDivElement>(null)`
- Inline styles với custom properties: `as React.CSSProperties`
- SVG attributes: camelCase (strokeWidth, strokeLinecap)
- HTML entities: `&quot;` thay cho `"`
