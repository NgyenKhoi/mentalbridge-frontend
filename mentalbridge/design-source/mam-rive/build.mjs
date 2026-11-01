// Mầm v0.3 Rive rig: art from the "Mầm — Character Sheet v0.3" canvas
// (mam_v03_rive_layers.svg), motion from its Motion spec board.
// Control contract (view model, enum IDs, state graph) is unchanged from the
// mam-companion v0.2 rig so a consumer can swap the .riv without code changes.
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const directory = dirname(fileURLToPath(import.meta.url))

// Art is authored in the canvas SVG space (character centre x=120, feet y=244)
// and mapped onto a 512×512 artboard: X = 256 + (x-120)·S, Y = 256 + (y-101)·S.
const S = 1.5
const ORIGIN = [120, 101]
const toArtboard = ([x, y]) => [256 + (x - ORIGIN[0]) * S, 256 + (y - ORIGIN[1]) * S]
const DEG = Math.PI / 180

const C = {
  ink: '#2F5A53', shell: '#5E877F', line: '#3E6B64', cream: '#F5EEDC', belly: '#B8C99D',
  cheek: '#E8B7A3', leaf: '#9CBF7E', vein: '#5E8A5B', amber: '#E0A448', amberLine: '#B07A26',
  glow: '#F2C46D', mouth: '#9E4F45', tongue: '#E8907C', white: '#FFFFFF',
  orbDim: '#D3C7A8', orbDimLine: '#A99D80', tear: '#A9D0D4', tearLine: '#6D9FA5',
}

// ---------- art tree (canvas coordinates) ----------
// node(key, pivot, children, base): pivot is absolute in canvas space; base holds
// rest values (rot in degrees, opacity, scale). Shapes use absolute canvas coords,
// or coords local to `at` (optionally mirrored) for parts drawn around a pivot.
const node = (key, pivot, children, base = {}) => ({ kind: 'node', key, pivot, children, base })
const ell = (name, cx, cy, rx, ry, paint) => ({ kind: 'ellipse', name, c: [cx, cy], rx, ry, paint })
const pth = (name, d, paint, opts = {}) => ({ kind: 'path', name, d, paint, ...opts })
const rect = (name, x, y, w, h, deg, fill) => ({ kind: 'path', name, d: `M${x} ${y} L${x + w} ${y} L${x + w} ${y + h} L${x} ${y + h} Z`, paint: { fill }, spin: [x + w / 2, y + h / 2, deg] })
const fill = (f, op) => ({ fill: f, op })
const stroke = (s, w, op) => ({ stroke: s, w, op })
const star = (name, x, y, r, f, op) => pth(name, `M${x} ${y - r} Q${x} ${y} ${x + r} ${y} Q${x} ${y} ${x} ${y + r} Q${x} ${y} ${x - r} ${y} Q${x} ${y} ${x} ${y - r} Z`, fill(f, op))

const LEAF = 'M0 0 C-8 -16 -34 -22 -48 -10 C-36 4 -14 8 0 0 Z'
const VEIN = 'M-5 -2 Q-22 -8 -40 -9'
const ORB = 'M0 -18 C7 -8 12 -1 12 5 C12 12 6.5 16 0 16 C-6.5 16 -12 12 -12 5 C-12 -1 -7 -8 0 -18 Z'
const leaf = (key, mirror) => node(key, [120, 26], [
  pth('leaf', LEAF, { fill: C.leaf, stroke: C.line, w: 2.5 }, { at: [120, 26], mirror }),
  pth('vein', VEIN, stroke(C.vein, 2), { at: [120, 26], mirror }),
])

// Eye variants: every variant is drawn in place; only the active one is opaque.
const pupil = (dx, cx, cy, rx, ry, lx, ly, lr, extra) => [
  ell('pupil', cx + dx, cy, rx, ry, fill(C.ink)),
  ell('catchlight', lx + dx, ly, lr, lr, fill(C.white, 0.9)),
  ...(extra ? [ell('catchlight_small', extra[0] + dx, extra[1], extra[2], extra[2], fill(C.white, 0.7))] : []),
]
const eyeVariants = {
  open: (dx) => pupil(dx, 97, 128, 7, 9, 99.4, 124.8, 2.6),
  wide: (dx) => pupil(dx, 97, 128, 8, 10.5, 99.8, 124.2, 3.2, [94.4, 132, 1.3]),
  focus: (dx) => pupil(dx, 97, 128, 6.5, 8.5, 99.2, 125, 2.3),
  lookup: (dx) => pupil(dx, 100, 125, 7, 9, 102.4, 121.8, 2.6),
  soft: (dx) => pupil(dx, 97, 129, 7, 8.5, 99.2, 131.5, 2),
  sad: (dx) => pupil(dx, 97, 128, 7, 9, 99.4, 129.5, 2.2),
}
const eye = (side, dx, cx) => node(`eye${side}`, [cx, 128], [
  // Gaze moves only the pupils (attention layer keys gaze.x); the smile arc stays put.
  node(`gaze${side}`, [cx, 128], Object.entries(eyeVariants).map(([name, draw]) =>
    node(`eye${side}_${name}`, [cx, 128], draw(dx), { op: name === 'open' ? 1 : 0 }))),
  node(`eye${side}_happy`, [cx, 128], [pth('smile_eye', `M${89 + dx} 131 Q${97 + dx} 119 ${105 + dx} 131`, stroke(C.ink, 4))], { op: 0 }),
])

