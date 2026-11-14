import * as THREE from 'three'
import {
  at,
  atScaled,
  box,
  flat,
  gableEnd,
  gableRoof,
  makeBuilder,
  makeWalls,
  tube,
  wallZ,
} from './kit.js'
import { bulb } from './lamps.js'
import { seeded } from './textures.js'

// 家のまわり。庭 (畑・池・ビニールハウス・大きな木)、林、用水路、田んぼ、東の道と、道の向こうの牛・豚小屋。
// 遠くには、屋敷林に囲まれた家と山が見える。
// 敷地は x が -22 から 29.6、z が -20.4 から 28 で、まわりの田んぼより 25 cm 高い

const PADDY = -0.25
// 道 (路肩を入れた幅) の西の端と東の端
const ROAD_W = 29.6
const ROAD_E = 34.0

const STONE = new THREE.IcosahedronGeometry(1, 0)
const LEAF = new THREE.IcosahedronGeometry(1, 0)
const Y = new THREE.Vector3(0, 1, 0)

/**
 * x, y, z の点を作る
 */
const v = (x, y, z) => new THREE.Vector3(x, y, z)

/**
 * 家のまわりを組んで scene に足す。ぶつかる線、床、場所の名前、照明の置き場所を返す
 */
export const buildSite = (scene, mats) => {
  const root = new THREE.Group()
  scene.add(root)
  const b = makeBuilder()
  const c = {
    b,
    mats,
    root,
    walls: [],
    floors: [],
    places: [],
    fixtures: [],
    trees: [],
    plants: [],
  }
  c.W = makeWalls(b, mats, c.walls)
  ground(c)
  yard(c)
  greenhouse(c)
  cowShed(c)
  poles(c)
  woods(c)
  farmsteads(c)
  mountains(c)
  bounds(c)
  plantTrees(c)
  plantCrops(c)
  b.build(root)
  return { root, walls: c.walls, floors: c.floors, places: c.places, fixtures: c.fixtures }
}

/**
 * 地面。遠くまで続く田んぼ、敷地、道、用水路、田んぼのあぜ
 */
