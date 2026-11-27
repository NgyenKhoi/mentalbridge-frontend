'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'

export default function ClinicalHeroOrbit() {
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host || host.clientWidth === 0) return

    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: 'low-power',
      })
    } catch {
      return
    }

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 20)
    camera.position.z = 5

    const orbit = new THREE.Group()
    const outerGeometry = new THREE.TorusGeometry(1.18, 0.012, 8, 120)
    const innerGeometry = new THREE.TorusGeometry(0.79, 0.01, 8, 100)
    const pointGeometry = new THREE.SphereGeometry(0.06, 12, 12)
    const outerMaterial = new THREE.MeshBasicMaterial({
      color: 0x27694d,
      transparent: true,
      opacity: 0.42,
    })
    const innerMaterial = new THREE.MeshBasicMaterial({
      color: 0x27694d,
      transparent: true,
      opacity: 0.24,
    })
    const pointMaterial = new THREE.MeshBasicMaterial({
      color: 0x27694d,
      transparent: true,
      opacity: 0.35,
    })
    const outer = new THREE.Mesh(outerGeometry, outerMaterial)
    const inner = new THREE.Mesh(innerGeometry, innerMaterial)
    const point = new THREE.Mesh(pointGeometry, pointMaterial)
    outer.rotation.x = 0.48
    inner.rotation.y = 0.62
    point.position.set(1.1, 0.37, 0)
    orbit.add(outer, inner, point)
    scene.add(orbit)

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
    host.appendChild(renderer.domElement)

    const resize = () => {
      const width = host.clientWidth
      const height = host.clientHeight
      if (!width || !height) return
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height)
      renderer.render(scene, camera)
    }
    const observer = new ResizeObserver(resize)
    observer.observe(host)
    resize()

    const reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches
    let frame = 0
    if (!reducedMotion) {
      const animate = () => {
        frame = window.requestAnimationFrame(animate)
        if (document.hidden) return
        orbit.rotation.y += 0.002
        orbit.rotation.z += 0.0008
        renderer.render(scene, camera)
      }
      animate()
    }

    return () => {
      window.cancelAnimationFrame(frame)
      observer.disconnect()
      outerGeometry.dispose()
      innerGeometry.dispose()
      pointGeometry.dispose()
      outerMaterial.dispose()
      innerMaterial.dispose()
      pointMaterial.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [])

  return (
    <div className="clinical-hero-orbit" ref={hostRef} aria-hidden="true" />
  )
}