const browPaths = {
  neutral: ['M104 110 Q97 107 90 110', 'M136 110 Q143 107 150 110'],
  raised: ['M104 105 Q97 101 90 105', 'M136 105 Q143 101 150 105'],
  high: ['M104 102 Q97 97 90 102', 'M136 102 Q143 97 150 102'],
  soft: ['M104 109 Q97 108 90 111', 'M136 109 Q143 108 150 111'],
  sad: ['M104 106 Q97 108 90 113', 'M136 106 Q143 108 150 113'],
  low: ['M104 113 Q97 110 90 109', 'M136 113 Q143 110 150 109'],
}
const brows = ['L', 'R'].map((side, i) => node(`brow${side}`, [i ? 143 : 97, 108],
  Object.entries(browPaths).map(([name, d]) => node(`brow${side}_${name}`, [i ? 143 : 97, 108], [pth('brow', d[i], stroke(C.ink, 3.6))], { op: name === 'neutral' ? 1 : 0 }))))

const mouthShapes = {
  smile: [pth('line', 'M111 147 Q120 155 129 147', stroke(C.ink, 3.4))],
  gentle: [pth('line', 'M113 148 Q120 153.5 127 148', stroke(C.ink, 3.4))],
  rest: [pth('line', 'M114.5 150 Q120 152 125.5 150', stroke(C.ink, 3.4))],
  side: [pth('line', 'M114 151.5 Q121 151.5 127 147', stroke(C.ink, 3.4))],
  frown: [pth('line', 'M112 153 Q120 146 128 153', stroke(C.ink, 3.4))],
  o: [ell('o', 120, 150, 4.6, 5.2, { fill: C.mouth, stroke: C.ink, w: 2.2 })],
  talk: [pth('mouth', 'M111 146 Q120 147.5 129 146 Q127.5 158 120 158 Q112.5 158 111 146 Z', { fill: C.mouth, stroke: C.ink, w: 2.2 }), ell('tongue', 121, 154.3, 4.4, 2.4, fill(C.tongue))],
  open: [pth('mouth', 'M108 145 Q120 147.5 132 145 Q130 160 120 160 Q110 160 108 145 Z', { fill: C.mouth, stroke: C.ink, w: 2.2 }), ell('tongue', 120, 155.6, 6, 3, fill(C.tongue))],
  big: [pth('mouth', 'M104 143 Q120 146.5 136 143 Q134 166 120 166 Q106 166 104 143 Z', { fill: C.mouth, stroke: C.ink, w: 2.2 }), ell('tongue', 120, 160, 8.5, 4.2, fill(C.tongue))],
}
const mouth = node('mouth', [120, 150], Object.entries(mouthShapes).map(([name, shapes]) => node(`mouth_${name}`, [120, 150], shapes, { op: name === 'smile' ? 1 : 0 })))

const lid = (key, left, right, lineL, lineR) => node(key, [120, 124], [
  pth('lid_left', left, fill(C.cream)), pth('lid_line_left', lineL, stroke(C.ink, 2.6)),
  pth('lid_right', right, fill(C.cream)), pth('lid_line_right', lineR, stroke(C.ink, 2.6)),
], { op: 0 })

const arm = (key, x, deg) => node(key, [x, 186], [ell('arm', x, 204, 9.5, 20, { fill: C.shell, stroke: C.line, w: 3 })], { rot: deg })

const head = node('head', [120, 192], [
  node('sprout', [120, 46], [
    node('glow', [120, 0], [ell('glow_outer', 120, 0, 34, 34, fill(C.glow, 0.5)), ell('glow_inner', 120, 0, 21.1, 21.1, fill(C.glow, 0.8))], { op: 0.44, s: 20 / 34 }),
    node('thinkRings', [120, 0], [
      ell('ring_inner', 120, 0, 24, 24, { stroke: C.amberLine, w: 2, op: 0.6, dash: [3, 5] }),
      ell('ring_outer', 120, 0, 34, 34, { stroke: C.amberLine, w: 2, op: 0.32, dash: [3, 6] }),
    ], { op: 0 }),
    pth('stem', 'M120 46 C121.5 36 118.5 26 120 14', stroke(C.line, 6)),
    leaf('leafL', false), leaf('leafR', true),
    node('orb', [120, 0], [
      pth('drop', ORB, { fill: C.amber, stroke: C.amberLine, w: 2 }, { at: [120, 0] }),
      node('orbDim', [120, 0], [pth('drop_dim', ORB, { fill: C.orbDim, stroke: C.orbDimLine, w: 2 }, { at: [120, 0] })], { op: 0 }),
      ell('highlight', 116, 5, 3, 4.5, fill(C.white, 0.65)),
    ]),
  ]),
  pth('head_shell', 'M120 34 C160 38 206 76 206 122 C206 166 170 192 120 192 C70 192 34 166 34 122 C34 76 80 38 120 34 Z', { fill: C.shell, stroke: C.line, w: 3 }),
  ell('face_base', 120, 132, 64, 48, fill(C.cream)),
  node('cheeks', [120, 147], [ell('cheek_left', 80, 147, 10, 6, fill(C.cheek)), ell('cheek_right', 160, 147, 10, 6, fill(C.cheek))], { op: 0.75 }),
  eye('L', 0, 97), eye('R', 46, 143),
  lid('lidSoft', 'M87 117 L107 117 L107 128 Q97 131 87 128 Z', 'M133 117 L153 117 L153 128 Q143 131 133 128 Z', 'M88.5 128.5 Q97 131 105.5 128.5', 'M134.5 128.5 Q143 131 151.5 128.5'),
  lid('lidSad', 'M107 116 L87 116 L87 127 L107 122 Z', 'M133 116 L153 116 L153 127 L133 122 Z', 'M105.5 122.6 L88.5 126.4', 'M134.5 122.6 L151.5 126.4'),
  ...brows,
  mouth,
  node('tear', [151, 146], [pth('drop', 'M151 139 C153 143 155 146 155 148 C155 151 153 152.5 151 152.5 C149 152.5 147 151 147 148 C147 146 149 143 151 139 Z', { fill: C.tear, stroke: C.tearLine, w: 1.5 })], { op: 0 }),
])