const ground = (c) => {
  const { b, mats } = c
  flat(b, mats.paddy, PADDY, -4500, 4500, -4500, 4500, 1)
  box(b, mats.grass, -22, ROAD_W, PADDY, 0, -20.4, 28)
  box(b, mats.dirt, ROAD_E, 47, PADDY, 0, -8, 22)
  box(b, mats.asphalt, 30.2, 33.4, PADDY, 0.05, -1500, 1500)
  box(b, mats.gravel, ROAD_W, 30.2, PADDY, 0.02, -1500, 1500)
  box(b, mats.gravel, 33.4, ROAD_E, PADDY, 0.02, -1500, 1500)
  // 用水路 (土の川)。敷地の北を、東へ流れる。北の岸はあぜ道
  flat(b, mats.water, -0.17, -1500, 1500, -21.6, -20.4, 1)
  box(b, mats.levee, -1500, 1500, PADDY, 0.03, -23, -21.6)
  box(b, mats.levee, -1500, -22, PADDY, 0.03, -20.4, -19.6)
  box(b, mats.levee, ROAD_E, 1500, PADDY, 0.03, -20.4, -19.6)
  c.floors.push(
    { x0: -5000, x1: 5000, z0: -5000, z1: 5000, h: PADDY, s: 'ground' },
    { x0: -22, x1: ROAD_W, z0: -20.4, z1: 28, h: 0, s: 'grass' },
    { x0: ROAD_E, x1: 47, z0: -8, z1: 22, h: 0, s: 'gravel' },
    { x0: ROAD_W, x1: 30.2, z0: -1500, z1: 1500, h: 0.02, s: 'gravel' },
    { x0: 33.4, x1: ROAD_E, z0: -1500, z1: 1500, h: 0.02, s: 'gravel' },
    { x0: 30.2, x1: 33.4, z0: -1500, z1: 1500, h: 0.05, s: 'hard' },
    { x0: -1500, x1: -22, z0: -20.4, z1: -19.6, h: 0.03, s: 'grass' },
    { x0: ROAD_E, x1: 1500, z0: -20.4, z1: -19.6, h: 0.03, s: 'grass' },
  )

  // 田んぼのあぜ。敷地と道のところは、よける
  /**
   * あぜを1本置く
   */
  const levee = (x0, x1, z0, z1) => box(b, mats.levee, x0, x1, PADDY, PADDY + 0.14, z0, z1)
  for (let k = -24; k <= 24; k++) {
    const x = 7 + k * 32
    if (x > ROAD_W - 1 && x < ROAD_E + 1) continue
    if (x >= -22 && x <= ROAD_W) {
      levee(x - 0.25, x + 0.25, -780, -23)
      levee(x - 0.25, x + 0.25, 28, 780)
    } else if (x >= ROAD_E && x <= 47) {
      levee(x - 0.25, x + 0.25, -780, -23)
      levee(x - 0.25, x + 0.25, -19.6, -8)
      levee(x - 0.25, x + 0.25, 22, 780)
    } else {
      levee(x - 0.25, x + 0.25, -780, -23)
      levee(x - 0.25, x + 0.25, -19.6, 780)
    }
  }
  for (let k = 0; k <= 19; k++) {
    ;[-23 - 40 * (k + 1), 28 + 40 * k].forEach((z) => {
      levee(-780, ROAD_W, z - 0.25, z + 0.25)
      levee(ROAD_E, 780, z - 0.25, z + 0.25)
    })
  }
  levee(-780, -22, 3.75, 4.25)
  levee(47, 780, 3.75, 4.25)

  c.places.push(
    { name: '道', x0: ROAD_W, x1: ROAD_E, z0: -1500, z1: 1500 },
    { name: '用水路', x0: -22, x1: ROAD_W, z0: -20.4, z1: -19.0 },
    { name: '田んぼ', x0: -5000, x1: -22, z0: -5000, z1: 5000 },
    { name: '田んぼ', x0: -5000, x1: 5000, z0: 28, z1: 5000 },
    { name: '田んぼ', x0: 47, x1: 5000, z0: -5000, z1: 5000 },
    { name: '田んぼ', x0: ROAD_E, x1: 47, z0: -20.4, z1: -8 },
    { name: '田んぼ', x0: ROAD_E, x1: 47, z0: 22, z1: 28 },
  )
}

/**
 * 庭。家のまわりの土、玄関から道までの砂利、畑、池、庭の大きな木
 */
