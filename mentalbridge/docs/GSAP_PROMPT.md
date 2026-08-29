# GSAP ScrollTrigger Animation Upgrade — MentalBridge

## Context

This is a Next.js 16.3 / React 19 / TypeScript project.  
Font stack: **Fraunces** (serif display) + **Be Vietnam Pro** (sans body).  
Design palette CSS variables: `--teal-deep #1E4A43`, `--teal #3D7A6E`, `--amber #E1A651`,
`--terracotta #C77B5C`, `--lavender #9A8CAE`, `--bg #F1F4EB`, `--ink #1B2A22`.  
`framer-motion ^13.1.0` is already in `package.json` (used zero times on landing page — do not remove it).  
**GSAP is not yet installed.** You must install it first.

---

## Step 0 — Install GSAP

```bash
npm install gsap@^3.12.7
```

---

## Goal

Replace the current CSS-class-based `ScrollReveal` system with a full
**GSAP 3 + ScrollTrigger** animation layer that is:

- More expressive (per-element, directional, scrubbed, pinned)
- Smooth (60 fps, `will-change` managed by GSAP)
- Accessible (`prefers-reduced-motion` fully respected — skip all GSAP animations when true)
- SSR-safe (all GSAP code inside `useEffect`, never at module level)
- Next.js `'use client'` where required

---

## Files to create / modify

### 1. `components/ScrollReveal.tsx` — REPLACE entirely

This component currently uses `IntersectionObserver` + CSS class toggle.  
**Replace** the whole file with a GSAP ScrollTrigger version:

```tsx
'use client'

import { useEffect } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

export default function ScrollReveal() {
  useEffect(() => {
    if (typeof window === 'undefined') return

    // Respect prefers-reduced-motion
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion) {
      // Make all reveal elements visible immediately without animation
      document.querySelectorAll('.reveal').forEach(el => {
        ;(el as HTMLElement).style.opacity = '1'
        ;(el as HTMLElement).style.transform = 'none'
      })
      return
    }

    gsap.registerPlugin(ScrollTrigger)

    // ── 1. Generic .reveal elements ──────────────────────────────
    // Group siblings inside the same parent so they stagger together
    const revealEls = gsap.utils.toArray<HTMLElement>('.reveal')

    // Group by parent to create sibling staggers
    const groups = new Map<Element, HTMLElement[]>()
    revealEls.forEach(el => {
      const parent = el.parentElement!
      if (!groups.has(parent)) groups.set(parent, [])
      groups.get(parent)!.push(el)
    })

    groups.forEach((els, parent) => {
      // Sort by DOM order
      els.sort((a, b) => {
        const pos = a.compareDocumentPosition(b)
        return pos & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
      })

      // Determine direction hint from data attribute or class
      const fromVars = (el: HTMLElement) => {
        if (el.classList.contains('reveal-left'))  return { x: -48, opacity: 0 }
        if (el.classList.contains('reveal-right')) return { x:  48, opacity: 0 }
        if (el.classList.contains('reveal-scale')) return { scale: 0.88, opacity: 0 }
        return { y: 36, opacity: 0 }  // default: rise up
      }

      gsap.set(els, (i: number) => fromVars(els[i]))

      ScrollTrigger.create({
        trigger: parent,
        start: 'top 82%',
        once: true,
        onEnter: () => {
          gsap.to(els, {
            x: 0, y: 0, scale: 1, opacity: 1,
            duration: 0.9,
            ease: 'power4.out',
            stagger: 0.09,
            clearProps: 'transform,opacity',
          })
        },
      })
    })

    // ── 2. Journey progress line — scrub with scroll ─────────────
    const journeyFill = document.getElementById('journeyFill')
    const journeyPath = document.getElementById('journeyPath')
    if (journeyFill && journeyPath) {
      gsap.fromTo(
        journeyFill,
        { width: '0%' },
        {
          width: '100%',
          ease: 'none',
          scrollTrigger: {
            trigger: journeyPath,
            start: 'top 75%',
            end:   'bottom 40%',
            scrub: 1.2,
          },
        }
      )
    }

    // ── 3. Section headings — split-line reveal ──────────────────
    const sectionHeads = gsap.utils.toArray<HTMLElement>('.section-head h2')
    sectionHeads.forEach(heading => {
      gsap.from(heading, {
        y: 32,
        opacity: 0,
        duration: 1,
        ease: 'expo.out',
        scrollTrigger: {
          trigger: heading,
          start: 'top 85%',
          once: true,
        },
      })
    })

    // ── 4. Feature cards — staggered scale-up ────────────────────
    const featureCards = gsap.utils.toArray<HTMLElement>('.feature-card')
    if (featureCards.length) {
      gsap.from(featureCards, {
        y: 50,
        opacity: 0,
        scale: 0.94,
        duration: 0.8,
        ease: 'power3.out',
        stagger: { amount: 0.5, from: 'start' },
        scrollTrigger: {
          trigger: '.feature-grid',
          start: 'top 80%',
          once: true,
        },
      })
    }

    // ── 5. Risk cards — slide in from below with colour pop ───────
    const riskCards = gsap.utils.toArray<HTMLElement>('.risk-card')
    if (riskCards.length) {
      gsap.from(riskCards, {
        y: 60,
        opacity: 0,
        duration: 0.85,
        ease: 'power4.out',
        stagger: 0.12,
        scrollTrigger: {
          trigger: '.risk-grid',
          start: 'top 80%',
          once: true,
        },
      })
    }

    // ── 6. Barrier cards — fan in from left ──────────────────────
    const barrierCards = gsap.utils.toArray<HTMLElement>('.barrier-card')
    if (barrierCards.length) {
      gsap.from(barrierCards, {
        x: -40,
        opacity: 0,
        rotationY: 8,
        transformOrigin: 'left center',
        duration: 0.8,
        ease: 'power3.out',
        stagger: 0.13,
        scrollTrigger: {
          trigger: '.barrier-grid',
          start: 'top 80%',
          once: true,
        },
      })
    }

    // ── 7. Hotline banner — slide up with glow pulse ──────────────
    const hotline = document.querySelector<HTMLElement>('.hotline')
    if (hotline) {
      gsap.from(hotline, {
        y: 48,
        opacity: 0,
        scale: 0.97,
        duration: 1,
        ease: 'expo.out',
        scrollTrigger: {
          trigger: hotline,
          start: 'top 85%',
          once: true,
        },
      })
    }

    // ── 8. CTA block — scale + fade ───────────────────────────────
    const ctaBlock = document.querySelector<HTMLElement>('.cta')
    if (ctaBlock) {
      gsap.from(ctaBlock, {
        scale: 0.95,
        opacity: 0,
        duration: 1,
        ease: 'power4.out',
        scrollTrigger: {
          trigger: ctaBlock,
          start: 'top 82%',
          once: true,
        },
      })
    }

    // ── 9. Showcase card — parallax depth ─────────────────────────
    const showcaseCard = document.querySelector<HTMLElement>('.showcase-card')
    if (showcaseCard) {
      gsap.from(showcaseCard, {
        y: 60,
        opacity: 0,
        scale: 0.96,
        duration: 1.1,
        ease: 'expo.out',
        scrollTrigger: {
          trigger: showcaseCard,
          start: 'top 82%',
          once: true,
        },
      })
    }

    // ── 10. Eyebrow labels — slide right ─────────────────────────
    gsap.utils.toArray<HTMLElement>('.eyebrow').forEach(el => {
      gsap.from(el, {
        x: -20,
        opacity: 0,
        duration: 0.7,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: el,
          start: 'top 88%',
          once: true,
        },
      })
    })

    return () => {
      ScrollTrigger.getAll().forEach(t => t.kill())
    }
  }, [])

  return null
}
```