const fx = [
  node('fxCurious', [206, 70], [star('spark', 206, 70, 8, C.amber)], { op: 0 }),
  node('fxListen', [24, 132], [
    node('wave1', [26, 132], [pth('wave', 'M30 116 Q22 132 30 148', stroke(C.amberLine, 3, 0.85))], { op: 0 }),
    node('wave2', [12, 132], [pth('wave', 'M18 106 Q5 132 18 158', stroke(C.amberLine, 3, 0.45))], { op: 0 }),
  ]),
  node('fxThink', [205, 40], [
    node('dot1', [192, 54], [ell('dot', 192, 54, 3.5, 3.5, fill(C.line, 0.5))], { op: 0 }),
    node('dot2', [204, 40], [ell('dot', 204, 40, 4.5, 4.5, fill(C.line, 0.6))], { op: 0 }),
    node('dot3', [218, 24], [ell('dot', 218, 24, 6, 6, fill(C.line, 0.7))], { op: 0 }),
  ]),
  node('fxExplain', [218, 171], [
    pth('tick_top', 'M214 158 L222 150', stroke(C.amberLine, 3)),
    pth('tick_mid', 'M218 171 L229 171', stroke(C.amberLine, 3)),
    pth('tick_low', 'M214 184 L222 191', stroke(C.amberLine, 3)),
  ], { op: 0 }),
  node('fxHappy', [120, 70], [star('spark_right', 208, 64, 9, C.amber), star('spark_left', 34, 80, 6, C.amber, 0.8)], { op: 0 }),
  node('fxSparkle', [120, 95], [
    star('spark_tr', 212, 58, 10, C.amber), star('spark_tl', 28, 68, 7, C.amber),
    star('spark_r', 226, 128, 6, C.glow), star('spark_l', 14, 140, 6, C.glow),
  ], { op: 0 }),
  node('fxRing', [120, 118], [ell('ring', 120, 118, 126, 126, { stroke: C.glow, w: 4, op: 0.9, dash: [2, 12] })], { op: 0 }),
  node('fxConfetti', [120, 80], [
    rect('c1', 20, 20, 9, 4, 30, C.cheek), rect('c2', 224, 30, 9, 4, -20, C.leaf),
    rect('c3', 42, -22, 8, 4, 60, C.amber), rect('c4', 198, -32, 9, 4, 15, C.belly),
    rect('c5', 6, 186, 8, 4, -40, C.amber), rect('c6', 234, 196, 9, 4, 50, C.cheek),
    rect('c7', 72, -36, 7, 4, 10, C.leaf), rect('c8', 174, -40, 7, 4, -35, C.cheek),
  ], { op: 0 }),
]

const art = [
  node('shadow', [120, 256], [ell('ground_shadow', 120, 256, 58, 7, fill(C.ink, 0.16))]),
  node('mam', [120, 244], [
    node('foot_left', [100, 244], [ell('foot', 100, 244, 17, 9, fill(C.line))]),
    node('foot_right', [140, 244], [ell('foot', 140, 244, 17, 9, fill(C.line))]),
    node('body', [120, 244], [ell('body', 120, 206, 50, 38, { fill: C.shell, stroke: C.line, w: 3 }), ell('belly', 120, 214, 30, 22, fill(C.belly))]),
    head,
    arm('armL', 74, 18), arm('armR', 166, -18),
    ...fx,
  ]),
]

// ---------- geometry → RML ----------
const n = (v) => Math.round(v * 1e4) / 1e4
const argb = (hex) => 'ff' + hex.slice(1).toLowerCase()
const esc = (s) => String(s).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;')

// Absolute M/L/C/Q/Z only (the canvas never uses relative commands). Q becomes C.
function vertices(d, map) {
  const tokens = d.match(/[MLCQZ]|-?\d*\.?\d+/g)
  const out = []
  let i = 0, cmd, closed = false
  const read = () => [Number(tokens[i++]), Number(tokens[i++])]
  while (i < tokens.length) {
    if (/[MLCQZ]/.test(tokens[i])) cmd = tokens[i++]
    if (cmd === 'Z') { closed = true; break }
    const last = out.at(-1)
    if (cmd === 'M' || cmd === 'L') out.push({ p: read() })
    else if (cmd === 'C') { const [c1, c2, p] = [read(), read(), read()]; last.out = c1; out.push({ p, in: c2 }) }
    else if (cmd === 'Q') {
      const [q, p] = [read(), read()], p0 = last.p
      last.out = [p0[0] + (2 / 3) * (q[0] - p0[0]), p0[1] + (2 / 3) * (q[1] - p0[1])]
      out.push({ p, in: [p[0] + (2 / 3) * (q[0] - p[0]), p[1] + (2 / 3) * (q[1] - p[1])] })
    }
  }
  const first = out[0], end = out.at(-1)
  if (closed && out.length > 1 && end.p[0] === first.p[0] && end.p[1] === first.p[1]) { first.in = end.in; out.pop() }
  return { closed, list: out.map((v) => ({ p: map(v.p), in: v.in && map(v.in), out: v.out && map(v.out) })) }
}

let shapeId = 1000
const nodeIds = new Map()
const idOf = (key) => {
  if (!nodeIds.has(key)) nodeIds.set(key, 10 + nodeIds.size)
  return `0:${nodeIds.get(key)}`
}

function paintMarkup(paint) {
  let markup = ''
  if (paint.fill) markup += `<Fill name="fill"><SolidColor colorValue="${argb(paint.fill)}" name="color"/></Fill>`
  if (paint.stroke) {
    const dash = paint.dash ? `<DashPath name="dashes"><Dash length="${n(paint.dash[0] * S)}" name="on"/><Dash length="${n(paint.dash[1] * S)}" name="off"/></DashPath>` : ''
    markup += `<Stroke name="stroke" thickness="${n(paint.w * S)}" cap="round" join="round"><SolidColor colorValue="${argb(paint.stroke)}" name="color"/>${dash}</Stroke>`
  }
  return markup
}