const yard = (c) => {
  const { b, mats, W } = c
  // 家のまわりの、踏み固めた土 (前と、中庭と、北の家の裏)
  flat(b, mats.dirt, 0.004, 9.1, 17.5, -6.5, 12.5, 1)
  flat(b, mats.dirt, 0.004, 1.82, 9.1, -13.2, -5.46, 1)
  flat(b, mats.dirt, 0.004, -6.4, 17.2, -14.0, -12.74, 1)
  // 玄関から道までの砂利の道
  flat(b, mats.gravel, 0.008, 11.0, ROAD_W, -3.5, -1.05, 1)
  c.floors.push(
    { x0: 9.1, x1: 17.5, z0: -6.5, z1: 12.5, h: 0, s: 'ground' },
    { x0: 1.82, x1: 9.1, z0: -13.2, z1: -5.46, h: 0, s: 'ground' },
    { x0: -6.4, x1: 17.2, z0: -14.0, z1: -12.74, h: 0, s: 'ground' },
    { x0: 11.0, x1: ROAD_W, z0: -3.5, z1: -1.05, h: 0, s: 'gravel' },
  )
  c.places.push({ name: '中庭', x0: 1.82, x1: 9.1, z0: -12.74, z1: -5.46 })

  // 畑。うねが南北に10本。2本おきに、野菜が育っている
  flat(b, mats.soil, 0.006, 17, 26, -0.5, 9, 1)
  for (let i = 0; i < 10; i++) {
    const x = 17.45 + i * 0.9
    box(b, mats.soil, x - 0.25, x + 0.25, 0, 0.14, -0.2, 8.7)
    if (i % 3 === 2) continue
    for (let z = 0.1; z < 8.6; z += 0.42) {
      c.plants.push([x, 0.2, z, 0.16 + ((i * 7 + z * 13) % 5) * 0.015])
    }
  }
  c.floors.push({ x0: 17, x1: 26, z0: -0.5, z1: 9, h: 0, s: 'ground' })
  c.places.push({ name: '畑', x0: 17, x1: 26, z0: -0.5, z1: 9 })

  // 池。水のまわりに石を並べる
  const [px, pz, rx, rz] = [21.5, 15.0, 2.6, 1.8]
  b.add(
    new THREE.CircleGeometry(1, 32),
    mats.water,
    atScaled(px, 0.03, pz, -Math.PI / 2, 0, 0, rx, rz, 1),
  )
  const rnd = seeded(7)
  for (let i = 0; i < 28; i++) {
    const t = (i / 28) * Math.PI * 2 + rnd() * 0.1
    const s = 0.2 + rnd() * 0.18
    b.add(
      STONE,
      mats.stone,
      atScaled(
        px + Math.cos(t) * (rx + 0.12),
        s * 0.35,
        pz + Math.sin(t) * (rz + 0.12),
        rnd() * 3,
        rnd() * 3,
        rnd() * 3,
        s * 1.3,
        s * 0.8,
        s,
      ),
    )
  }
  const n = 16
  for (let i = 0; i < n; i++) {
    const t0 = (i / n) * Math.PI * 2
    const t1 = ((i + 1) / n) * Math.PI * 2
    c.walls.push({
      ax: px + Math.cos(t0) * (rx + 0.3),
      az: pz + Math.sin(t0) * (rz + 0.3),
      bx: px + Math.cos(t1) * (rx + 0.3),
      bz: pz + Math.sin(t1) * (rz + 0.3),
    })
  }
  c.places.push({
    name: '池',
    x0: px - rx - 0.9,
    x1: px + rx + 0.9,
    z0: pz - rz - 0.9,
    z1: pz + rz + 0.9,
  })
}

/**
 * ビニールハウスの屋根の面。アーチの形を、x の向きにのばす
 */
const vinylArch = (x0, x1, cz, cy, R, arc) => {
  const g = new THREE.PlaneGeometry(1, 1, 1, 16)
  const pos = g.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i) + 0.5
    const s = pos.getY(i) * arc
    pos.setXYZ(i, x0 + u * (x1 - x0), cy + R * Math.cos(s), cz + R * Math.sin(s))
  }
  g.computeVertexNormals()
  return g
}

/**
 * ビニールハウスの端の面。下は四角、上はアーチの形。x = 0 の面に、z と y で描く
 * @param door - 入口の穴 [z0, z1, 高さ]。無ければ、ふさぐ
 */
const archCap = (cz, cy, R, halfSpan, side, door) => {
  const shape = new THREE.Shape()
  shape.moveTo(cz - halfSpan, 0)
  shape.lineTo(cz + halfSpan, 0)
  shape.lineTo(cz + halfSpan, side)
  const a = Math.asin(halfSpan / R)
  for (let i = 1; i <= 16; i++) {
    const s = a - (2 * a * i) / 16
    shape.lineTo(cz + R * Math.sin(s), cy + R * Math.cos(s))
  }
  shape.lineTo(cz - halfSpan, 0)
  if (door) {
    const [d0, d1, dh] = door
    const hole = new THREE.Path()
    hole.moveTo(d0, 0.02)
    hole.lineTo(d0, dh)
    hole.lineTo(d1, dh)
    hole.lineTo(d1, 0.02)
    hole.lineTo(d0, 0.02)
    shape.holes.push(hole)
  }
  return new THREE.ShapeGeometry(shape)
}

/**
 * ビニールハウス。パイプのアーチにビニールを張る。入口は西の端にある。中にトマトが2列
 */
