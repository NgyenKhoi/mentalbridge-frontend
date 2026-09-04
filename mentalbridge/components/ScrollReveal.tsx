'use client'

import { useEffect } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { GSAP_DURATION, GSAP_EASE, GSAP_STAGGER } from '@/lib/animations/config'

export default function ScrollReveal() {
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger)
    const media = gsap.matchMedia()

    media.add('(prefers-reduced-motion: no-preference)', () => {
      let journeySteps: HTMLElement[] = []
      const context = gsap.context(() => {
        const consumed = new Set<Element>()

        gsap.utils.toArray<HTMLElement>('.section-head').forEach((header) => {
          consumed.add(header)
          const children = Array.from(header.children)
          children.forEach((child) => consumed.add(child))
          gsap.from(children, {
            y: 34,
            opacity: 0,
            duration: GSAP_DURATION.reveal,
            stagger: GSAP_STAGGER.relaxed,
            ease: GSAP_EASE.enter,
            clearProps: 'transform,opacity',
            scrollTrigger: { trigger: header, start: 'top 84%', once: true },
          })
        })

        const revealGroup = (
          selector: string,
          trigger: string,
          from: gsap.TweenVars,
          stagger = 0.1,
        ) => {
          const items = gsap.utils.toArray<HTMLElement>(selector)
          items.forEach((item) => consumed.add(item))
          if (!items.length) return
          gsap.from(items, {
            ...from,
            duration: GSAP_DURATION.reveal,
            stagger,
            ease: GSAP_EASE.enter,
            clearProps: 'transform,opacity',
            scrollTrigger: { trigger, start: 'top 82%', once: true },
          })
        }

        revealGroup('.value-item', '.value-row', { y: 32, opacity: 0 }, 0.09)
        revealGroup(
          '[data-group="barrier"]',
          '.barrier-grid',
          { x: -48, y: 24, opacity: 0, scale: 0.94, rotationY: 6 },
          0.1,
        )
        revealGroup(
          '.journey-step',
          '.journey-path',
          { y: 42, opacity: 0, scale: 0.96 },
          0.09,
        )
        // The tools enter as a soft, staggered stack instead of appearing all at once.
        revealGroup(
          '.service-row',
          '.services-list',
          { x: -30, y: 12, opacity: 0 },
          0.08,
        )
        revealGroup(
          '[data-group="risk"]',
          '.risk-grid',
          { y: 54, opacity: 0 },
          0.09,
        )
        revealGroup(
          '.footer-top > *',
          '.footer-top',
          { y: 30, opacity: 0 },
          0.075,
        )

        const journeyFill = document.getElementById('journeyFill')
        const journeyTraveler = document.getElementById('journeyTraveler')
        const journeyPath = document.getElementById('journeyPath')
        const journeyLine = journeyFill?.parentElement
        if (journeyFill && journeyTraveler && journeyPath && journeyLine) {
          journeySteps = gsap.utils.toArray<HTMLElement>('.journey-step')
          gsap.set(journeyFill, { transformOrigin: 'left center' })

          const journeyTimeline = gsap.timeline({
            scrollTrigger: {
              trigger: journeyPath,
              start: 'top 76%',
              end: 'bottom 42%',
              scrub: 1,
              invalidateOnRefresh: true,
              onUpdate: (self) => {
                journeySteps.forEach((step, index) => {
                  const threshold =
                    journeySteps.length > 1
                      ? index / (journeySteps.length - 1)
                      : 0
                  step.classList.toggle('on', self.progress + 0.02 >= threshold)
                })
              },
            },
          })
          journeyTimeline
            .fromTo(journeyFill, { scaleX: 0 }, { scaleX: 1, ease: 'none' }, 0)
            .fromTo(
              journeyTraveler,
              { x: 0, scale: 0.72, opacity: 0.55 },
              {
                x: () => journeyLine.clientWidth,
                scale: 1,
                opacity: 1,
                ease: 'none',
              },
              0,
            )
        }

        const showcase = document.querySelector<HTMLElement>('.showcase-card')
        if (showcase) {
          consumed.add(showcase)
          gsap.fromTo(
            showcase,
            {
              y: 68,
              scale: 0.93,
              opacity: 0.35,
            },
            {
              y: 0,
              scale: 1,
              opacity: 1,
              ease: 'none',
              scrollTrigger: {
                trigger: showcase,
                start: 'top 96%',
                end: 'top 46%',
                scrub: 1,
              },
            },
          )

          const phone = showcase.querySelector<HTMLElement>('.phone')
          if (phone) {
            gsap.fromTo(
              phone,
              { y: 42 },
              {
                y: -18,
                ease: 'none',
                scrollTrigger: {
                  trigger: showcase,
                  start: 'top bottom',
                  end: 'bottom top',
                  scrub: 1.2,
                },
              },
            )
          }
        }

        const servicePreview =
          document.querySelector<HTMLElement>('.service-preview')
        if (servicePreview) {
          consumed.add(servicePreview)
          gsap.fromTo(
            servicePreview,
            {
              y: 34,
              scale: 0.985,
              opacity: 0,
            },
            {
              y: 0,
              scale: 1,
              opacity: 1,
              duration: GSAP_DURATION.reveal,
              ease: GSAP_EASE.enter,
              clearProps: 'transform,opacity',
              scrollTrigger: {
                trigger: '.services-stage',
                start: 'top 84%',
                once: true,
              },
            },
          )
        }

        const cta = document.querySelector<HTMLElement>('.cta')
        if (cta) {
          consumed.add(cta)
          const children = Array.from(
            cta.querySelectorAll<HTMLElement>('h2,p,a'),
          )
          children.forEach((child) => consumed.add(child))
          gsap.from(children, {
            y: 32,
            opacity: 0,
            scale: 0.97,
            duration: GSAP_DURATION.slow,
            stagger: GSAP_STAGGER.relaxed,
            ease: 'back.out(1.2)',
            clearProps: 'transform,opacity',
            scrollTrigger: { trigger: cta, start: 'top 80%', once: true },
          })
        }

        const remaining = gsap.utils
          .toArray<HTMLElement>('.reveal')
          .filter((element) => !consumed.has(element))

        ScrollTrigger.batch(remaining, {
          start: 'top 88%',
          once: true,
          onEnter: (batch) => {
            gsap.fromTo(
              batch,
              {
                y: 30,
                opacity: 0,
              },
              {
                y: 0,
                opacity: 1,
                duration: GSAP_DURATION.reveal,
                stagger: GSAP_STAGGER.default,
                ease: GSAP_EASE.enter,
                clearProps: 'transform,opacity',
              },
            )
          },
        })

        ScrollTrigger.refresh()
      }, document.body)

      return () => {
        context.revert()
        journeySteps.forEach((step) => step.classList.remove('on'))
      }
    })

    return () => media.revert()
  }, [])

  return null
}