// Children are listed back-to-front like SVG; Rive paints first-declared on top.
function emit(item, parentPivot) {
  const rel = ([x, y]) => [(x - parentPivot[0]) * S, (y - parentPivot[1]) * S]
  if (item.kind === 'node') {
    const [x, y] = rel(item.pivot), b = item.base
    const attrs = [`x="${n(x)}"`, `y="${n(y)}"`]
    if (b.rot) attrs.push(`rotation="${n(b.rot * DEG)}"`)
    if (b.s !== undefined) attrs.push(`scaleX="${n(b.s)}" scaleY="${n(b.s)}"`)
    if (b.op !== undefined) attrs.push(`opacity="${b.op}"`)
    return `<Node name="${item.key}" id="${idOf(item.key)}" ${attrs.join(' ')}>${[...item.children].reverse().map((c) => emit(c, item.pivot)).join('')}</Node>`
  }
  const op = item.paint.op !== undefined ? ` opacity="${item.paint.op}"` : ''
  if (item.kind === 'ellipse') {
    const [x, y] = rel(item.c)
    return `<Shape name="${item.name}" id="0:${shapeId++}" x="${n(x)}" y="${n(y)}"${op}><Ellipse width="${n(item.rx * 2 * S)}" height="${n(item.ry * 2 * S)}" originX="0.5" originY="0.5" name="geometry"/>${paintMarkup(item.paint)}</Shape>`
  }
  // Paths are emitted in the parent's space; `at` (+ mirror) places local part art.
  const local = item.at
    ? ([x, y]) => rel([item.at[0] + (item.mirror ? -x : x), item.at[1] + y])
    : rel
  let place = '', map = local
  if (item.spin) {
    const [cx, cy, deg] = item.spin, [px, py] = rel([cx, cy])
    place = ` x="${n(px)}" y="${n(py)}" rotation="${n(deg * DEG)}"`
    map = ([x, y]) => [(x - cx) * S, (y - cy) * S]
  }
  const { closed, list } = vertices(item.d, map)
  const handle = (v, h, prefix) => h
    ? `${prefix}Rotation="${n(Math.atan2(h[1] - v.p[1], h[0] - v.p[0]))}" ${prefix}Distance="${n(Math.hypot(h[0] - v.p[0], h[1] - v.p[1]))}"`
    : `${prefix}Distance="0"`
  const verts = list.map((v) => `<CubicDetachedVertex x="${n(v.p[0])}" y="${n(v.p[1])}" ${handle(v, v.in, 'in')} ${handle(v, v.out, 'out')}/>`).join('')
  return `<Shape name="${item.name}" id="0:${shapeId++}"${place}${op}><PointsPath isClosed="${closed}" isClockwise="true" name="geometry">${verts}</PointsPath>${paintMarkup(item.paint)}</Shape>`
}

// Node registry with rest values, for motion keys.
const nodes = new Map()
;(function index(items, parentPivot) {
  for (const item of items) if (item.kind === 'node') {
    const [x, y] = [(item.pivot[0] - parentPivot[0]) * S, (item.pivot[1] - parentPivot[1]) * S]
    nodes.set(item.key, { x, y, rot: item.base.rot ?? 0, s: item.base.s ?? 1, op: item.base.op ?? 1 })
    index(item.children, item.pivot)
  }
})(art, [ORIGIN[0] - 256 / S, ORIGIN[1] - 256 / S])

// ---------- motion ----------
// Keep this order: enum IDs are the v0.2 control contract.
const behaviors = ['idle', 'curious', 'listening', 'thinking', 'gentle', 'explaining', 'light_success', 'celebrate_soft', 'celebrate_hero', 'rest', 'sad', 'happy']
const finite = new Set(['light_success', 'celebrate_soft', 'celebrate_hero'])
const ids = { vm: 3000, instance: 3001, behavior: 3010, attention: 3011, tier: 3012, reduced: 3013, visible: 3014, play: 3015, dock: 3016, machine: 3100 }
const id = (number) => `0:${number}`
const enumValue = (name) => 3401 + behaviors.indexOf(name)
const allStates = [...behaviors, 'hidden', 'return_to_dock']
// The Face layer mirrors the Behavior graph with 0 ms switches so eye/brow/mouth
// variants swap cleanly instead of cross-fading into a ghosted double face.
const stateId = (name, face) => (face ? 3600 : 3200) + allStates.indexOf(name)
const animationId = (name, face) => (face ? 3700 : 3300) + allStates.indexOf(name)
// Spec: blend 200–300 ms; sad arrives slower (600 ms) so it never feels abrupt.
const blendInto = (name) => (name === 'sad' ? 600 : 260)

function condition(property, type, key, literal, op = 'equal') {
  return `<TransitionViewModelCondition opValue="${op}"><TransitionPropertyViewModelComparator><BindableProperty${type}><DataBindContext sourcePathIds="${id(ids.vm)}-${id(property)}" propertyKey="${key}"/></BindableProperty${type}></TransitionPropertyViewModelComparator><TransitionValue${type}Comparator${literal === undefined ? '' : ` value="${literal}"`}/></TransitionViewModelCondition>`
}
const bool = (property, value) => condition(property, 'Boolean', 634, value)
const behavior = (name) => condition(ids.behavior, 'Enum', 637, id(enumValue(name)))
const trigger = (property) => condition(property, 'Trigger', 686)
const tier = (index) => condition(ids.tier, 'Enum', 637, id(3421 + index))
const permitted = () => bool(ids.visible, true) + bool(ids.reduced, false)
const writeEnum = (property, value) => `<ListenerViewModelChange><BindablePropertyEnum propertyValue="${id(value)}"><DataBindContext sourcePathIds="${id(ids.vm)}-${id(property)}" propertyKey="637" direction="true"/></BindablePropertyEnum></ListenerViewModelChange>`