const greenhouse = (c) => {
  const { b, mats, W } = c
  const [gx0, gx1, gz0, gz1] = [17, 26, -14.5, -9.5]
  const gz = (gz0 + gz1) / 2
  const halfSpan = (gz1 - gz0) / 2
  const R = 2.75
  const cy = 0.05
  const arc = 2 * Math.asin(halfSpan / R)
  const side = cy + Math.sqrt(R * R - halfSpan * halfSpan)
  const arch = new THREE.TorusGeometry(R, 0.017, 4, 28, arc)
  for (let x = gx0; x <= gx1 + 0.01; x += 0.9) {
    tube(b, mats.pipe, v(x, 0, gz0), v(x, side, gz0), 0.017)
    tube(b, mats.pipe, v(x, 0, gz1), v(x, side, gz1), 0.017)
    b.add(arch, mats.pipe, at(x, cy, gz, 0, Math.PI / 2, Math.PI / 2 - arc / 2))
  }
  b.add(vinylArch(gx0, gx1, gz, cy, R, arc), mats.vinyl, at(0, 0, 0))
  wallZ(b, mats.vinyl, gz0, gx0, gx1, 0, side, -1)
  wallZ(b, mats.vinyl, gz1, gx0, gx1, 0, side, 1)
  b.add(archCap(gz, cy, R, halfSpan, side, null), mats.vinyl, at(gx1, 0, 0, 0, -Math.PI / 2, 0))
  b.add(
    archCap(gz, cy, R, halfSpan, side, [-12.5, -11.5, 2.0]),
    mats.vinyl,
    at(gx0, 0, 0, 0, -Math.PI / 2, 0),
  )
  W.seg('x', gz0, gx0, gx1)
  W.seg('x', gz1, gx0, gx1)
  W.seg('z', gx1, gz0, gz1)
  W.seg('z', gx0, gz0, -12.5)
  W.seg('z', gx0, -11.5, gz1)
  // 中の土と、トマトの2列。支柱に葉が付く
  flat(b, mats.soil, 0.006, gx0, gx1, gz0, gz1, 1)
  ;[-13.4, -10.6].forEach((z) => {
    for (let x = gx0 + 0.6; x < gx1 - 0.3; x += 0.5) {
      box(b, mats.rail, x - 0.01, x + 0.01, 0, 1.55, z - 0.01, z + 0.01)
      ;[0.45, 0.85, 1.25].forEach((y, k) => {
        c.plants.push([x + (k - 1) * 0.06, y, z + (k % 2) * 0.08 - 0.04, 0.2 + k * 0.02])
      })
    }
    W.rect(gx0 + 0.4, gx1 - 0.2, z - 0.25, z + 0.25)
  })
  c.floors.push({ x0: gx0, x1: gx1, z0: gz0, z1: gz1, h: 0, s: 'ground' })
  c.places.push({ name: 'ビニールハウス', x0: gx0, x1: gx1, z0: gz0, z1: gz1 })
}

/**
 * 木の柵。柱と、横に渡した2本の棒
 * @param axis - 'x' なら z = pos の線上を、'z' なら x = pos の線上を走る
 */
const rail = (c, axis, pos, from, to) => {
  const n = Math.max(1, Math.round((to - from) / 1.4))
  for (let i = 0; i <= n; i++) {
    c.W.post(axis, pos, from + ((to - from) * i) / n, 0.08, 1.3)
  }
  c.W.slab(c.mats.rail, axis, pos, from, to, 0.62, 0.7, 0.05)
  c.W.slab(c.mats.rail, axis, pos, from, to, 1.12, 1.2, 0.05)
}

/**
 * 道の向こうの牛・豚小屋。下はブロック、上は波板のトタン。北の半分に牛、南の半分に豚がいた
 */
