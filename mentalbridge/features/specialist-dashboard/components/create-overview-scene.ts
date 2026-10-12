import {
  ACESFilmicToneMapping,
  AmbientLight,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  ExtrudeGeometry,
  Group,
  LatheGeometry,
  Material,
  Mesh,
  MeshPhongMaterial,
  MeshStandardMaterial,
  OrthographicCamera,
  Scene,
  Shape,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  WebGLRenderer,
} from 'three'

type Palette = {
  cream: string
  green: string
  pale: string
  amber: string
  ink: string
}
export type OverviewScene = {
  point: (x: number, y: number) => void
  reset: () => void
  play: () => void
  dispose: () => void
}

/** Original procedural clay model: no downloaded models, textures or remote calls. */
export function createOverviewScene(
  canvas: HTMLCanvasElement,
  palette: Palette,
  onFailure: () => void,
): OverviewScene {
  const renderer = new WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: 'low-power',
  })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.1
  const scene = new Scene()
  const camera = new OrthographicCamera(-2.25, 2.25, 2.25, -2.25, 0.1, 30)
  camera.position.set(2.5, 1.8, 7)
  camera.lookAt(0, 0, 0)
  scene.add(new AmbientLight(0xffffff, 1.8))
  const key = new DirectionalLight(0xfff3df, 3)
  key.position.set(-3, 5, 5)
  scene.add(key)
  const fill = new DirectionalLight(0xffffff, 1.3)
  fill.position.set(4, 0, 3)
  scene.add(fill)

  const materials = new Set<Material>()
  const geometries = new Set<BufferGeometry>()
  const clay = (color: string) => {
    const material = new MeshStandardMaterial({
      color: new Color(color),
      roughness: 0.72,
      metalness: 0,
    })
    materials.add(material)
    return material
  }
  const cream = clay(palette.cream),
    green = clay(palette.green),
    pale = clay(palette.pale),
    amber = clay(palette.amber),
    ink = clay(palette.ink)
  const add = (
    parent: Group,
    geometry: BufferGeometry,
    material: Material,
    x = 0,
    y = 0,
    z = 0,
  ) => {
    geometries.add(geometry)
    const mesh = new Mesh(geometry, material)
    mesh.position.set(x, y, z)
    parent.add(mesh)
    return mesh
  }
  const slab = (
    width: number,
    height: number,
    depth: number,
    radius = 0.12,
  ) => {
    const x = -width / 2,
      y = -height / 2
    const outline = new Shape()
    outline.moveTo(x + radius, y)
    outline.lineTo(x + width - radius, y)
    outline.quadraticCurveTo(x + width, y, x + width, y + radius)
    outline.lineTo(x + width, y + height - radius)
    outline.quadraticCurveTo(
      x + width,
      y + height,
      x + width - radius,
      y + height,
    )
    outline.lineTo(x + radius, y + height)
    outline.quadraticCurveTo(x, y + height, x, y + height - radius)
    outline.lineTo(x, y + radius)
    outline.quadraticCurveTo(x, y, x + radius, y)
    const geometry = new ExtrudeGeometry(outline, {
      depth,
      bevelEnabled: true,
      bevelSize: 0.025,
      bevelThickness: 0.025,
      bevelSegments: 3,
      curveSegments: 8,
      steps: 1,
    })
    geometry.translate(0, 0, -depth / 2)
    return geometry
  }
  const model = new Group()
  scene.add(model)
  const hourglass = new Group()
  hourglass.position.set(0.15, 0.05, 0.25)
  hourglass.rotation.z = -0.08
  model.add(hourglass)
  for (const y of [-1, 1]) {
    add(hourglass, new CylinderGeometry(0.69, 0.69, 0.13, 32), cream, 0, y)
    const rim = add(
      hourglass,
      new TorusGeometry(0.63, 0.065, 10, 32),
      cream,
      0,
      y,
    )
    rim.rotation.x = Math.PI / 2
  }
  const glass = new MeshPhongMaterial({
    color: palette.cream,
    transparent: true,
    opacity: 0.25,
    shininess: 90,
    side: DoubleSide,
    depthWrite: false,
  })
  materials.add(glass)
  const contour = [
    [0.56, -0.92],
    [0.59, -0.8],
    [0.49, -0.6],
    [0.3, -0.35],
    [0.1, -0.1],
    [0.09, 0],
    [0.1, 0.1],
    [0.3, 0.35],
    [0.49, 0.6],
    [0.59, 0.8],
    [0.56, 0.92],
  ]
  add(
    hourglass,
    new LatheGeometry(
      contour.map(([radius, y]) => new Vector2(radius, y)),
      32,
    ),
    glass,
  )
  const topSand = [
    [0.03, 0.05],
    [0.13, 0.2],
    [0.32, 0.45],
    [0.51, 0.7],
    [0.51, 0.76],
    [0, 0.76],
  ]
  add(
    hourglass,
    new LatheGeometry(
      topSand.map(([radius, y]) => new Vector2(radius, y)),
      24,
    ),
    amber,
  )
  const dune = [
    [0, -0.85],
    [0.52, -0.85],
    [0.46, -0.72],
    [0.32, -0.56],
    [0.14, -0.44],
    [0, -0.4],
  ]
  add(
    hourglass,
    new LatheGeometry(
      dune.map(([radius, y]) => new Vector2(radius, y)),
      24,
    ),
    amber,
  )
  add(hourglass, new CylinderGeometry(0.012, 0.018, 0.45, 8), amber, 0, -0.18)

  const calendar = new Group()
  calendar.position.set(-1.03, -0.1, -0.22)
  calendar.rotation.set(0, -0.12, 0.14)
  model.add(calendar)
  add(calendar, slab(1.04, 1.14, 0.16), green)
  add(calendar, slab(0.88, 0.13, 0.06, 0.04), pale, 0, 0.3, 0.11)
  for (const x of [-0.3, 0.3]) {
    add(calendar, new TorusGeometry(0.105, 0.033, 8, 20), cream, x, 0.58, 0.08)
  }
  for (const y of [0.05, -0.15])
    for (const x of [-0.27, 0, 0.27])
      add(calendar, slab(0.12, 0.12, 0.045, 0.025), pale, x, y, 0.13)
  for (const x of [-0.13, 0.13])
    add(calendar, new SphereGeometry(0.033, 12, 8), ink, x, -0.31, 0.14)
  const smile = add(
    calendar,
    new TorusGeometry(0.11, 0.015, 8, 16, Math.PI),
    cream,
    0,
    -0.31,
    0.15,
  )
  smile.rotation.z = Math.PI

  const leaf = new Group()
  leaf.position.set(1.1, -0.4, 0)
  leaf.rotation.z = -0.45
  model.add(leaf)
  const blade = add(leaf, new SphereGeometry(1, 24, 16), pale)
  blade.scale.set(0.38, 0.74, 0.12)
  add(leaf, new CylinderGeometry(0.018, 0.025, 1.38, 8), cream, 0, -0.06, 0.12)
  for (const [x, y, z, radius, material] of [
    [-1.47, 0.93, -0.5, 0.22, pale],
    [1.04, 0.92, -0.25, 0.14, cream],
    [1.43, -0.88, 0.35, 0.17, amber],
    [-0.93, -1.05, 0.45, 0.23, green],
  ] as const)
    add(model, new SphereGeometry(radius, 20, 12), material, x, y, z)

  let frameId = 0,
    disposed = false,
    visible = true,
    targetX = 0,
    targetY = 0
  let playStarted: number | null = null
  canvas.dataset.scenePhase = 'idle'
  function render(now: number) {
    frameId = 0
    if (disposed || !visible || document.hidden) return
    model.rotation.x += (targetX - model.rotation.x) * 0.16
    model.rotation.y += (targetY - model.rotation.y) * 0.16
    const t = playStarted === null ? 0 : Math.min((now - playStarted) / 1400, 1)
    const ease = t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2
    hourglass.rotation.z =
      -0.08 + (playStarted === null ? 0 : ease * Math.PI * 2)
    hourglass.position.y = 0.05 + Math.sin(t * Math.PI) * 0.2
    calendar.rotation.z = 0.14 + Math.sin(t * Math.PI * 4) * (1 - t) * 0.12
    leaf.rotation.z = -0.45 + Math.sin(t * Math.PI) * 0.2
    if (t === 1) {
      playStarted = null
      hourglass.rotation.z = -0.08
      canvas.dataset.scenePhase = 'idle'
    }
    canvas.dataset.sceneYaw = model.rotation.y.toFixed(4)
    try {
      renderer.render(scene, camera)
    } catch {
      dispose()
      onFailure()
      return
    }
    if (
      playStarted !== null ||
      Math.abs(targetX - model.rotation.x) +
        Math.abs(targetY - model.rotation.y) >
        0.0005
    )
      requestRender()
  }
  function requestRender() {
    if (!frameId && !disposed && visible && !document.hidden)
      frameId = requestAnimationFrame(render)
  }
  function resize() {
    if (disposed) return
    const width = Math.max(canvas.clientWidth, 1),
      height = Math.max(canvas.clientHeight, 1)
    renderer.setSize(width, height, false)
    camera.left = (-2.05 * width) / height
    camera.right = (2.05 * width) / height
    camera.top = 2.05
    camera.bottom = -2.05
    camera.updateProjectionMatrix()
    requestRender()
  }
  const resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(canvas)
  const intersection = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting
    if (visible) requestRender()
    else pause()
  })
  intersection.observe(canvas)
  function pause() {
    cancelAnimationFrame(frameId)
    frameId = 0
    playStarted = null
    canvas.dataset.scenePhase = 'idle'
  }
  function visibility() {
    if (document.hidden) pause()
    else requestRender()
  }
  function contextLost(event: Event) {
    event.preventDefault()
    dispose()
    onFailure()
  }
  document.addEventListener('visibilitychange', visibility)
  canvas.addEventListener('webglcontextlost', contextLost)
  function dispose() {
    if (disposed) return
    disposed = true
    pause()
    resizeObserver.disconnect()
    intersection.disconnect()
    document.removeEventListener('visibilitychange', visibility)
    canvas.removeEventListener('webglcontextlost', contextLost)
    geometries.forEach((geometry) => geometry.dispose())
    materials.forEach((material) => material.dispose())
    renderer.dispose()
    renderer.forceContextLoss()
  }
  resize()
  return {
    point: (x, y) => {
      targetY = Math.max(-1, Math.min(x, 1)) * 0.18
      targetX = Math.max(-1, Math.min(y, 1)) * 0.12
      requestRender()
    },
    reset: () => {
      targetX = 0
      targetY = 0
      requestRender()
    },
    play: () => {
      if (playStarted !== null || disposed || !visible || document.hidden)
        return
      playStarted = performance.now()
      canvas.dataset.scenePhase = 'playing'
      requestRender()
    },
    dispose,
  }
}