function outgoing(name, face = false) {
  const route = (target, conditions = '', duration = 260, extra = '') => `<StateTransition stateToId="${id(stateId(target, face))}" duration="${face ? 0 : duration}" enableEarlyExit="true" ${extra}>${conditions}</StateTransition>`
  let result = ''
  if (name !== 'hidden') result += route('hidden', bool(ids.visible, false), 0)
  if (name !== 'rest') {
    result += route('rest', bool(ids.visible, true) + bool(ids.reduced, true), 0)
    result += route('rest', bool(ids.visible, true) + behavior('rest'), 200)
  }
  if (name !== 'return_to_dock') result += route('return_to_dock', permitted() + trigger(ids.dock), 220)
  if (finite.has(name)) return result + route('return_to_dock', '', 220, 'enableExitTime="true" exitTimeIsPercetange="true" exitTime="100"')
  for (const target of behaviors) {
    if (target === name || target === 'rest') continue
    if (finite.has(target)) {
      const allowed = permitted() + condition(ids.behavior, 'Enum', 637, id(enumValue('rest')), 'notEqual')
      result += route(target, allowed + behavior(target) + trigger(ids.play), 100)
      if (target !== 'light_success') {
        const noExplicitAction = [...finite].map((action) => condition(ids.behavior, 'Enum', 637, id(enumValue(action)), 'notEqual')).join('')
        result += route(target, allowed + noExplicitAction + tier(target === 'celebrate_soft' ? 1 : 2) + trigger(ids.play), 100)
      }
    } else result += route(target, permitted() + behavior(target), blendInto(target))
  }
  // A consumed one-shot cannot resume after hide/reduced motion: recover to idle.
  if (name === 'hidden' || name === 'rest') {
    for (const target of finite) result += route('return_to_dock', permitted() + behavior(target), 0)
  }
  return result
}

// Pose channels, in design units: rot (deg), dx/dy (canvas units), s/sx/sy, op.
// leafL/leafR also accept `lift` (deg; positive raises the leaf tip on both sides).
const F = (...pairs) => pairs
const hold = (v) => [[0, v]]
const face = (spec) => {
  const pick = { eye: 'open', eyeL: undefined, eyeR: undefined, brow: 'neutral', browL: undefined, browR: undefined, mouth: 'smile', lid: undefined, ...spec }
  const pose = {}
  for (const side of ['L', 'R']) {
    const eyeName = pick[`eye${side}`] ?? pick.eye
    for (const v of [...Object.keys(eyeVariants), 'happy']) pose[`eye${side}_${v}.op`] = hold(v === eyeName ? 1 : 0)
    const browName = pick[`brow${side}`] ?? pick.brow
    for (const v of Object.keys(browPaths)) pose[`brow${side}_${v}.op`] = hold(v === browName ? 1 : 0)
  }
  for (const v of Object.keys(mouthShapes)) pose[`mouth_${v}.op`] = hold(v === pick.mouth ? 1 : 0)
  pose['lidSoft.op'] = hold(pick.lid === 'soft' ? 1 : 0)
  pose['lidSad.op'] = hold(pick.lid === 'sad' ? 1 : 0)
  return pose
}
const glowScale = (r) => r / 34
const glowOp = (o) => o / 0.5
const lift = (side, frames) => ({ [`leaf${side}.rot`]: frames.map(([f, deg]) => [f, side === 'L' ? deg : -deg]) })
const leaves = (frames) => ({ ...lift('L', frames), ...lift('R', frames) })
const arms = (l, r) => ({ ...(l && { 'armL.rot': l }), ...(r && { 'armR.rot': r }) })