const cowShed = (c) => {
  const { b, mats, W } = c
  const [x0, x1, z0, z1] = [34.6, 41.6, 0, 13]
  const eave = 2.8
  const rise = 1.5
  const over = 0.45
  const half = (x1 - x0) / 2 + over
  const top = eave + (over * rise) / half
  box(b, mats.concrete, x0, x1, 0, 0.08, z0, z1)
  c.floors.push({ x0, x1, z0, z1, h: 0.08, s: 'hard' })
  c.places.push({ name: '牛・豚小屋', x0, x1, z0, z1 })

  /**
   * 横の壁にあけた、ガラスの無い窓の並び
   */
  const vents = (list) => list.map(([from, to]) => ({ from, to, y0: 1.5, y1: 2.25 }))
  /**
   * 1面の壁。下はブロック、上はトタン
   * @param low - 下まで抜ける戸口
   * @param high - トタンの部分だけの窓
   */
  const face = (axis, pos, from, to, low, high) => {
    W.solid({ axis, at: pos, from, to, y0: 0, y1: 1.0, t: 0.15, mat: mats.block, holes: low })
    W.solid({
      axis,
      at: pos,
      from,
      to,
      y0: 1.0,
      y1: top,
      t: 0.05,
      mat: mats.metalBlue,
      holes: [...low, ...high],
      collide: false,
    })
  }
  const side = [
    [1.0, 2.6],
    [3.2, 4.8],
    [8.2, 9.8],
    [10.4, 12.0],
  ]
  face('z', x0, z0, z1, [{ from: 5.6, to: 7.4, y0: 0, y1: 2.4, door: true }], vents(side))
  face('z', x1, z0, z1, [], vents(side))
  face('x', z0, x0, x1, [], [])
  face('x', z1, x0, x1, [{ from: 37.4, to: 38.8, y0: 0, y1: 2.4, door: true }], [])
  gableEnd(b, mats.metalBlue, 'z', z0 - 0.03, x0, x1, top, rise - (over * rise) / half, -1)
  gableEnd(b, mats.metalBlue, 'z', z1 + 0.03, x0, x1, top, rise - (over * rise) / half, 1)
  gableRoof(b, mats.roofRust, x0 - over, x1 + over, z0 - over, z1 + over, eave, rise, 'z')

  // 牛の場所 (北)。木の柵と、通路ぞいのえさ箱
  rail(c, 'z', 37.4, z0 + 0.1, 5.6)
  rail(c, 'z', 38.8, z0 + 0.1, 6.5)
  rail(c, 'x', 2.8, x0 + 0.1, 37.4)
  rail(c, 'x', 5.6, x0 + 0.1, 37.4)
  rail(c, 'x', 2.2, 38.8, x1 - 0.1)
  rail(c, 'x', 4.4, 38.8, x1 - 0.1)
  box(b, mats.concrete, 36.95, 37.35, 0.08, 0.5, 0.2, 5.5)
  box(b, mats.concrete, 38.85, 39.25, 0.08, 0.5, 0.2, 6.4)
  // 豚の場所 (南)。ブロックの低い壁
  /**
   * 豚の場所の、ブロックの低い壁
   */
  const pen = (axis, pos, from, to) =>
    W.solid({
      axis,
      at: pos,
      from,
      to,
      y0: 0.08,
      y1: 0.95,
      t: 0.12,
      mat: mats.block,
      collide: false,
    })
  pen('z', 37.4, 7.4, z1 - 0.1)
  pen('x', 7.4, x0 + 0.1, 37.4)
  pen('x', 10.15, x0 + 0.1, 37.4)
  pen('z', 38.8, 6.5, z1 - 0.1)
  pen('x', 6.5, 38.8, x1 - 0.1)
  pen('x', 9.7, 38.8, x1 - 0.1)
  // 歩けるのは、南北の通路と、西の戸口からの短い通路だけ
  W.seg('z', 37.4, z0, 5.6)
  W.seg('z', 37.4, 7.4, z1)
  W.seg('z', 38.8, z0, z1)
  W.seg('x', 5.6, x0, 37.4)
  W.seg('x', 7.4, x0, 37.4)
  bulb(b, mats, c.fixtures, 38.1, 3.5, top + 0.2)
  bulb(b, mats, c.fixtures, 38.1, 9.5, top + 0.2)
}

/**
 * 道の西側の電柱と電線
 */
