# 🎨 MentalBridge Design System

## 📊 CSS Variables (`:root`)

### Colors - Palette chính
```css
/* Background */
--bg: #F1F4EB              /* Sage background chính */
--bg-deep: #E7EDE1         /* Sage đậm hơn */
--surface: #FFFFFF         /* White cho cards */
--surface-soft: #E9EFE3    /* White nhẹ hơn */

/* Text */
--ink: #1B2A22             /* Text chính (đậm) */
--ink-soft: #52604F        /* Text secondary */
--ink-faint: #8A9585       /* Text mờ nhất */

/* Teal (Primary brand color) */
--teal-deep: #1E4A43       /* Teal đậm - headings, buttons */
--teal: #3D7A6E            /* Teal medium */
--teal-pale: #CFE3D8       /* Teal nhạt - backgrounds */

/* Accent colors */
--amber: #E1A651           /* Amber - CTA, highlights */
--amber-soft: #F5E6C6      /* Amber nhạt */
--terracotta: #C77B5C      /* Terracotta - warnings */
--terracotta-soft: #F0DACC /* Terracotta nhạt */
--lavender: #9A8CAE        /* Lavender - accents */

/* Utilities */
--line: rgba(27,42,34,.12) /* Border color */
--shadow: 0 20px 50px -20px rgba(30,74,67,.25)
--radius: 22px
--wrap: 1180px             /* Max content width */
```

### Icon color classes (đã có)
```css
.fi-teal { background: var(--teal-pale); color: var(--teal-deep); }
.fi-amber { background: var(--amber-soft); color: #8a5a1f; }
.fi-terra { background: var(--terracotta-soft); color: #8a4a2e; }
.fi-lav { background: #E7E1EE; color: var(--lavender); }
```

---

## 🔤 Typography

### Fonts
```tsx
// Fraunces - Serif (Headings)
font-family: var(--font-fraunces), serif
weights: 300, 400, 500, 600, 700
styles: normal, italic

// Be Vietnam Pro - Sans (Body)
font-family: var(--font-be-vietnam), sans-serif
weights: 300, 400, 500, 600, 700, 800
```

### Heading styles
```css
h1, h2, h3, h4 {
  font-family: var(--font-fraunces), serif;
  font-weight: 500;
  letter-spacing: -.01em;
  color: var(--teal-deep);
}
```

---

## 🎯 Component Patterns

### Buttons
```css
/* Primary Button */
.btn-primary {
  background: var(--teal-deep);
  color: #fff;
  box-shadow: 0 10px 24px -10px rgba(30,74,67,.55);
  /* Shimmer effect on hover */
}

/* Outline Button */
.btn-outline {
  border: 1.5px solid var(--line);
  color: var(--teal-deep);
  background: var(--surface);
}

/* Ghost Button */
.btn-ghost {
  color: var(--teal-deep);
  font-weight: 600;
  font-size: 15px;
}

/* Base button styles */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 13px 26px;
  border-radius: 999px;
  font-weight: 600;
  font-size: 15px;
  transition: transform .3s cubic-bezier(.16,1,.3,1),
              box-shadow .3s ease,
              background .3s ease;
  white-space: nowrap;
}
```

### Cards
```css
/* Feature Card */
.feature-card {
  background: var(--surface);
  border-radius: 20px;
  padding: 36px 30px;
  border: 1px solid var(--line);
  transition: transform .4s cubic-bezier(.16,1,.3,1),
              box-shadow .4s ease,
              border-color .4s ease;
}
.feature-card:hover {
  transform: translateY(-6px);
  box-shadow: var(--shadow);
  border-color: transparent;
}

/* Risk Card (3 variants: low, mid, high) */
.risk-card {
  border-radius: var(--radius);
  padding: 38px 32px;
  border: 1px solid var(--line);
  background: var(--surface);
  transition: transform .4s cubic-bezier(.16,1,.3,1);
}
.risk-card:hover { transform: translateY(-6px); }

/* Float Card (với animation) */
.float-card {
  position: absolute;
  border-radius: 16px;
  transition: transform .18s linear;
}
.float-inner {
  background: var(--surface);
  border-radius: 16px;
  padding: 14px 16px;
  box-shadow: var(--shadow);
  animation: float 6s ease-in-out infinite;
  border: 1px solid var(--line);
}
```