const happyFace = face({ eye: 'happy', brow: 'raised', mouth: 'open' })
const timelines = {
  idle: [420, true, {
    ...face({}),
    'body.sy': F([0, 1], [105, 1.02], [210, 1], [315, 1.02], [420, 1]),
    'head.dy': F([0, 0], [105, -1], [210, 0], [315, -1], [420, 0]),
    ...lift('L', F([0, 0], [105, 4], [210, 0], [315, -4], [420, 0])),
    ...lift('R', F([0, 0], [105, -4], [210, 0], [315, 4], [420, 0])),
    'glow.op': F([0, glowOp(0.22)], [105, glowOp(0.3)], [210, glowOp(0.22)], [315, glowOp(0.3)], [420, glowOp(0.22)]),
    'eyeL.sy': F([0, 1], [120, 1], [125, 0.1], [131, 1], [330, 1], [335, 0.1], [341, 1], [420, 1]),
    'eyeR.sy': F([0, 1], [120, 1], [125, 0.1], [131, 1], [330, 1], [335, 0.1], [341, 1], [420, 1]),
  }],
  curious: [60, false, {
    ...face({ eye: 'wide', browR: 'high', mouth: 'o' }),
    'mam.rot': hold(7), 'sprout.rot': hold(10), ...leaves(hold(10)),
    'glow.s': hold(glowScale(24)), 'glow.op': F([0, glowOp(0.32)], [15, glowOp(0.46)], [45, glowOp(0.32)]),
    'orb.s': F([0, 1], [15, 1.12], [45, 1]),
    ...arms(null, hold(170)),
    'fxCurious.op': F([0, 0], [14, 1]), 'fxCurious.s': F([0, 0.4], [18, 1.15], [30, 1]),
  }],
  listening: [72, true, {
    ...face({ eye: 'focus', brow: 'soft', mouth: 'rest' }),
    'mam.rot': hold(-5), 'sprout.rot': hold(-6), ...leaves(hold(2)),
    'glow.s': hold(glowScale(21)), 'glow.op': hold(glowOp(0.3)), 'cheeks.op': hold(0.7),
    ...arms(hold(151)),
    'wave1.op': F([0, 0], [24, 1], [60, 0], [72, 0]), 'wave1.dx': F([0, 3], [72, -3]),
    'wave2.op': F([0, 0], [14, 0], [40, 1], [72, 0]), 'wave2.dx': F([0, 3], [72, -3]),
  }],
  thinking: [90, true, {
    ...face({ eye: 'lookup', browL: 'raised', browR: 'low', mouth: 'side' }),
    'mam.rot': hold(3), 'sprout.rot': hold(6),
    ...leaves(F([0, -4], [22, -2], [45, -4], [67, -6], [90, -4])),
    'glow.s': hold(glowScale(18)), 'glow.op': hold(glowOp(0.2)), 'cheeks.op': hold(0.6),
    'thinkRings.op': F([0, 0.7], [45, 1], [90, 0.7]), 'thinkRings.s': F([0, 1], [45, 1.06], [90, 1]),
    ...arms(null, hold(118)),
    'dot1.op': F([0, 0], [10, 1], [76, 1], [90, 0]),
    'dot2.op': F([0, 0], [24, 0], [34, 1], [76, 1], [90, 0]),
    'dot3.op': F([0, 0], [44, 0], [54, 1], [76, 1], [90, 0]),
  }],
  gentle: [240, true, {
    ...face({ eye: 'soft', lid: 'soft', brow: 'soft', mouth: 'gentle' }),
    ...leaves(hold(-6)),
    'glow.s': F([0, glowScale(23)], [120, glowScale(25)], [240, glowScale(23)]), 'glow.op': hold(glowOp(0.3)),
    'cheeks.op': hold(1), 'body.sy': F([0, 1], [120, 1.015], [240, 1]),
    ...arms(hold(-51), hold(51)),
  }],
  explaining: [180, true, {
    ...face({ brow: 'raised', mouth: 'talk' }),
    'sprout.rot': hold(-3), ...leaves(F([0, 6], [24, 10], [48, 6], [72, 10], [96, 6], [180, 6])),
    'glow.s': hold(glowScale(22)), 'glow.op': F([0, glowOp(0.26)], [24, glowOp(0.34)], [48, glowOp(0.26)], [72, glowOp(0.34)], [96, glowOp(0.26)], [180, glowOp(0.26)]),
    ...arms(null, F([0, -108], [24, -96], [48, -108], [72, -96], [96, -108], [180, -108])),
    'fxExplain.op': F([0, 0.35], [24, 1], [48, 0.35], [72, 1], [96, 0.35], [180, 0.35]),
  }],
  happy: [48, false, {
    ...happyFace,
    'mam.dy': F([0, 0], [8, 1], [20, -8], [34, -1], [48, -2]),
    'mam.sy': F([0, 1], [8, 0.97], [20, 1.03], [34, 0.99], [48, 1]),
    'shadow.sx': F([0, 1], [20, 0.88], [48, 0.97]),
    ...leaves(F([0, 0], [20, 18], [48, 14])),
    'glow.s': hold(glowScale(26)), 'glow.op': hold(glowOp(0.38)), 'cheeks.op': hold(0.9),
    ...arms(F([0, 18], [20, 80]), F([0, -18], [20, -80])),
    'fxHappy.op': F([0, 0], [18, 1]), 'fxHappy.s': F([0, 0.6], [22, 1.08], [40, 1]),
  }],
  sad: [90, false, {
    ...face({ eye: 'sad', lid: 'sad', brow: 'sad', mouth: 'frown' }),
    'mam.dy': hold(3), 'shadow.sx': hold(0.953), 'sprout.rot': hold(-8), ...leaves(hold(-26)),
    'glow.op': hold(0), 'orbDim.op': hold(1), 'cheeks.op': hold(0.45),
    ...arms(hold(4), hold(-4)),
    'tear.op': F([0, 0], [40, 0], [70, 1]), 'tear.dy': F([0, -3], [40, -3], [90, 0]),
  }],
  light_success: [72, false, {
    ...happyFace,
    ...leaves(F([0, 0], [20, 14], [60, 10], [72, 0])),
    'glow.op': F([0, glowOp(0.22)], [20, glowOp(0.4)], [72, glowOp(0.22)]), 'glow.s': F([0, glowScale(20)], [20, glowScale(26)], [72, glowScale(20)]),
    ...arms(null, F([0, -18], [18, -125], [34, -105], [50, -125], [72, -18])),
    'fxHappy.op': F([0, 0], [16, 1], [56, 1], [72, 0]),
  }],
  // ~0.9 s single bounce (Bingo); last 18 frames settle back to the dock pose.
  celebrate_soft: [54, false, {
    ...happyFace,
    'mam.dy': F([0, 0], [8, 2], [22, -6], [34, 0], [40, -1], [54, 0]),
    'mam.sx': F([0, 1], [8, 1.04], [22, 0.97], [34, 1.02], [54, 1]),
    'mam.sy': F([0, 1], [8, 0.96], [22, 1.04], [34, 0.98], [54, 1]),
    'shadow.sx': F([0, 1], [8, 1.03], [22, 0.907], [34, 1], [54, 1]),
    ...leaves(F([0, 0], [8, -4], [22, 20], [40, 14], [54, 0])),
    'glow.s': F([0, glowScale(20)], [22, glowScale(28)], [54, glowScale(20)]), 'glow.op': F([0, glowOp(0.22)], [22, glowOp(0.42)], [54, glowOp(0.22)]),
    'cheeks.op': hold(0.9),
    ...arms(F([0, 18], [8, 10], [22, 125], [40, 125], [54, 18]), F([0, -18], [8, -10], [22, -125], [40, -125], [54, -18])),
    'fxSparkle.op': F([0, 0], [16, 1], [40, 1], [54, 0]), 'fxSparkle.s': F([0, 0.7], [24, 1.05], [54, 1.1]),
  }],
  // ~1.5 s hop: anticipation squash → 16-unit launch with stretch → land → settle.
  celebrate_hero: [90, false, {
    ...face({ eye: 'happy', brow: 'high', mouth: 'big' }),
    'mam.dy': F([0, 0], [10, 3], [28, -16], [46, -14], [58, 2], [70, 0], [90, 0]),
    'mam.sx': F([0, 1], [10, 1.05], [28, 0.95], [46, 0.97], [58, 1.05], [70, 1], [90, 1]),
    'mam.sy': F([0, 1], [10, 0.93], [28, 1.06], [46, 1.03], [58, 0.94], [70, 1], [90, 1]),
    'shadow.sx': F([0, 1], [10, 1.05], [28, 0.752], [46, 0.77], [58, 1.05], [70, 1], [90, 1]),
    'shadow.op': F([0, 1], [28, 0.625], [46, 0.65], [58, 1], [90, 1]),
    ...leaves(F([0, 0], [10, -8], [28, 34], [46, 28], [58, 12], [74, 0], [90, 0])),
    'glow.s': F([0, glowScale(20)], [28, 1], [70, 1], [90, glowScale(20)]), 'glow.op': F([0, glowOp(0.22)], [28, 1], [70, 1], [90, glowOp(0.22)]),
    'orb.s': F([0, 1], [28, 1.18], [46, 1.08], [90, 1]), 'cheeks.op': hold(0.95),
    ...arms(F([0, 18], [10, 4], [28, 152], [62, 152], [80, 18], [90, 18]), F([0, -18], [10, -4], [28, -152], [62, -152], [80, -18], [90, -18])),
    'fxRing.op': F([0, 0], [22, 0], [32, 1], [64, 1], [82, 0]), 'fxRing.s': F([0, 0.8], [22, 0.8], [40, 1], [82, 1.04]),
    'fxSparkle.op': F([0, 0], [26, 1], [70, 1], [86, 0]), 'fxSparkle.s': F([0, 0.7], [32, 1.08], [86, 1.12]),
    'fxConfetti.op': F([0, 0], [26, 0], [32, 1], [70, 1], [86, 0]), 'fxConfetti.dy': F([0, 10], [26, 10], [86, 22]),
  }],
  rest: [1, false, face({})],
  hidden: [1, false, { ...face({}), 'mam.op': hold(0), 'shadow.op': hold(0) }],
  return_to_dock: [1, false, face({})],
}