const poles = (c) => {
  const { b, mats } = c
  const x = 29.85
  const spots = []
  for (let z = -320; z <= 320; z += 32) {
    tube(b, mats.pole, v(x, -0.3, z), v(x, 9.4, z), 0.14)
    box(b, mats.pole, x - 0.85, x + 0.85, 8.55, 8.67, z - 0.06, z + 0.06)
    spots.push(z)
    if (Math.abs(z) < 80) {
      c.W.rect(x - 0.15, x + 0.15, z - 0.15, z + 0.15)
    }
  }
  const points = []
  const wires = [
    [-0.75, 8.7],
    [0.75, 8.7],
    [0, 9.35],
  ]
  for (let i = 0; i < spots.length - 1; i++) {
    wires.forEach(([dx, y]) => {
      const steps = 8
      for (let k = 0; k < steps; k++) {
        const t0 = k / steps
        const t1 = (k + 1) / steps
        const za = spots[i] + (spots[i + 1] - spots[i]) * t0
        const zb = spots[i] + (spots[i + 1] - spots[i]) * t1
        points.push(x + dx, y - 1.8 * t0 * (1 - t0), za, x + dx, y - 1.8 * t1 * (1 - t1), zb)
      }
    })
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(points, 3))
  c.root.add(new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x2b2b2b })))
}

/**
 * 敷地のまわりの林と、庭の大きな木。家や庭の物と重ならない所に置く
 */
const woods = (c) => {
  const rnd = seeded(20251)
  const keepOut = [
    [-4.6, 10.6, -6.4, 10.0],
    [-6.4, 2.8, -13.7, -4.5],
    [1.8, 9.1, -13.2, -5.4],
    [8.2, 17.3, -13.7, -4.5],
    [9.2, 14.8, 12.2, 18.8],
    [16.2, 26.8, -15.3, -8.7],
    [16.4, 26.6, -1.2, 9.6],
    [18.0, 25.0, 12.0, 18.0],
    [10.0, 30.0, -4.2, -0.4],
  ]
  /**
   * 家や庭の物と重なるか
   */
  const blocked = (x, z) => keepOut.some(([x0, x1, z0, z1]) => x > x0 && x < x1 && z > z0 && z < z1)
  /**
   * 範囲の中に、木を n 本ちらす
   * @param cedar - 杉にする割合。0 から 1
   */
  const scatter = (x0, x1, z0, z1, n, cedar) => {
    let placed = 0
    let tries = 0
    while (placed < n && tries < n * 40) {
      tries += 1
      const x = x0 + rnd() * (x1 - x0)
      const z = z0 + rnd() * (z1 - z0)
      if (blocked(x, z)) continue
      if (c.trees.some((t) => Math.hypot(t.x - x, t.z - z) < 2.3)) continue
      c.trees.push({ x, z, cedar: rnd() < cedar })
      placed += 1
    }
  }
  scatter(-21, 7, 11.5, 27.5, 30, 0.8)
  scatter(-21, -7, -19.5, 11.5, 18, 0.5)
  scatter(-21, 27, -19.8, -14.4, 18, 0.5)
  scatter(8, 28, 19.5, 27.5, 8, 0.3)
  c.trees.push({ x: 13.6, z: 4.8, cedar: false, big: true })
  c.trees.forEach((t) => {
    const r = t.big ? 0.45 : 0.25
    c.W.rect(t.x - r, t.x + r, t.z - r, t.z + r)
  })
  c.places.push({ name: '林', x0: -22, x1: 8, z0: 11, z1: 28 })
}

/**
 * 遠くの家。屋敷林 (家を囲む杉) と一緒に、田んぼのあちこちに建つ
 */
