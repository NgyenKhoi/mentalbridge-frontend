'use client'

import { useEffect, useRef } from 'react'

type Props = Readonly<{ active: boolean }>

export function MindfulnessScene({ active }: Props) {
  const mountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    let disposed = false
    let frame = 0
    let cleanupScene = () => {}

    void import('three').then((THREE) => {
      if (disposed) return

      let renderer: InstanceType<typeof THREE.WebGLRenderer>
      try {
        renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
      } catch {
        return
      }

      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
      const scene = new THREE.Scene()
      const camera = new THREE.OrthographicCamera(-2.7, 2.7, 2.7, -2.7, 0.1, 20)
      camera.position.z = 8
      const group = new THREE.Group()
      scene.add(group)

      const rings = [
        { radius: 1.76, color: 0x3d7a6e, opacity: 0.24, tilt: 0.15 },
        { radius: 2.13, color: 0x9acbb2, opacity: 0.19, tilt: -0.25 },
        { radius: 2.46, color: 0xc4dfd0, opacity: 0.17, tilt: 0.32 },
      ].map(({ radius, color, opacity, tilt }) => {
        const geometry = new THREE.TorusGeometry(radius, 0.013, 6, 120)
        const material = new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity,
          depthWrite: false,
        })
        const ring = new THREE.Mesh(geometry, material)
        ring.rotation.x = tilt
        group.add(ring)
        return { geometry, material }
      })

      const positions = new Float32Array(72 * 3)
      for (let index = 0; index < 72; index += 1) {
        const angle = index * 2.39996
        const radius = 1.82 + (index % 7) * 0.11
        positions[index * 3] = Math.cos(angle) * radius
        positions[index * 3 + 1] = Math.sin(angle) * radius
        positions[index * 3 + 2] = (index % 5) * 0.01
      }
      const particleGeometry = new THREE.BufferGeometry()
      particleGeometry.setAttribute(
        'position',
        new THREE.BufferAttribute(positions, 3),
      )
      const particleMaterial = new THREE.PointsMaterial({
        color: 0x5ba88b,
        size: 0.035,
        transparent: true,
        opacity: 0.48,
        depthWrite: false,
      })
      group.add(new THREE.Points(particleGeometry, particleMaterial))

      const resize = () => {
        const width = mount.clientWidth
        const height = mount.clientHeight
        if (!width || !height) return
        renderer.setSize(width, height)
        const aspect = width / height
        camera.left = aspect >= 1 ? -2.7 * aspect : -2.7
        camera.right = aspect >= 1 ? 2.7 * aspect : 2.7
        camera.top = aspect >= 1 ? 2.7 : 2.7 / aspect
        camera.bottom = aspect >= 1 ? -2.7 : -2.7 / aspect
        camera.updateProjectionMatrix()
        renderer.render(scene, camera)
      }

      const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
      const animate = () => {
        group.rotation.z += 0.0006
        renderer.render(scene, camera)
        frame = window.requestAnimationFrame(animate)
      }

      mount.appendChild(renderer.domElement)
      const observer = new ResizeObserver(resize)
      observer.observe(mount)
      resize()
      if (active && !motion.matches) frame = window.requestAnimationFrame(animate)

      cleanupScene = () => {
        window.cancelAnimationFrame(frame)
        observer.disconnect()
        particleGeometry.dispose()
        particleMaterial.dispose()
        rings.forEach(({ geometry, material }) => {
          geometry.dispose()
          material.dispose()
        })
        renderer.dispose()
        renderer.domElement.remove()
      }
    })

    return () => {
      disposed = true
      cleanupScene()
    }
  }, [active])

  return <div ref={mountRef} aria-hidden="true" />
}