const channel = { rot: 'rotation', dx: 'x', dy: 'y', sx: 'scaleX', sy: 'scaleY', op: 'opacity' }
function resolve(timeline) {
  // Expand `s` into scaleX/scaleY and convert units into RML property values.
  const out = {}
  for (const [path, frames] of Object.entries(timeline)) {
    const [key, ch] = path.split('.')
    if (!nodes.has(key)) throw Error(`Unknown node ${key}`)
    const rest = nodes.get(key)
    const conv = {
      rot: (v) => v * DEG, dx: (v) => rest.x + v * S, dy: (v) => rest.y + v * S, op: (v) => v,
      sx: (v) => v, sy: (v) => v, s: (v) => v,
    }[ch]
    const values = frames.map(([f, v]) => [f, n(conv(v))])
    for (const prop of ch === 's' ? ['scaleX', 'scaleY'] : [channel[ch]]) out[`${key}.${prop}`] = values
  }
  return out
}
const resolved = Object.fromEntries(Object.entries(timelines).map(([name, [, , t]]) => [name, resolve(t)]))
// Every animation keys every animated channel so blends between states are exact.
const animated = [...new Set(Object.values(resolved).flatMap((t) => Object.keys(t)))]
const restValue = (key, prop) => {
  const r = nodes.get(key)
  return { x: r.x, y: r.y, rotation: n(r.rot * DEG), scaleX: r.s, scaleY: r.s, opacity: r.op }[prop]
}
const keys = (values) => values.map(([frame, value], index) => index === values.length - 1
  ? `<KeyFrameDouble frame="${frame}" value="${value}" interpolationType="linear"/>`
  : `<KeyFrameDouble frame="${frame}" value="${value}" interpolationType="cubic"><CubicEaseInterpolator x1="0.33" y1="0" x2="0.2" y2="1"/></KeyFrameDouble>`).join('')

const isFace = (channelKey) => /^(eye[LR]_|brow[LR]_|mouth_|lid)/.test(channelKey)
function animation(name, face = false) {
  const [duration, loop] = timelines[name]
  const byObject = new Map()
  for (const channelKey of animated.filter((c) => isFace(c) === face)) {
    const [key, prop] = channelKey.split('.')
    if (!byObject.has(key)) byObject.set(key, [])
    byObject.get(key).push(`<KeyedProperty property="${prop}">${keys(resolved[name][channelKey] ?? [[0, restValue(key, prop)]])}</KeyedProperty>`)
  }
  const objects = [...byObject].map(([key, props]) => `<KeyedObject objectId="${idOf(key)}">${props.join('')}</KeyedObject>`).join('')
  return `<LinearAnimation name="${face ? `face_${name}` : name}" id="${id(animationId(name, face))}" fps="60" duration="${duration}" loopValue="${loop ? 'loop' : 'oneShot'}">${objects}</LinearAnimation>`
}