const farmsteads = (c) => {
  const { b, mats } = c
  const rnd = seeded(777)
  let made = 0
  let tries = 0
  while (made < 24 && tries < 400) {
    tries += 1
    const d = 150 + rnd() * 850
    const a = rnd() * Math.PI * 2
    const x = Math.cos(a) * d
    const z = Math.sin(a) * d
    if (Math.abs(x - 31.8) < 30) continue
    const w = 7 + rnd() * 3
    const l = 11 + rnd() * 4
    const along = rnd() < 0.5
    const [hx, hz] = along ? [l, w] : [w, l]
    const wall = rnd() < 0.7 ? mats.farWall : mats.farWhite
    const roofMat = mats.farRoofs[Math.floor(rnd() * mats.farRoofs.length)]
    const halfRoof = (along ? hz : hx) / 2 + 0.5
    const slope = 2.6 / halfRoof
    const top = 4.2 + 0.5 * slope
    box(b, wall, x - hx / 2, x + hx / 2, PADDY, top, z - hz / 2, z + hz / 2)
    gableRoof(
      b,
      roofMat,
      x - hx / 2 - 0.5,
      x + hx / 2 + 0.5,
      z - hz / 2 - 0.5,
      z + hz / 2 + 0.5,
      4.2,
      2.6,
      along ? 'x' : 'z',
    )
    if (along) {
      gableEnd(b, wall, 'x', x - hx / 2, z - hz / 2, z + hz / 2, top, 2.6 - 0.5 * slope, -1)
      gableEnd(b, wall, 'x', x + hx / 2, z - hz / 2, z + hz / 2, top, 2.6 - 0.5 * slope, 1)
    } else {
      gableEnd(b, wall, 'z', z - hz / 2, x - hx / 2, x + hx / 2, top, 2.6 - 0.5 * slope, -1)
      gableEnd(b, wall, 'z', z + hz / 2, x - hx / 2, x + hx / 2, top, 2.6 - 0.5 * slope, 1)
    }
    // 納屋
    box(b, mats.farWall, x + hx / 2 + 3, x + hx / 2 + 8, PADDY, 3.4, z - 3, z + 4)
    gableRoof(b, roofMat, x + hx / 2 + 2.6, x + hx / 2 + 8.4, z - 3.4, z + 4.4, 3.4, 1.4, 'z')
    // 屋敷林。家の西と北に多い
    for (let k = 0; k < 10; k++) {
      const ta = rnd() * Math.PI * 2
      const tr = 10 + rnd() * 7
      if (Math.cos(ta) > 0.2 && Math.sin(ta) > 0.2) continue
      c.trees.push({
        x: x + Math.cos(ta) * tr,
        z: z + Math.sin(ta) * tr,
        cedar: rnd() < 0.85,
        base: PADDY,
      })
    }
    made += 1
  }
}

/**
 * 遠くの山。西は高い山並み、東は低い山。霧でかすむ
 */
const mountains = (c) => {
  const rnd = seeded(99)
  const ph = [rnd() * 6, rnd() * 6, rnd() * 6]
  /**
   * 向き t (ラジアン) の山の高さ
   * @param far - 遠くの高い山並みか
   */
  const heightAt = (t, far) => {
    const n =
      0.5 +
      0.25 * Math.sin(3 * t + ph[0]) +
      0.15 * Math.sin(7 * t + ph[1]) +
      0.1 * Math.sin(13 * t + ph[2])
    const west = Math.max(0, -Math.cos(t))
    return far ? 160 + 260 * n + 700 * west * west : 40 + 90 * n * (1 - west)
  }
  /**
   * まわりを円く囲む、山の帯を作る
   */
  const ring = (radius, far, color) => {
    const n = 240
    const pos = []
    for (let i = 0; i < n; i++) {
      const t0 = (i / n) * Math.PI * 2
      const t1 = ((i + 1) / n) * Math.PI * 2
      const h0 = heightAt(t0, far)
      const h1 = heightAt(t1, far)
      const ax = Math.cos(t0) * radius
      const az = Math.sin(t0) * radius
      const bx = Math.cos(t1) * radius
      const bz = Math.sin(t1) * radius
      pos.push(ax, -30, az, bx, -30, bz, bx, h1, bz, ax, -30, az, bx, h1, bz, ax, h0, az)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    c.root.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide })))
  }
  ring(3300, true, 0x6f8090)
  ring(2000, false, 0x56645a)
}

/**
 * 歩ける範囲の外側。北は用水路の手前まで、ほかは田んぼの中まで。道だけは、北と南へ遠くまで歩ける
 */
const bounds = (c) => {
  /**
   * 見えない壁を1本足す
   */
  const add = (ax, az, bx, bz) => c.walls.push({ ax, az, bx, bz })
  add(-30, -20.3, ROAD_W, -20.3)
  add(ROAD_E, -20.3, 55, -20.3)
  add(-30, 45, ROAD_W, 45)
  add(ROAD_E, 45, 55, 45)
  add(-30, -20.3, -30, 45)
  add(55, -20.3, 55, 45)
  add(ROAD_W, -20.3, ROAD_W, -160)
  add(ROAD_E, -20.3, ROAD_E, -160)
  add(ROAD_W, -160, ROAD_E, -160)
  add(ROAD_W, 45, ROAD_W, 160)
  add(ROAD_E, 45, ROAD_E, 160)
  add(ROAD_W, 160, ROAD_E, 160)
}