### Section Headers
```css
.eyebrow {
  font-size: 13px;
  font-weight: 600;
  letter-spacing: .14em;
  text-transform: uppercase;
  color: var(--teal);
  display: flex;
  align-items: center;
  gap: 10px;
}
.eyebrow::before {
  content: "";
  width: 22px;
  height: 1px;
  background: var(--teal);
}

.section-head {
  max-width: 640px;
  margin-bottom: 64px;
}
.section-head h2 {
  font-size: clamp(30px, 3.4vw, 42px);
  margin-top: 16px;
  line-height: 1.2;
}
```

### Showcase Components (từ phone mockup)
```css
/* Chat Bubbles */
.chat-bubble.bot {
  background: var(--teal-pale);
  color: var(--teal-deep);
  border-bottom-left-radius: 4px;
}
.chat-bubble.user {
  background: var(--teal-deep);
  color: #fff;
  border-bottom-right-radius: 4px;
}

/* Typing Dots */
.typing-dots span {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--teal-deep);
  animation: dot-bounce 1.2s ease-in-out infinite;
}

/* Mood Dots */
.mood-dot {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: var(--surface-soft);
}
.mood-dot.active {
  background: var(--amber);
  box-shadow: 0 0 0 3px var(--amber-soft);
}

/* Score Chip */
.score-chip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--surface-soft);
  border-radius: 12px;
  padding: 10px 12px;
}
.score-chip .sc-num {
  font-family: var(--font-fraunces), serif;
  font-weight: 700;
  color: var(--teal-deep);
  font-size: 18px;
}

/* Streak Chip */
.streak-chip {
  background: var(--teal-pale);
  color: var(--teal-deep);
  font-size: 11px;
  font-weight: 700;
  padding: 8px 12px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  gap: 6px;
}

/* Chart Bars */
.chart-bar {
  flex: 1;
  background: linear-gradient(180deg, var(--teal), var(--teal-deep));
  border-radius: 5px 5px 2px 2px;
  animation: bar-grow 3.2s ease-in-out infinite;
  transform-origin: bottom;
}
```

### Risk Tags (3 levels)
```css
.risk-tag {
  display: inline-block;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: .06em;
  text-transform: uppercase;
  padding: 6px 14px;
  border-radius: 999px;
  margin-bottom: 22px;
}

/* Low level - Teal */
.risk-card.low .risk-tag {
  background: var(--teal-pale);
  color: var(--teal-deep);
}

/* Mid level - Amber */
.risk-card.mid .risk-tag {
  background: var(--amber-soft);
  color: #8a5a1f;
}

/* High level - Terracotta */
.risk-card.high .risk-tag {
  background: var(--terracotta-soft);
  color: #8a4a2e;
}
```

---

## ✨ Animations & Keyframes

### Timing & Easing
```css
/* Primary easing curve - dùng cho mọi transition mượt */
cubic-bezier(.16, 1, .3, 1)

/* Animation durations */
- Quick: 0.3s
- Normal: 0.4s - 0.8s
- Slow: 1.2s - 2s
```

### Scroll Reveal
```css
.reveal {
  opacity: 0;
  transform: translateY(28px);
  transition: opacity .8s cubic-bezier(.16,1,.3,1),
              transform .8s cubic-bezier(.16,1,.3,1);
}
.reveal.visible {
  opacity: 1;
  transform: translateY(0);
}

/* Staggered delays */
.reveal-d1 { transition-delay: .08s; }
.reveal-d2 { transition-delay: .16s; }
.reveal-d3 { transition-delay: .24s; }
.reveal-d4 { transition-delay: .32s; }
.reveal-d5 { transition-delay: .4s; }
```