---

### 2. `app/globals.css` — remove `.reveal` CSS transitions

The CSS class-based fade is now replaced by GSAP.  
**Find and DELETE** this block (lines ~69–82 in globals.css):

```css
/* ---------- reveal-on-scroll ---------- */
.reveal{opacity:0;transform:translateY(28px);transition:opacity .8s cubic-bezier(.16,1,.3,1), transform .8s cubic-bezier(.16,1,.3,1);}
.reveal.visible{opacity:1;transform:translateY(0);}
.reveal-d1{transition-delay:.08s;}
.reveal-d2{transition-delay:.16s;}
.reveal-d3{transition-delay:.24s;}
.reveal-d4{transition-delay:.32s;}
.reveal-d5{transition-delay:.4s;}
```

**Replace with only the reduced-motion safety net:**

```css
/* ---------- reveal — GSAP sets initial opacity/transform via JS ---------- */
/* Fallback: if JS fails, elements should still be visible */
@media (prefers-reduced-motion: reduce) {
  .reveal { opacity: 1 !important; transform: none !important; }
}
```

---

### 3. `components/Hero.tsx` — upgrade mouse parallax with GSAP `quickTo`

The current hero uses `el.style.transform` directly in `mousemove`.  
**Replace** the second `useEffect` (the parallax one) with a GSAP `quickTo` version for buttery smooth tracking:

```tsx
useEffect(() => {
  if (typeof window === 'undefined') return
  const heroVisual = heroVisualRef.current
  const heroGlow   = heroGlowRef.current
  const breatheStage = breatheStageRef.current
  if (!heroVisual || !heroGlow || !breatheStage) return

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduceMotion) return

  // Lazy import to keep SSR safe
  import('gsap').then(({ default: gsap }) => {
    const cards = Array.from(heroVisual.querySelectorAll<HTMLElement>('.float-card'))

    // quickTo for 60fps lerp tracking
    const glowX = gsap.quickTo(heroGlow, 'left', { duration: 0.6, ease: 'power3.out' })
    const glowY = gsap.quickTo(heroGlow, 'top',  { duration: 0.6, ease: 'power3.out' })

    const stageX = gsap.quickTo(breatheStage, 'x', { duration: 0.8, ease: 'power2.out' })
    const stageY = gsap.quickTo(breatheStage, 'y', { duration: 0.8, ease: 'power2.out' })

    const cardTrackers = cards.map(card => {
      const depth = parseInt(card.dataset.depth || '30', 10)
      return {
        x: gsap.quickTo(card, 'x', { duration: 0.7 + depth * 0.005, ease: 'power2.out' }),
        y: gsap.quickTo(card, 'y', { duration: 0.7 + depth * 0.005, ease: 'power2.out' }),
        depth,
      }
    })

    const handleMouseMove = (e: MouseEvent) => {
      const rect = heroVisual.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      const cx = x - rect.width  / 2
      const cy = y - rect.height / 2

      glowX(x); glowY(y)
      gsap.to(heroGlow, { opacity: 1, duration: 0.3 })

      stageX(cx * 0.02); stageY(cy * 0.02)

      cardTrackers.forEach(({ x: cX, y: cY, depth }) => {
        cX((cx / rect.width)  * depth)
        cY((cy / rect.height) * depth)
      })
    }

    const handleMouseLeave = () => {
      gsap.to(heroGlow, { opacity: 0, duration: 0.4 })
      stageX(0); stageY(0)
      cardTrackers.forEach(({ x: cX, y: cY }) => { cX(0); cY(0) })
    }

    heroVisual.addEventListener('mousemove', handleMouseMove)
    heroVisual.addEventListener('mouseleave', handleMouseLeave)

    // Store cleanup on the element to retrieve in return
    ;(heroVisual as any).__gsapCleanup = () => {
      heroVisual.removeEventListener('mousemove', handleMouseMove)
      heroVisual.removeEventListener('mouseleave', handleMouseLeave)
    }
  })

  return () => {
    const cleanup = (heroVisualRef.current as any)?.__gsapCleanup
    if (cleanup) cleanup()
  }
}, [])
```

> Remove the old `const handleMouseMove` / `handleMouseLeave` implementation
> and the old `addEventListener` calls in the original second useEffect block.
> Keep the first `useEffect` (breathing label interval) unchanged.

---

### 4. `components/Journey.tsx` — remove IntersectionObserver, let GSAP handle it

The journey step `.on` class toggle and `journeyFill` width animation are now
controlled by GSAP in `ScrollReveal.tsx` (item #2 in the ScrollReveal code above).

**In `Journey.tsx`:**
- Remove the entire `useEffect` block and the `journeyFillRef` ref
- Remove `import { useEffect, useRef } from 'react'` — no longer needed; convert to server component
- Remove `ref={journeyFillRef}` from the `journey-line-fill` div
- Keep the `id="journeyFill"` and `id="journeyPath"` attributes — GSAP targets them by id

The component signature becomes:
```tsx
// Remove 'use client' directive
export default function Journey() { ... }
```

---

## Constraints

1. Do **not** remove `framer-motion` from `package.json`.
2. Do **not** touch any CSS other than removing the `.reveal` block described above.
3. Do **not** modify any dashboard pages, login pages, or anything outside `components/` and `app/globals.css`.
4. Always guard GSAP code with `typeof window === 'undefined'` checks or put inside `useEffect`.
5. Every `ScrollTrigger.create` / `gsap.from` that runs once must use `once: true` or `onEnter` + unregister.
6. Clean up all ScrollTrigger instances in the `useEffect` return: `ScrollTrigger.getAll().forEach(t => t.kill())`.
7. Add `@media (prefers-reduced-motion: reduce)` guard at the top of every `useEffect` that runs GSAP.

---

## Expected result after implementation

| Section | Animation |
|---|---|
| All `.reveal` elements | Rise 36px → 0, fade in, stagger 90ms between siblings |
| Section `<h2>` headings | Rise 32px → 0, expo.out |
| `.eyebrow` labels | Slide right 20px → 0 |
| `.barrier-card` ×3 | Fan in from left, slight rotateY, stagger 130ms |
| `.feature-card` ×6 | Scale 0.94 + rise, stagger across full grid 500ms total |
| `.risk-card` ×3 | Rise 60px, stagger 120ms |
| `.showcase-card` | Scale 0.96 + rise 60px, expo.out |
| `.hotline` banner | Rise 48px + scale 0.97, expo.out |
| `.cta` block | Scale 0.95 + fade, power4.out |
| Journey progress line | Scrubbed with scroll, start 75% – end 40% |
| Hero float cards | GSAP quickTo parallax (depth-based lag), 60fps |
| Hero glow | GSAP quickTo opacity + position tracking |