/**
 * 木を、幹・杉の葉・広葉樹の葉の3つのまとまりで描く。同じ形を何本も描くので、まとめて1回で描く
 */
const plantTrees = (c) => {
  const rnd = seeded(4242)
  const trunkGeo = new THREE.CylinderGeometry(0.5, 0.62, 1, 7).translate(0, 0.5, 0)
  const coneGeo = new THREE.ConeGeometry(1, 1, 8)
  const blobGeo = new THREE.IcosahedronGeometry(1, 1)
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3a2c, roughness: 0.95 })
  const needleMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.95,
    flatShading: true,
  })
  const leafMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.9,
    flatShading: true,
  })
  const cedars = c.trees.filter((t) => t.cedar).length
  const broads = c.trees.length - cedars
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, c.trees.length)
  const cones = new THREE.InstancedMesh(coneGeo, needleMat, cedars * 3)
  const blobs = new THREE.InstancedMesh(blobGeo, leafMat, broads * 5)
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const p = new THREE.Vector3()
  const s = new THREE.Vector3()
  const col = new THREE.Color()
  let ci = 0
  let bi = 0
  c.trees.forEach((t, i) => {
    const base = t.base ?? 0
    let h = 7 + rnd() * 5
    if (t.big) {
      h = 13
    } else if (t.cedar) {
      h = 12 + rnd() * 8
    }
    const r = t.big ? 0.42 : 0.15 + rnd() * 0.1
    m.compose(
      p.set(t.x, base, t.z),
      q.identity(),
      s.set(r * 2, t.cedar ? h * 0.75 : h * 0.55, r * 2),
    )
    trunks.setMatrixAt(i, m)
    if (t.cedar) {
      ;[
        [0.5, 0.4, 0.12],
        [0.66, 0.36, 0.095],
        [0.83, 0.34, 0.065],
      ].forEach(([cy, ch, cr]) => {
        m.compose(
          p.set(t.x, base + cy * h, t.z),
          q.setFromAxisAngle(Y, rnd() * 6),
          s.set(cr * h, ch * h, cr * h),
        )
        cones.setMatrixAt(ci, m)
        cones.setColorAt(ci, col.setHSL(0.28 + rnd() * 0.04, 0.3, 0.16 + rnd() * 0.05))
        ci += 1
      })
      return
    }
    const spread = h * (t.big ? 0.26 : 0.2)
    for (let k = 0; k < 5; k++) {
      const br = h * (0.18 + rnd() * 0.1)
      m.compose(
        p.set(
          t.x + (rnd() - 0.5) * spread * 2,
          base + h * (0.58 + rnd() * 0.28),
          t.z + (rnd() - 0.5) * spread * 2,
        ),
        q.identity(),
        s.set(br, br * 0.85, br),
      )
      blobs.setMatrixAt(bi, m)
      blobs.setColorAt(bi, col.setHSL(0.17 + rnd() * 0.07, 0.34 + rnd() * 0.1, 0.22 + rnd() * 0.08))
      bi += 1
    }
  })
  ;[trunks, cones, blobs].forEach((mesh) => {
    mesh.castShadow = true
    mesh.receiveShadow = true
    c.root.add(mesh)
  })
}

/**
 * 畑とビニールハウスの野菜の葉を、まとめて描く
 */
const plantCrops = (c) => {
  const mat = new THREE.MeshStandardMaterial({ color: 0x55722e, roughness: 0.9, flatShading: true })
  const mesh = new THREE.InstancedMesh(LEAF, mat, c.plants.length)
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const p = new THREE.Vector3()
  const s = new THREE.Vector3()
  c.plants.forEach(([x, y, z, r], i) => {
    m.compose(p.set(x, y, z), q.setFromAxisAngle(Y, i * 1.7), s.set(r, r * 0.8, r))
    mesh.setMatrixAt(i, m)
  })
  mesh.castShadow = true
  mesh.receiveShadow = true
  c.root.add(mesh)
}