function buildMotion() {
  const rootMarkup = `<DataEnumCustom name="MamBehavior" id="0:3400">${behaviors.map((name) => `<DataEnumValue key="${name}" value="${name}" id="${id(enumValue(name))}"/>`).join('')}</DataEnumCustom>
<DataEnumCustom name="MamCelebrationTier" id="0:3420">${['none', 'soft', 'hero'].map((name, index) => `<DataEnumValue key="${name}" value="${name}" id="${id(3421 + index)}"/>`).join('')}</DataEnumCustom>
<DataConverterRangeMapper minInput="-1" maxInput="1" minOutput="0" maxOutput="100" clampLower="true" clampUpper="true" name="AttentionRange" id="0:3450"/>
<ViewModel name="MamControls" id="0:3000" defaultInstanceId="0:3001">
<ViewModelPropertyEnumCustom name="behaviorState" id="0:3010" enumId="0:3400"/>
<ViewModelPropertyNumber name="attentionDirection" id="0:3011"/>
<ViewModelPropertyEnumCustom name="celebrationTier" id="0:3012" enumId="0:3420"/>
<ViewModelPropertyBoolean name="reducedMotion" id="0:3013"/>
<ViewModelPropertyBoolean name="isVisible" id="0:3014"/>
<ViewModelPropertyTrigger name="playOnce" id="0:3015"/>
<ViewModelPropertyTrigger name="returnToDock" id="0:3016"/>
<ViewModelInstance exports="true" name="Default" id="0:3001">
<ViewModelInstanceEnum viewModelPropertyId="0:3010" propertyValue="0:3401"/>
<ViewModelInstanceNumber viewModelPropertyId="0:3011" propertyValue="0"/>
<ViewModelInstanceEnum viewModelPropertyId="0:3012" propertyValue="0:3421"/>
<ViewModelInstanceBoolean viewModelPropertyId="0:3013" propertyValue="false"/>
<ViewModelInstanceBoolean viewModelPropertyId="0:3014" propertyValue="true"/>
<ViewModelInstanceTrigger viewModelPropertyId="0:3015"/>
<ViewModelInstanceTrigger viewModelPropertyId="0:3016"/>
</ViewModelInstance></ViewModel>`
  // Only the Behavior layer writes back to the view model on return_to_dock.
  const states = (face) => allStates.map((name, index) => `<AnimationState stateName="${name}" stateCaption="${name}" x="${160 + (index % 4) * 240}" y="${120 + Math.floor(index / 4) * 220}" reset="true" animationId="${id(animationId(name, face))}" id="${id(stateId(name, face))}">${name === 'return_to_dock' && !face ? writeEnum(ids.behavior, enumValue('idle')) + writeEnum(ids.tier, 3421) : ''}${outgoing(name, face)}</AnimationState>`).join('')
  const layer = (label, layerId, face) => `<StateMachineLayer name="${label}" id="${layerId}"><AnyState x="0" y="-120"/><ExitState x="1080" y="-120"/><EntryState x="0" y="120"><StateTransition stateToId="${id(stateId('idle', face))}"/></EntryState>${states(face)}</StateMachineLayer>`
  const machine = `<StateMachine name="MamBehaviorController" id="0:3100">${layer('Behavior', '0:3101', false)}${layer('Face', '0:3103', true)}<StateMachineLayer name="Attention" id="0:3102"><AnyState x="0" y="-120"/><ExitState x="400" y="-120"/><EntryState x="0" y="0"><StateTransition stateToId="0:3250"/></EntryState><BlendState1DViewModel stateName="attention" x="200" y="0" id="0:3250"><BindablePropertyNumber><DataBindContext sourcePathIds="0:3000-0:3011" propertyKey="636" converterId="0:3450"/></BindablePropertyNumber><BlendAnimation1D animationId="0:3350" value="0"/><BlendAnimation1D animationId="0:3351" value="50"/><BlendAnimation1D animationId="0:3352" value="100"/></BlendState1DViewModel></StateMachineLayer></StateMachine>`
  // Gaze: pupils shift up to 4 canvas units (6 px) left/right; behavior layer never keys gaze.
  const gaze = ['left', 'center', 'right'].map((name, index) => `<LinearAnimation name="attention_${name}" id="${id(3350 + index)}" duration="1">${['gazeL', 'gazeR'].map((key) => `<KeyedObject objectId="${idOf(key)}"><KeyedProperty property="x">${keys([[0, n(nodes.get(key).x + (index - 1) * 4 * S)]])}</KeyedProperty></KeyedObject>`).join('')}</LinearAnimation>`).join('')
  return { rootMarkup, artboardMarkup: machine + allStates.map((name) => animation(name) + animation(name, true)).join('') + gaze }
}

function buildScene(background) {
  shapeId = 1000
  const body = [...art].reverse().map((item) => emit(item, [ORIGIN[0] - 256 / S, ORIGIN[1] - 256 / S])).join('\n')
  const motion = buildMotion()
  const ground = background ? `<Fill name="capture background"><SolidColor name="capture ground" colorValue="${argb(background)}"/></Fill>` : ''
  return `<Rive version="1" kind="fragment">${motion.rootMarkup}<Artboard name="companion_main" id="0:2" styleId="0:3" width="512" height="512" defaultStateMachineId="0:3100" viewModelId="0:3000" viewModelInstanceId="0:3001"><LayoutComponentStyle name="companion canvas" id="0:3"/>${ground}${body}\n${motion.artboardMarkup}</Artboard></Rive>\n`
}

if (nodeIds.size === 0) for (const key of nodes.keys()) idOf(key)
if (nodeIds.size + 10 >= 1000) throw Error('Node IDs overlap shape IDs')
await mkdir(join(directory, 'rig'), { recursive: true })
await mkdir(join(directory, 'capture'), { recursive: true })
await writeFile(join(directory, 'rig', 'scene.rml'), buildScene())
await writeFile(join(directory, 'rig', 'rive.yaml'), 'name: mam-v03\nmain: companion_main\nlogs:\n  file: build/rive.log\n  problems: build/problems.log\n')
await writeFile(join(directory, 'capture', 'scene.rml'), buildScene('#F1F4EB'))
await writeFile(join(directory, 'capture', 'rive.yaml'), 'name: mam-v03-capture\nmain: companion_main\n')
console.log(JSON.stringify({ artboard: 'companion_main', nodes: nodeIds.size, shapes: shapeId - 1000, states: allStates.length }))