### Keyframe Animations
```css
/* Ambient drifting (blobs) */
@keyframes driftA {
  0%, 100% { transform: translate(0,0) scale(1); }
  50% { transform: translate(70px,90px) scale(1.15); }
}

/* Breathing (pulsing circle) */
@keyframes breathe {
  0%, 100% { transform: scale(.82); }
  50% { transform: scale(1.05); }
}

/* Float (cards) */
@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-12px); }
}

/* Dot pulse (logo) */
@keyframes dot-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: .55; transform: scale(1.25); }
}

/* Spin (orbits) */
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes spin-rev { to { transform: rotate(-360deg); } }

/* Bar grow (charts) */
@keyframes bar-grow {
  0%, 100% { transform: scaleY(.55); }
  50% { transform: scaleY(1); }
}

/* Dot bounce (typing) */
@keyframes dot-bounce {
  0%, 60%, 100% { transform: translateY(0); opacity: .5; }
  30% { transform: translateY(-4px); opacity: 1; }
}
```

---

## 📱 Responsive Breakpoints

```css
/* Tablet */
@media (max-width: 980px) {
  /* Sidebar → Bottom nav hoặc drawer */
  /* 3 cols → 2 cols */
  /* Hero grid → 1 col */
}

/* Mobile */
@media (max-width: 640px) {
  /* 2 cols → 1 col */
  /* Padding giảm: 32px → 20px */
  /* Font size clamps */
}
```

---

## 🎭 Prefers Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: .001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: .001ms !important;
    scroll-behavior: auto !important;
  }
}
```

---

## 🔧 Trust Numbers (Stats)

```css
.trust-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.trust-num {
  font-family: var(--font-fraunces), serif;
  font-size: 26px;
  color: var(--teal-deep);
  font-weight: 600;
}
.trust-label {
  font-size: 13px;
  color: var(--ink-faint);
}
```

---

## 📐 Layout Utilities

```css
.wrap {
  max-width: var(--wrap); /* 1180px */
  margin: 0 auto;
  padding: 0 32px;
}

.section {
  padding: 120px 0;
}

/* Responsive padding */
@media (max-width: 640px) {
  .wrap { padding: 0 20px; }
  .section { padding: 80px 0; }
}
```

---

## ✅ Component Checklist cho màn mới

Khi tạo component mới, PHẢI sử dụng:

- ✅ Colors: chỉ từ palette đã có
- ✅ Fonts: Fraunces (headings) + Be Vietnam Pro (body)
- ✅ Buttons: `.btn-primary`, `.btn-outline`, `.btn-ghost`
- ✅ Cards: `.feature-card`, `.risk-card` pattern
- ✅ Animations: `.reveal`, hover `-6px`, easing `cubic-bezier(.16,1,.3,1)`
- ✅ Icons: SVG line-style, `stroke-width="1.6"`
- ✅ Spacing: dùng multiples của 8px (16, 24, 32, 40...)
- ✅ Radius: `var(--radius)` (22px) hoặc `border-radius: 999px` cho pills
- ✅ Shadow: `var(--shadow)` hoặc variations
- ✅ Border: `border: 1px solid var(--line)`

---

## 🚫 KHÔNG ĐƯỢC

- ❌ Tạo màu mới ngoài palette
- ❌ Dùng font khác (Google Fonts khác, system fonts...)
- ❌ Tạo easing curve mới (dùng `cubic-bezier(.16,1,.3,1)`)
- ❌ Tạo radius mới (dùng `var(--radius)` hoặc 999px)
- ❌ Viết CSS trùng lặp (dùng lại class đã có)
- ❌ Thay đổi timing animations hiện có

---

**Principle**: "Cảm giác cùng một sản phẩm" - mọi màn hình mới phải như một phần tự nhiên của landing page.
