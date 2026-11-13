import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import {
  asphaltTexture,
  binTexture,
  blockTexture,
  ceilingTexture,
  clockFace,
  clothTexture,
  coinPanelTexture,
  corrugatedTexture,
  concreteTexture,
  doorLeafTexture,
  edgeDirtTexture,
  exitTexture,
  floorSign,
  floorTexture,
  flooringTexture,
  frostedTexture,
  houseFacade,
  hedgeTexture,
  labelTexture,
  mailboxTexture,
  meshTexture,
  meterBoxTexture,
  nameSignTexture,
  noticePaper,
  paverTexture,
  plateAtlas,
  roofWarnTexture,
  sidingTexture,
  signTexture,
  steelDoorTexture,
  streakTexture,
  stoneTileTexture,
  tileTexture,
  vendingAdTexture,
  vendingTexture,
  waterStainTexture,
  wallTexture,
  wireGlassTexture,
} from './textures.js'

// 4階建ての外廊下のマンション。単位は m
// x は東西 (東が +)、z は南北 (南の道路側が +)、y は高さ。1階の床が y = 0
// 西の端に階段室 (x 0 ~ 2.8)、その東にエレベーターホール (x 2.8 ~ 7)、その東に各階12戸が並ぶ外廊下
export const FH = 2.9
export const HALF = FH / 2
export const FLOORS = 4
export const UNITS = 12
const CEIL = 2.5
const STEPS = 8
const RISE = HALF / STEPS
const LAND_Z = -1.5
const MID_Z = -3.6
const BACK_Z = -4.8
const SX0 = 0.2
const SX1 = 2.8
const DIV0 = 1.45
const DIV1 = 1.55
const HX1 = 7
const UNIT = 3.2
const CX1 = HX1 + UNIT * UNITS
const CZ = -1.4
const FRONT = 0.15
const DOORWAY = [-1.3, -0.3]

/**
 * f 階の床の高さ
 */
export const floorY = (f) => (f - 1) * FH

/**
 * f 階の i 番目 (西から0始まり) の部屋のドアの中心の x
 */
export const doorX = (i) => HX1 + UNIT * i + 0.75

/**
 * f + 1 階の踊り場から f 階の踊り場まで、階段を下りる道すじ。人を歩かせるのに使う
 */
export const descentPath = (f) => {
  const y = floorY(f)
  const wx = (SX0 + DIV0) / 2
  const ex = (DIV1 + SX1) / 2
  const mz = (BACK_Z + MID_Z) / 2
  return [
    new THREE.Vector3(wx, y + FH, -0.9),
    new THREE.Vector3(wx, y + FH, LAND_Z),
    new THREE.Vector3(wx, y + HALF, MID_Z),
    new THREE.Vector3(wx, y + HALF, mz),
    new THREE.Vector3(ex, y + HALF, mz),
    new THREE.Vector3(ex, y + HALF, MID_Z),
    new THREE.Vector3(ex, y, LAND_Z),
    new THREE.Vector3(ex, y, -0.9),
  ]
}

// 412号室の玄関と廊下が入る範囲。西の壁、玄関の東の壁、突き当たりの壁、玄関ドアのある壁
const HOME_X = doorX(UNITS - 1)
const ROOM = { x0: HOME_X - 0.5, x1: HOME_X + 1.0, z0: CZ - 5.2, z1: CZ - 0.2 }

/**
 * 区画を作る。足元の高さを返す関数 h を持つ
 */
const zone = (tag, x0, x1, z0, z1, h) => ({ tag, x0, x1, z0, z1, h, on: true })

/**
 * 同じ形の物をまとめて1つにして、描く回数を減らす。壁や床のテクスチャは、置いた場所の座標で貼る
 */
const makeBuilder = () => {
  const parts = new Map()

  /**
   * 形を1つ足す。material.userData.tile があれば、その長さ (m) ごとにテクスチャを繰り返す
   */
  const add = (geometry, material, matrix) => {
    const g = geometry.index ? geometry.toNonIndexed() : geometry.clone()
    g.applyMatrix4(matrix)
    if (material.userData.tile) worldUV(g, material.userData.tile)
    if (!parts.has(material)) parts.set(material, [])
    parts.get(material).push(g)
  }

  /**
   * まとめた形を、マテリアルごとに1つのメッシュにして parent に足す
   */
  const build = (parent) => {
    parts.forEach((list, material) => {
      const mesh = new THREE.Mesh(mergeGeometries(list), material)
      mesh.receiveShadow = true
      mesh.matrixAutoUpdate = false
      parent.add(mesh)
    })
  }

  return { add, build }
}

/**
 * 面の向きに合わせて、置いた場所の座標から UV を作り直す
 */
const worldUV = (g, tile) => {
  const pos = g.attributes.position
  const nor = g.attributes.normal
  const uv = g.attributes.uv
  for (let i = 0; i < pos.count; i++) {
    const ax = Math.abs(nor.getX(i))
    const ay = Math.abs(nor.getY(i))
    const az = Math.abs(nor.getZ(i))
    let u = pos.getX(i)
    let v = pos.getY(i)
    if (ay >= ax && ay >= az) {
      v = pos.getZ(i)
    } else if (ax >= az) {
      u = pos.getZ(i)
    }
    uv.setXY(i, u / tile, v / tile)
  }
  uv.needsUpdate = true
}

const M = new THREE.Matrix4()
const Q = new THREE.Quaternion()
const E = new THREE.Euler()
const V = new THREE.Vector3()
const ONE = new THREE.Vector3(1, 1, 1)

/**
 * 置く場所と向きの行列を作る
 */
const at = (x, y, z, rx = 0, ry = 0, rz = 0) =>
  M.compose(V.set(x, y, z), Q.setFromEuler(E.set(rx, ry, rz)), ONE)

/**
 * 角の座標で箱を置く
 */
const box = (b, mat, x0, x1, y0, y1, z0, z1) => {
  b.add(
    new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0),
    mat,
    at((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2),
  )
}

/**
 * 箱から、中の直方体の部分をくり抜いて置く。くり抜いた穴の内側の面は描かないので、中から見る壁は別に置く
 * @param outer - 箱の [x0, x1, y0, y1, z0, z1]
 * @param hole - くり抜く部分の [x0, x1, y0, y1, z0, z1]。x と y は箱の内側にあること
 */
const boxWithout = (b, mat, outer, hole) => {
  const [x0, x1, y0, y1, z0, z1] = outer
  const [hx0, hx1, hy0, hy1, hz0, hz1] = hole
  const cz0 = Math.max(z0, hz0)
  const cz1 = Math.min(z1, hz1)
  if (cz0 >= cz1) {
    box(b, mat, x0, x1, y0, y1, z0, z1)
    return
  }
  box(b, mat, x0, hx0, y0, y1, z0, z1)
  box(b, mat, hx1, x1, y0, y1, z0, z1)
  box(b, mat, hx0, hx1, y0, hy0, z0, z1)
  box(b, mat, hx0, hx1, hy1, y1, z0, z1)
  if (z0 < cz0) box(b, mat, hx0, hx1, hy0, hy1, z0, cz0)
  if (cz1 < z1) box(b, mat, hx0, hx1, hy0, hy1, cz1, z1)
}

/**
 * x が一定の壁の面を置く
 * @param dir - +x を向くなら 1、-x を向くなら -1
 */
const wallX = (b, mat, x, z0, z1, y0, y1, dir) => {
  b.add(
    new THREE.PlaneGeometry(z1 - z0, y1 - y0),
    mat,
    at(x, (y0 + y1) / 2, (z0 + z1) / 2, 0, (dir * Math.PI) / 2),
  )
}

/**
 * z が一定の壁の面を置く
 * @param dir - +z を向くなら 1、-z を向くなら -1
 */
const wallZ = (b, mat, z, x0, x1, y0, y1, dir) => {
  b.add(
    new THREE.PlaneGeometry(x1 - x0, y1 - y0),
    mat,
    at((x0 + x1) / 2, (y0 + y1) / 2, z, 0, dir > 0 ? 0 : Math.PI),
  )
}

/**
 * 床 (上向き) か天井 (下向き) の面を置く
 * @param dir - 上を向くなら 1、下を向くなら -1
 */
const flat = (b, mat, y, x0, x1, z0, z1, dir) => {
  b.add(
    new THREE.PlaneGeometry(x1 - x0, z1 - z0),
    mat,
    at((x0 + x1) / 2, y, (z0 + z1) / 2, (-dir * Math.PI) / 2),
  )
}

// 鎖の輪。向きを90度ずつ変えて、交互につなぐ
const LINK_A = new THREE.TorusGeometry(0.009, 0.0025, 5, 10).scale(1.5, 1, 1)
const LINK_B = LINK_A.clone().rotateX(Math.PI / 2)
const X_AXIS = new THREE.Vector3(1, 0, 0)

/**
 * 輪を1つ、中心の点と、つながる向きで置く
 */
const link = (b, mat, k, center, dir) => {
  Q.setFromUnitVectors(X_AXIS, dir)
  b.add(k % 2 ? LINK_B : LINK_A, mat, M.compose(center, Q, ONE))
}

/**
 * 2点の間に、たるんだ鎖を下げる
 * @param sag - 真ん中で、まっすぐな線から下がる長さ (m)
 */
const chain = (b, mat, from, to, sag) => {
  const n = Math.max(2, Math.round(from.distanceTo(to) / 0.022))
  const point = (t) => {
    const p = new THREE.Vector3().lerpVectors(from, to, t)
    p.y -= sag * 4 * t * (1 - t)
    return p
  }
  for (let k = 0; k < n; k++) {
    const p0 = point(k / n)
    const p1 = point((k + 1) / n)
    const dir = p1.clone().sub(p0).normalize()
    link(b, mat, k, p0.add(p1).multiplyScalar(0.5), dir)
  }
}

const Y_AXIS = new THREE.Vector3(0, 1, 0)

/**
 * 2点を結ぶ細い管を置く
 */
const tube = (b, mat, p0, p1, r = 0.012) => {
  const d = new THREE.Vector3().subVectors(p1, p0)
  const len = d.length()
  Q.setFromUnitVectors(Y_AXIS, d.divideScalar(len))
  const mid = new THREE.Vector3().addVectors(p0, p1).multiplyScalar(0.5)
  b.add(new THREE.CylinderGeometry(r, r, len, 6), mat, M.compose(mid, Q, ONE))
}

/**
 * 切妻の屋根を、2枚の板で置く。棟は x の向き
 * @param y - 軒の高さ
 * @param rise - 軒から棟までの高さ
 */
const gable = (b, mat, x0, x1, z0, z1, y, rise) => {
  const half = (z1 - z0) / 2
  const len = Math.hypot(half, rise) + 0.05
  const a = Math.atan2(rise, half)
  const roof = new THREE.BoxGeometry(x1 - x0, 0.1, len)
  b.add(roof, mat, at((x0 + x1) / 2, y + rise / 2, z1 - half / 2, a))
  b.add(roof, mat, at((x0 + x1) / 2, y + rise / 2, z0 + half / 2, -a))
}

/**
 * 切妻の妻側の三角の壁
 * @param dir - 外を向く向き。+x なら 1、-x なら -1
 */
const gableEnd = (b, mat, x, z0, z1, y, rise, dir) => {
  const zm = (z0 + z1) / 2
  const [za, zb] = dir > 0 ? [z1, z0] : [z0, z1]
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, za, 0, 0, zb, 0, rise, zm], 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute([dir, 0, 0, dir, 0, 0, dir, 0, 0], 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0.5, 1], 2))
  b.add(g, mat, at(x, y, 0))
}

/**
 * 繰り返し貼るテクスチャのマテリアル
 * @param tile - テクスチャ1枚の長さ (m)
 */
const tiled = (map, tile, opts = {}) => {
  const m = new THREE.MeshStandardMaterial({ map, roughness: 0.9, ...opts })
  m.userData.tile = tile
  return m
}

/**
 * 建物と、そのまわりの道路を作る
 */
export const buildBuilding = (scene) => {
  const root = new THREE.Group()
  scene.add(root)
  const b = makeBuilder()

  const mat = {
    paint: tiled(wallTexture(), 2.0),
    tile: tiled(tileTexture(), 1.2),
    concrete: tiled(concreteTexture(), 1.5),
    sheet: tiled(floorTexture(), 2.0, { roughness: 0.6 }),
    stone: tiled(stoneTileTexture(), 1.2, { roughness: 0.4 }),
    ceiling: tiled(ceilingTexture(), 2.0, { roughness: 1 }),
    asphalt: tiled(asphaltTexture(), 3.0),
    paver: tiled(paverTexture(), 1.0),
    hedge: tiled(hedgeTexture(), 0.8, { roughness: 1 }),
    ground: new THREE.MeshStandardMaterial({ color: 0x17181b, roughness: 1 }),
    trim: new THREE.MeshStandardMaterial({ color: 0x4a4038, roughness: 0.6, metalness: 0.2 }),
    alum: new THREE.MeshStandardMaterial({ color: 0xaaa79f, roughness: 0.45, metalness: 0.4 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x8e8a82, roughness: 0.55, metalness: 0.3 }),
    stainless: new THREE.MeshStandardMaterial({ color: 0xb8b8b4, roughness: 0.3, metalness: 0.7 }),
    white: new THREE.MeshStandardMaterial({ color: 0xe2e0da, roughness: 0.6 }),
    guard: new THREE.MeshStandardMaterial({ color: 0xd8d8d4, roughness: 0.5 }),
    pole: new THREE.MeshStandardMaterial({ color: 0x77766f, roughness: 0.9 }),
    wire: new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x232327, roughness: 0.9 }),
    nosing: new THREE.MeshStandardMaterial({ color: 0x2b2a28, roughness: 0.8 }),
    red: new THREE.MeshStandardMaterial({ color: 0xa8211b, roughness: 0.6 }),
    black: new THREE.MeshBasicMaterial({ color: 0x000000 }),
    meter: new THREE.MeshStandardMaterial({ map: meterBoxTexture(), roughness: 0.7 }),
    mailbox: new THREE.MeshStandardMaterial({ map: mailboxTexture(), roughness: 0.6 }),
    exit: new THREE.MeshBasicMaterial({ map: exitTexture() }),
    vending: new THREE.MeshBasicMaterial({ map: vendingTexture() }),
    vendAd: new THREE.MeshBasicMaterial({ map: vendingAdTexture(), color: 0xb8b8b8 }),
    vendCoin: new THREE.MeshStandardMaterial({
      map: coinPanelTexture(),
      roughness: 0.4,
      metalness: 0.4,
    }),
    vendBody: new THREE.MeshStandardMaterial({ color: 0xd2d5d8, roughness: 0.45, metalness: 0.3 }),
    vendHeader: new THREE.MeshBasicMaterial({ color: 0xdde8f2 }),
    flap: new THREE.MeshStandardMaterial({
      color: 0x1d2024,
      roughness: 0.2,
      transparent: true,
      opacity: 0.85,
    }),
    binBody: new THREE.MeshStandardMaterial({ color: 0xcfcdc5, roughness: 0.65 }),
    binCan: new THREE.MeshStandardMaterial({
      map: binTexture('空き缶', '#2b6fb8'),
      roughness: 0.6,
    }),
    binPet: new THREE.MeshStandardMaterial({
      map: binTexture('ペットボトル', '#2f8a4a'),
      roughness: 0.6,
    }),
    nameSign: new THREE.MeshStandardMaterial({
      map: nameSignTexture(),
      roughness: 0.4,
      metalness: 0.3,
    }),
    block: tiled(blockTexture(), 0.8),
    roofTile: new THREE.MeshStandardMaterial({ color: 0x33373c, roughness: 0.8 }),
    roofSheet: tiled(corrugatedTexture(), 1.0, { roughness: 0.6, metalness: 0.3 }),
    post: new THREE.MeshStandardMaterial({ color: 0x7f8481, roughness: 0.6, metalness: 0.4 }),
    tire: new THREE.MeshStandardMaterial({ color: 0x161617, roughness: 0.9 }),
    saddle: new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.5 }),
    basket: new THREE.MeshStandardMaterial({
      map: meshTexture(),
      alphaTest: 0.5,
      side: THREE.DoubleSide,
      metalness: 0.5,
      roughness: 0.4,
    }),
    tubeGlow: new THREE.MeshBasicMaterial({ color: 0xeef4ff }),
    streak: new THREE.MeshStandardMaterial({
      map: streakTexture(),
      transparent: true,
      depthWrite: false,
      roughness: 1,
    }),
    edgeDirt: new THREE.MeshStandardMaterial({
      map: edgeDirtTexture(),
      transparent: true,
      depthWrite: false,
      roughness: 1,
    }),
    waterStain: new THREE.MeshStandardMaterial({
      map: waterStainTexture(),
      transparent: true,
      depthWrite: false,
      roughness: 1,
    }),
    glass: new THREE.MeshStandardMaterial({
      color: 0x7f8c98,
      roughness: 0.05,
      metalness: 0.6,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
    }),
    door: new THREE.MeshStandardMaterial({
      map: doorLeafTexture(),
      roughness: 0.55,
      metalness: 0.15,
    }),
    doorEdge: new THREE.MeshStandardMaterial({ color: 0x3a3029, roughness: 0.6 }),
    roofDoor: new THREE.MeshStandardMaterial({
      map: steelDoorTexture(),
      roughness: 0.62,
      metalness: 0.2,
    }),
    roofFrame: new THREE.MeshStandardMaterial({ color: 0x59625c, roughness: 0.6, metalness: 0.25 }),
    roofWarn: new THREE.MeshStandardMaterial({ map: roofWarnTexture(), roughness: 0.5 }),
    brass: new THREE.MeshStandardMaterial({ color: 0x9c7d3a, roughness: 0.35, metalness: 0.8 }),
    cone: new THREE.MeshStandardMaterial({ color: 0xb02a1f, roughness: 0.55 }),
    cloth: tiled(clothTexture(), 0.9, { roughness: 0.95 }),
    flooring: tiled(flooringTexture(), 1.2, { roughness: 0.45 }),
    woodTrim: new THREE.MeshStandardMaterial({ color: 0x5b4430, roughness: 0.55 }),
    inDoor: new THREE.MeshStandardMaterial({ color: 0xa08665, roughness: 0.55 }),
    cabinet: new THREE.MeshStandardMaterial({ color: 0x6b5440, roughness: 0.6 }),
    slipper: new THREE.MeshStandardMaterial({ color: 0x7d6f69, roughness: 0.9 }),
  }
  const sidings = ['#8a8274', '#6f7478', '#9a8b74', '#7a6f66'].map((c) =>
    tiled(sidingTexture(c), 2.0),
  )
  const facades = [0, 1, 2, 3, 4, 5].map((seed) => {
    const { map, glow } = houseFacade(seed)
    return new THREE.MeshStandardMaterial({
      map,
      emissiveMap: glow,
      emissive: 0xc8c8c8,
      roughness: 0.85,
    })
  })
  const frames = [0xb9bcc0, 0x2a2b2d, 0xd9d9d6, 0x8e2a24, 0x2c4f7c, 0x7f9c86].map(
    (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.5 }),
  )
  const plates = [1, 2, 3, 4].map(
    (f) => new THREE.MeshStandardMaterial({ map: plateAtlas(f), roughness: 0.5 }),
  )
  const frosted = {
    dark: new THREE.MeshStandardMaterial({ map: frostedTexture('dark'), roughness: 0.3 }),
    lit: new THREE.MeshBasicMaterial({ map: frostedTexture('lit') }),
    peek: new THREE.MeshBasicMaterial({ map: frostedTexture('peek') }),
  }
  const wire = {
    plain: new THREE.MeshStandardMaterial({
      map: wireGlassTexture(false),
      roughness: 0.3,
      emissive: 0x0b0e14,
    }),
    peek: new THREE.MeshStandardMaterial({
      map: wireGlassTexture(true),
      roughness: 0.3,
      emissive: 0x0b0e14,
    }),
  }

  const zones = []
  const fixtures = []
  const doors = []
  const windows = []
  const signs = []
  const fireDoors = []

  /**
   * 明かりを1つ置く。光る部分は glow で、実際に照らす光は近いものだけ後で割り当てる
   */
  const fixture = (x, y, z, color, power, dist, glow) => {
    const f = {
      pos: new THREE.Vector3(x, y, z),
      color: new THREE.Color(color),
      power,
      dist,
      glow,
      base: glow ? glow.material.color.clone() : null,
      on: true,
      level: 1,
      stutter: 0,
      faulty: false,
    }
    fixtures.push(f)
    return f
  }

  /**
   * 天井の丸い照明を置く
   */
  const ceilingLight = (x, y, z, color, power, dist) => {
    b.add(new THREE.CylinderGeometry(0.17, 0.17, 0.06, 20), mat.white, at(x, y - 0.03, z))
    const glow = new THREE.Mesh(
      new THREE.CircleGeometry(0.15, 20),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(1.6) }),
    )
    glow.position.set(x, y - 0.062, z)
    glow.rotation.x = Math.PI / 2
    root.add(glow)
    return fixture(x, y - 0.25, z, color, power, dist, glow)
  }

  /**
   * 壁付けの照明を置く。(x, z) は壁の上の点、(dx, dz) は壁から部屋へ出る向き
   */
  const wallLight = (x, y, z, dx, dz, color, power, dist) => {
    b.add(new THREE.BoxGeometry(0.26, 0.16, 0.16), mat.steel, at(x + dx * 0.08, y, z + dz * 0.08))
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 14, 10),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(1.5) }),
    )
    glow.position.set(x + dx * 0.17, y, z + dz * 0.17)
    glow.scale.set(1, 0.6, 1)
    root.add(glow)
    return fixture(x + dx * 0.45, y - 0.1, z + dz * 0.45, color, power, dist, glow)
  }

  /**
   * 開き戸を1枚作る。正面は +z、ちょうつがいは左。開く時は hinge.rotation.y をマイナスにする
   */
  const makeLeaf = (w, h) => {
    const group = new THREE.Group()
    const hinge = new THREE.Group()
    hinge.position.x = -w / 2
    group.add(hinge)
    const e = mat.doorEdge
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.045), [e, e, e, e, mat.door, e])
    leaf.position.set(w / 2, h / 2, 0)
    leaf.receiveShadow = true
    const lever = new THREE.Group()
    lever.position.set(w - 0.12, 1.0, 0.04)
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.022, 0.022), mat.stainless)
    bar.position.x = -0.05
    lever.add(bar)
    hinge.add(leaf, lever)
    return { group, hinge, lever }
  }

  /**
   * 屋上へ出る鉄の扉。段を1つ上がった先にあり、レバーに鎖が巻かれて南京錠で留めてある
   * @param y - 屋上の階の床の高さ
   */
  const roofDoor = (y) => {
    const [z0, z1] = DOORWAY
    // 扉の前の段と、扉の下の沓摺り
    box(b, mat.concrete, SX1 - 0.24, SX1 + 0.12, y, y + 0.18, z0 - 0.02, z1 + 0.02)
    box(b, mat.nosing, SX1 - 0.245, SX1 - 0.19, y + 0.17, y + 0.186, z0 - 0.02, z1 + 0.02)
    box(b, mat.stainless, SX1 - 0.005, SX1 + 0.11, y + 0.18, y + 0.195, z0 + 0.03, z1 - 0.03)
    // 枠。奥は黒くふさいで、すき間から外が見えないようにする
    box(b, mat.roofFrame, SX1 - 0.025, SX1 + 0.12, y + 0.18, y + 2.1, z0, z0 + 0.05)
    box(b, mat.roofFrame, SX1 - 0.025, SX1 + 0.12, y + 0.18, y + 2.1, z1 - 0.05, z1)
    box(b, mat.roofFrame, SX1 - 0.025, SX1 + 0.12, y + 2.05, y + 2.1, z0, z1)
    wallX(b, mat.black, SX1 + 0.11, z0, z1, y + 0.18, y + 2.1, -1)
    // 扉。ちょうつがいは北 (z0) の側
    box(b, mat.roofDoor, SX1 + 0.035, SX1 + 0.075, y + 0.198, y + 2.047, z0 + 0.052, z1 - 0.052)
    // レバーハンドルとサムターン
    const hz = z1 - 0.15
    box(b, mat.stainless, SX1 + 0.025, SX1 + 0.035, y + 0.92, y + 1.2, hz - 0.025, hz + 0.025)
    box(b, mat.stainless, SX1 - 0.025, SX1 + 0.025, y + 1.03, y + 1.055, hz - 0.012, hz + 0.012)
    box(b, mat.stainless, SX1 - 0.042, SX1 - 0.02, y + 1.03, y + 1.055, hz - 0.15, hz + 0.012)
    b.add(
      new THREE.CylinderGeometry(0.018, 0.018, 0.01, 16),
      mat.stainless,
      at(SX1 + 0.022, y + 1.15, hz, 0, 0, Math.PI / 2),
    )
    box(b, mat.stainless, SX1 + 0.002, SX1 + 0.017, y + 1.13, y + 1.17, hz - 0.005, hz + 0.005)
    // ドアクローザー
    box(b, mat.alum, SX1 - 0.03, SX1 + 0.035, y + 1.92, y + 1.99, z0 + 0.1, z0 + 0.38)
    box(b, mat.alum, SX1 - 0.045, SX1 - 0.03, y + 1.95, y + 1.965, z0 + 0.34, z0 + 0.62)
    box(b, mat.alum, SX1 - 0.05, SX1 - 0.025, y + 1.95, y + 2.05, z0 + 0.6, z0 + 0.66)
    // 壁のアイボルト。レバーに巻いた鎖をここまで引いて、南京錠で留める
    const eye = new THREE.Vector3(SX1 - 0.02, y + 1.0, z1 + 0.1)
    box(
      b,
      mat.stainless,
      SX1 - 0.004,
      SX1,
      eye.y - 0.025,
      eye.y + 0.025,
      eye.z - 0.025,
      eye.z + 0.025,
    )
    b.add(new THREE.TorusGeometry(0.016, 0.0035, 6, 14), mat.stainless, at(eye.x, eye.y, eye.z))
    const wrap = new THREE.Vector3(SX1 - 0.031, y + 1.0425, hz - 0.09)
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2
      const p = new THREE.Vector3(Math.cos(a), Math.sin(a), 0).multiplyScalar(0.022).add(wrap)
      link(b, mat.stainless, k, p, new THREE.Vector3(-Math.sin(a), Math.cos(a), 0))
    }
    chain(
      b,
      mat.stainless,
      new THREE.Vector3(wrap.x, wrap.y - 0.024, wrap.z),
      new THREE.Vector3(eye.x, eye.y - 0.016, eye.z),
      0.07,
    )
    box(
      b,
      mat.brass,
      SX1 - 0.04,
      SX1 - 0.018,
      eye.y - 0.1,
      eye.y - 0.048,
      eye.z - 0.022,
      eye.z + 0.022,
    )
    b.add(
      new THREE.TorusGeometry(0.014, 0.003, 6, 12, Math.PI),
      mat.stainless,
      at(SX1 - 0.029, eye.y - 0.034, eye.z, 0, Math.PI / 2),
    )
    ;[-1, 1].forEach((s) => {
      b.add(
        new THREE.CylinderGeometry(0.003, 0.003, 0.014, 6),
        mat.stainless,
        at(SX1 - 0.029, eye.y - 0.041, eye.z + s * 0.014),
      )
    })
    // 扉の注意書き
    b.add(
      new THREE.PlaneGeometry(0.3, 0.41),
      mat.roofWarn,
      at(SX1 + 0.033, y + 1.5, (z0 + z1) / 2 - 0.06, 0, -Math.PI / 2, 0.025),
    )
    // 踊り場の隅のカラーコーン
    const cx = SX0 + 0.14
    const cz = -0.15
    box(b, mat.dark, cx - 0.15, cx + 0.15, y, y + 0.035, cz - 0.15, cz + 0.15)
    b.add(new THREE.CylinderGeometry(0.022, 0.115, 0.6, 16), mat.cone, at(cx, y + 0.335, cz))
    b.add(
      new THREE.CylinderGeometry(0.057, 0.076, 0.12, 16, 1, true),
      mat.white,
      at(cx, y + 0.36, cz),
    )
  }

  // ---------- 外 ----------
  flat(b, mat.ground, -0.02, -60, 110, -40, 40, 1)
  flat(b, mat.asphalt, -0.15, -40, 90, 3.15, 11.2, 1)
  flat(b, mat.paver, 0, -40, 90, 1.0, 3.0, 1)
  box(b, mat.concrete, -40, 90, -0.15, 0.03, 3.0, 3.15)
  ;[3.45, 10.85].forEach((z) => flat(b, mat.guard, -0.145, -40, 90, z - 0.06, z + 0.06, 1))
  for (let x = -38; x <= 88; x += 2) {
    b.add(new THREE.CylinderGeometry(0.03, 0.03, 0.8, 8), mat.guard, at(x, 0.4, 3.08))
  }
  ;[0.5, 0.78].forEach((y) => {
    b.add(
      new THREE.CylinderGeometry(0.03, 0.03, 128, 8),
      mat.guard,
      at(25, y, 3.08, 0, 0, Math.PI / 2),
    )
  })
  /**
   * 2階建ての家を1軒建てる。切妻の屋根で、棟は x の向き
   * @param face - 正面の向き。道路が南 (+z) なら 1、北 (-z) なら -1
   */
  const house = (x0, x1, z0, z1, seed, face) => {
    const h = 5.6
    const siding = sidings[seed % sidings.length]
    box(b, siding, x0, x1, -0.15, h, z0, z1)
    const front = face > 0 ? z1 + 0.01 : z0 - 0.01
    b.add(
      new THREE.PlaneGeometry(x1 - x0, h),
      facades[seed % facades.length],
      at((x0 + x1) / 2, h / 2, front, 0, face > 0 ? 0 : Math.PI),
    )
    gable(b, mat.roofTile, x0 - 0.35, x1 + 0.35, z0 - 0.45, z1 + 0.45, h, 1.7)
    gableEnd(b, siding, x0, z0, z1, h, 1.6, -1)
    gableEnd(b, siding, x1, z0, z1, h, 1.6, 1)
  }

  // 向かい側のブロック塀と、2階建ての家の並び
  box(b, mat.block, -40, 90, -0.15, 1.3, 11.3, 11.45)
  let seed = 0
  for (let x = -36; x < 88; x += 10.5 + Math.random() * 4) {
    house(x, x + 7 + Math.random() * 2.5, 12.5, 19.5, seed, -1)
    seed += 1
  }

  // 西隣の家。道路側にブロック塀と門、駐輪場との間にも塀
  house(-16.2, -9.0, -9.5, -1.8, 5, 1)
  box(b, mat.block, -16.6, -10.4, 0, 1.2, 0.75, 0.9)
  box(b, mat.block, -9.4, -7.2, 0, 1.2, 0.75, 0.9)
  box(b, mat.block, -7.35, -7.2, 0, 1.2, -9.5, 0.75)
  ;[-10.55, -9.4].forEach((x) => box(b, mat.block, x, x + 0.15, 0, 1.4, 0.7, 0.95))
  box(b, mat.post, -9.32, -9.27, 0, 1.0, 0.6, 0.65)
  box(b, mat.dark, -9.45, -9.14, 1.0, 1.28, 0.5, 0.72)
  // 電柱と電線、街灯
  const poles = [-14, 16, 46, 76]
  poles.forEach((x) => {
    b.add(new THREE.CylinderGeometry(0.14, 0.18, 11, 12), mat.pole, at(x, 5.35, 3.4))
    box(b, mat.pole, x - 0.7, x + 0.7, 9.1, 9.2, 3.35, 3.45)
  })
  ;[8.6, 9.0, 9.15].forEach((y, k) => {
    const z = 3.4 + (k - 1) * 0.3
    b.add(
      new THREE.CylinderGeometry(0.012, 0.012, 130, 6),
      mat.wire,
      at(25, y, z, 0, 0, Math.PI / 2),
    )
  })
  ;[16, -14].forEach((x) => {
    box(b, mat.pole, x, x + 0.06, 5.3, 5.36, 3.4, 4.6)
    b.add(new THREE.BoxGeometry(0.22, 0.1, 0.5), mat.steel, at(x + 0.03, 5.27, 4.7))
    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(0.16, 0.4),
      new THREE.MeshBasicMaterial({ color: 0xe9f1ff }),
    )
    glow.position.set(x + 0.03, 5.215, 4.7)
    glow.rotation.x = Math.PI / 2
    root.add(glow)
    const lamp = fixture(x + 0.03, 4.9, 4.7, 0xdfe8ff, 26, 15, glow)
    lamp.outdoor = true
  })
  // 自販機。中の明かりで見本の並びが光る。横に空き缶とペットボトルの回収箱
  const vx0 = -2.3
  const vx1 = -1.25
  const vz = 0.92
  const vm = (vx0 + vx1) / 2
  box(b, mat.concrete, -2.4, -0.22, 0, 0.08, 0.12, 1.04)
  box(b, mat.vendBody, vx0, vx1, 0.08, 1.85, 0.2, vz)
  box(b, mat.vendBody, vx0 - 0.015, vx1 + 0.015, 1.85, 1.89, 0.17, vz + 0.05)
  b.add(new THREE.PlaneGeometry(vx1 - vx0 - 0.08, 0.1), mat.vendHeader, at(vm, 1.77, vz + 0.002))
  // 見本の窓。まわりの枠を前に出して、窓が奥にあるように見せる
  b.add(new THREE.PlaneGeometry(0.93, 0.68), mat.vending, at(vm, 1.33, vz + 0.002))
  b.add(new THREE.PlaneGeometry(0.93, 0.68), mat.glass, at(vm, 1.33, vz + 0.02))
  box(b, mat.vendBody, vx0, vx1, 1.67, 1.71, vz, vz + 0.025)
  box(b, mat.vendBody, vx0, vx1, 0.95, 0.99, vz, vz + 0.025)
  box(b, mat.vendBody, vx0, vx0 + 0.04, 0.99, 1.67, vz, vz + 0.025)
  box(b, mat.vendBody, vx1 - 0.04, vx1, 0.99, 1.67, vz, vz + 0.025)
  // 下の広告と、硬貨とお札の入れ口
  b.add(new THREE.PlaneGeometry(0.66, 0.56), mat.vendAd, at(vx0 + 0.05 + 0.33, 0.66, vz + 0.002))
  box(b, mat.vendBody, vx1 - 0.31, vx1 - 0.04, 0.38, 0.94, vz, vz + 0.03)
  b.add(new THREE.PlaneGeometry(0.25, 0.54), mat.vendCoin, at(vx1 - 0.175, 0.66, vz + 0.031))
  // 取り出し口。黒い口の手前に、黒い板のふた
  b.add(new THREE.PlaneGeometry(0.64, 0.2), mat.black, at(vx0 + 0.42, 0.23, vz + 0.002))
  b.add(new THREE.PlaneGeometry(0.62, 0.18), mat.flap, at(vx0 + 0.42, 0.24, vz + 0.025, -0.18))
  box(b, mat.vendBody, vx0 + 0.08, vx0 + 0.76, 0.1, 0.13, vz, vz + 0.06)
  box(b, mat.vendBody, vx0 + 0.08, vx0 + 0.76, 0.33, 0.36, vz, vz + 0.04)
  fixture(vm, 1.3, 1.6, 0xeaf3ff, 5, 5, null).outdoor = true
  ;[
    [-1.19, mat.binCan],
    [-0.72, mat.binPet],
  ].forEach(([x, label]) => {
    box(b, mat.binBody, x, x + 0.42, 0.08, 0.95, 0.5, 0.9)
    b.add(new THREE.PlaneGeometry(0.42, 0.84), label, at(x + 0.21, 0.515, 0.902))
  })

  // 駐輪場。古いトタンの屋根と鉄の柱。中に自転車が並び、蛍光灯がときどきちらつく
  const roofY = (z) => 2.45 - ((z + 3.7) / 4.3) * 0.25
  box(b, mat.concrete, -6.95, -2.55, 0, 0.04, -3.75, 0.6)
  ;[-6.85, -2.65].forEach((x) => {
    ;[-3.65, -1.55, 0.5].forEach((z) =>
      box(b, mat.post, x - 0.04, x + 0.04, 0, roofY(z), z - 0.04, z + 0.04),
    )
    tube(
      b,
      mat.post,
      new THREE.Vector3(x, roofY(-3.75), -3.75),
      new THREE.Vector3(x, roofY(0.6), 0.6),
      0.035,
    )
  })
  b.add(
    new THREE.BoxGeometry(4.7, 0.02, 4.65),
    mat.roofSheet,
    at(-4.75, roofY(-1.55) + 0.05, -1.55, Math.atan2(0.25, 4.3)),
  )
  box(b, mat.roofSheet, -6.9, -2.6, 0.04, 1.7, -3.74, -3.71)
  const shelterSign = new THREE.Mesh(
    new THREE.PlaneGeometry(0.36, 0.3),
    new THREE.MeshStandardMaterial({
      map: signTexture(['駐輪場', '登録シールのない', '自転車は撤去します', '管理組合'], 256, 214),
      roughness: 0.8,
    }),
  )
  shelterSign.position.set(-4.75, 1.3, -3.705)
  root.add(shelterSign)
  box(b, mat.white, -5.35, -4.15, 2.27, 2.31, -1.6, -1.52)
  const tubeLight = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.025, 0.05), mat.tubeGlow.clone())
  tubeLight.position.set(-4.75, 2.255, -1.56)
  root.add(tubeLight)
  fixture(-4.75, 2.0, -1.56, 0xe8f0ff, 2.5, 5, tubeLight).faulty = true

  /**
   * 自転車を1台置く。前のかごは北 (-z) を向く
   */
  const bicycle = (cx, cz, frame) => {
    const y = 0.04
    const P = (yy, z) => new THREE.Vector3(cx, y + yy, z)
    ;[cz + 0.52, cz - 0.52].forEach((z) => {
      b.add(
        new THREE.TorusGeometry(0.31, 0.022, 6, 24),
        mat.tire,
        at(cx, y + 0.33, z, 0, Math.PI / 2),
      )
    })
    const rear = P(0.33, cz + 0.52)
    const front = P(0.33, cz - 0.52)
    const crank = P(0.3, cz + 0.02)
    const seat = P(0.86, cz + 0.22)
    const head = P(0.88, cz - 0.38)
    const low = P(0.42, cz - 0.15)
    tube(b, frame, crank, seat, 0.017)
    tube(b, frame, crank, low, 0.017)
    tube(b, frame, low, head, 0.017)
    tube(b, frame, crank, rear)
    tube(b, frame, seat, rear, 0.011)
    tube(b, mat.stainless, head, front)
    tube(b, mat.stainless, head, P(1.02, cz - 0.42))
    b.add(
      new THREE.CylinderGeometry(0.012, 0.012, 0.56, 6),
      mat.stainless,
      at(cx, y + 1.02, cz - 0.42, 0, 0, Math.PI / 2),
    )
    box(b, mat.saddle, cx - 0.08, cx + 0.08, y + 0.88, y + 0.94, cz + 0.12, cz + 0.36)
    box(b, mat.basket, cx - 0.17, cx + 0.17, y + 0.78, y + 1.0, cz - 0.84, cz - 0.52)
    box(b, mat.stainless, cx - 0.07, cx + 0.07, y + 0.68, y + 0.7, cz + 0.4, cz + 0.76)
  }
  for (let k = 0; k < 7; k++) {
    bicycle(
      -6.4 + k * 0.6 + (Math.random() - 0.5) * 0.08,
      -1.25 + (Math.random() - 0.5) * 0.3,
      frames[k % frames.length],
    )
  }

  // ---------- 植え込みとアプローチ ----------
  ;[
    [-0.6, 3.9],
    [6.1, CX1 + 0.2],
  ].forEach(([x0, x1]) => {
    box(b, mat.concrete, x0, x1, 0, 0.25, FRONT, 1.0)
    box(b, mat.hedge, x0 + 0.1, x1 - 0.1, 0.25, 0.75, FRONT + 0.1, 0.9)
  })
  flat(b, mat.paver, 0.005, 3.9, 6.1, FRONT, 1.0, 1)

  // ---------- 建物の外側 ----------
  const top = FLOORS * FH
  // 建物の奥の詰まった部分。412号室の玄関と廊下のところだけ、くり抜いておく
  const homeY = floorY(FLOORS)
  const hole = [ROOM.x0, ROOM.x1, homeY, homeY + 2.7, ROOM.z0, ROOM.z1]
  boxWithout(b, mat.tile, [0, CX1 + 0.2, 0, top + 0.1, -9, BACK_Z - 0.2], hole)
  boxWithout(b, mat.tile, [HX1, CX1 + 0.2, 0, top + 0.1, BACK_Z - 0.25, CZ - 0.2], hole)
  box(b, mat.tile, -0.2, 0, 0, top + 2.8, -9, FRONT)
  box(b, mat.tile, CX1, CX1 + 0.2, 0, top + 0.7, CZ - 0.2, FRONT)
  box(b, mat.tile, 0, SX1, 0, top + 2.8, 0, FRONT)
  box(b, mat.tile, 0, SX1 + 0.05, top + 2.5, top + 3.0, BACK_Z - 0.2, FRONT)
  box(b, mat.tile, SX1, CX1 + 0.2, top + 0.4, top + 0.75, 0, FRONT)
  box(b, mat.alum, SX1, CX1 + 0.2, top + 0.75, top + 0.8, -0.02, FRONT + 0.02)
  // 屋上の床版。階段室の壁と重ならないように少し離し、屋上の扉の前だけは扉の枠の奥から始める
  box(b, mat.tile, SX1 + 0.01, CX1 + 0.2, top, top + 0.4, -9, DOORWAY[0])
  box(b, mat.tile, SX1 + 0.12, CX1 + 0.2, top, top + 0.4, DOORWAY[0], DOORWAY[1])
  box(b, mat.tile, SX1 + 0.01, CX1 + 0.2, top, top + 0.4, DOORWAY[1], FRONT)
  // 階段室の西の窓 (外から見える方)
  for (let f = 1; f <= FLOORS; f++) {
    const y = floorY(f) + HALF + 1.4
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.8), wire.plain)
    pane.position.set(-0.205, y, -4.2)
    pane.rotation.y = -Math.PI / 2
    root.add(pane)
  }

  // ---------- 各階 ----------
  const hallLights = []
  for (let f = 1; f <= FLOORS; f++) {
    const y = floorY(f)
    const ground = f === 1

    // 床と、下の階の天井になる床版
    if (!ground) {
      box(b, mat.ceiling, SX1 + 0.01, HX1, y - 0.4, y, BACK_Z, FRONT)
      box(b, mat.ceiling, HX1, CX1, y - 0.4, y, CZ, FRONT)
      wallZ(b, mat.tile, FRONT + 0.002, SX1, CX1 + 0.2, y - 0.4, y, 1)
    }
    flat(b, ground ? mat.stone : mat.sheet, y + 0.001, SX1, HX1, BACK_Z, 0, 1)
    flat(b, mat.sheet, y + 0.001, HX1, CX1, CZ, 0, 1)
    if (f === FLOORS) {
      box(b, mat.ceiling, SX1 + 0.01, HX1, top - 0.4, top, BACK_Z, FRONT)
      box(b, mat.ceiling, HX1, CX1, top - 0.4, top, CZ, FRONT)
      wallZ(b, mat.tile, FRONT + 0.002, SX1, CX1 + 0.2, top - 0.4, top, 1)
    }

    // 腰壁と柱 (1階のエントランスの前は除く)
    const wallStart = ground ? HX1 : SX1
    box(b, mat.tile, wallStart, CX1, y, y + 1.1, 0, FRONT)
    wallZ(b, mat.paint, -0.001, wallStart, CX1, y, y + 1.1, -1)
    box(b, mat.alum, wallStart, CX1, y + 1.1, y + 1.15, -0.03, FRONT + 0.02)
    for (let k = 0; k <= UNITS / 2; k++) {
      const x = HX1 + UNIT * 2 * k
      box(
        b,
        mat.tile,
        Math.min(x, CX1 - 0.45),
        Math.min(x + 0.45, CX1),
        y,
        y + FH,
        -0.05,
        FRONT + 0.3,
      )
    }
    box(b, mat.tile, SX1, SX1 + 0.4, y, y + FH, -0.05, FRONT + 0.3)

    // エレベーターホールの壁
    wallX(b, mat.paint, SX1, BACK_Z, DOORWAY[0], y, y + CEIL, 1)
    wallX(b, mat.paint, SX1, DOORWAY[1], 0, y, y + CEIL, 1)
    wallX(b, mat.paint, SX1, DOORWAY[0], DOORWAY[1], y + 2.1, y + CEIL, 1)
    wallZ(b, mat.paint, BACK_Z, SX1, 4.5, y, y + CEIL, 1)
    wallZ(b, mat.paint, BACK_Z, 5.5, HX1, y, y + CEIL, 1)
    wallZ(b, mat.paint, BACK_Z, 4.5, 5.5, y + 2.1, y + CEIL, 1)
    wallX(b, mat.paint, HX1, BACK_Z, CZ, y, y + CEIL, -1)
    // エレベーター (点検中)
    box(b, mat.stainless, 4.5, 5.0, y, y + 2.1, BACK_Z, BACK_Z + 0.02)
    box(b, mat.stainless, 5.0, 5.5, y, y + 2.1, BACK_Z, BACK_Z + 0.02)
    box(b, mat.dark, 4.995, 5.005, y, y + 2.1, BACK_Z, BACK_Z + 0.025)
    box(b, mat.stainless, 4.4, 5.6, y + 2.1, y + 2.2, BACK_Z, BACK_Z + 0.04)
    box(b, mat.stainless, 5.7, 5.82, y + 1.0, y + 1.2, BACK_Z, BACK_Z + 0.03)
    const out = new THREE.Mesh(
      new THREE.PlaneGeometry(0.3, 0.38),
      new THREE.MeshStandardMaterial({
        map: signTexture(['点検中', '', 'ご迷惑を', 'おかけします']),
        roughness: 0.9,
      }),
    )
    out.position.set(4.75, y + 1.45, BACK_Z + 0.025)
    root.add(out)
    // 非常口の表示と消火器
    b.add(
      new THREE.PlaneGeometry(0.4, 0.15),
      mat.exit,
      at(SX1 + 0.005, y + 2.28, -0.8, 0, Math.PI / 2),
    )
    box(b, mat.red, 6.2, 6.6, y + 0.15, y + 0.75, BACK_Z, BACK_Z + 0.18)
    // ホールの照明
    hallLights.push(ceilingLight(4.0, y + CEIL, -2.6, 0xfff1df, 4, 7))
    ceilingLight(5.9, y + CEIL, -1.2, 0xfff1df, 4, 7)

    // 外廊下の部屋の並び
    let prev = HX1
    for (let i = 0; i < UNITS; i++) {
      const xd = doorX(i)
      const num = f * 100 + i + 1
      wallZ(b, mat.paint, CZ, prev, xd - 0.48, y, y + CEIL, 1)
      wallZ(b, mat.paint, CZ, xd - 0.48, xd + 0.48, y + 2.05, y + CEIL, 1)
      wallX(b, mat.paint, xd - 0.48, CZ - 0.2, CZ, y, y + 2.05, 1)
      wallX(b, mat.paint, xd + 0.48, CZ - 0.2, CZ, y, y + 2.05, -1)
      flat(b, mat.paint, y + 2.05, xd - 0.48, xd + 0.48, CZ - 0.2, CZ, -1)
      flat(b, mat.sheet, y + 0.002, xd - 0.48, xd + 0.48, CZ - 0.2, CZ, 1)
      prev = xd + 0.48
      // 枠
      box(b, mat.trim, xd - 0.5, xd - 0.45, y, y + 2.08, CZ - 0.02, CZ + 0.03)
      box(b, mat.trim, xd + 0.45, xd + 0.5, y, y + 2.08, CZ - 0.02, CZ + 0.03)
      box(b, mat.trim, xd - 0.5, xd + 0.5, y + 2.03, y + 2.08, CZ - 0.02, CZ + 0.03)
      // ドア
      const leaf = makeLeaf(0.9, 2.025)
      leaf.group.position.set(xd, y, CZ - 0.03)
      root.add(leaf.group)
      // ドアの奥は暗くふさぐ。412号室だけは、奥に玄関と廊下がある
      const isHome = f === FLOORS && i === UNITS - 1
      if (!isHome) wallZ(b, mat.black, CZ - 0.19, xd - 0.48, xd + 0.48, y, y + 2.05, 1)
      doors.push({ ...leaf, floor: f, num, x: xd, y, z: CZ, rattle: 0, home: isHome })
      // 部屋番号の札とインターホンは、ドアの枠とメーターボックスの間に縦に並べる
      const px = xd + 0.66
      box(b, mat.stainless, px - 0.085, px + 0.085, y + 1.525, y + 1.635, CZ, CZ + 0.008)
      const plate = new THREE.PlaneGeometry(0.16, 0.1)
      const uv = plate.attributes.uv
      for (let k = 0; k < uv.count; k++) uv.setX(k, (i + uv.getX(k)) / 12)
      b.add(plate, plates[f - 1], at(px, y + 1.58, CZ + 0.0085))
      box(b, mat.white, px - 0.055, px + 0.055, y + 1.24, y + 1.4, CZ, CZ + 0.035)
      box(b, mat.dark, px - 0.018, px + 0.018, y + 1.27, y + 1.3, CZ + 0.035, CZ + 0.04)
      box(b, mat.meter, xd + 0.82, xd + 1.42, y + 0.08, y + 1.98, CZ, CZ + 0.03)
      // 面格子付きのくもりガラスの窓
      const wx = HX1 + UNIT * i + 2.65
      const lit = Math.random() < 0.3
      const pane = new THREE.Mesh(
        new THREE.PlaneGeometry(0.6, 0.8),
        lit ? frosted.lit : frosted.dark,
      )
      pane.position.set(wx, y + 1.62, CZ + 0.006)
      root.add(pane)
      windows.push({
        mesh: pane,
        normal: lit ? frosted.lit : frosted.dark,
        peek: frosted.peek,
        floor: f,
        pos: pane.position,
      })
      box(b, mat.alum, wx - 0.33, wx + 0.33, y + 1.18, y + 1.22, CZ, CZ + 0.05)
      box(b, mat.alum, wx - 0.33, wx + 0.33, y + 2.02, y + 2.06, CZ, CZ + 0.05)
      box(b, mat.alum, wx - 0.33, wx - 0.29, y + 1.18, y + 2.06, CZ, CZ + 0.05)
      box(b, mat.alum, wx + 0.29, wx + 0.33, y + 1.18, y + 2.06, CZ, CZ + 0.05)
      for (let k = -2; k <= 2; k++) {
        b.add(
          new THREE.CylinderGeometry(0.01, 0.01, 0.9, 6),
          mat.alum,
          at(wx + k * 0.12, y + 1.62, CZ + 0.09),
        )
      }
      ;[1.25, 1.99].forEach((yy) =>
        box(b, mat.alum, wx - 0.34, wx + 0.34, y + yy - 0.01, y + yy + 0.01, CZ + 0.05, CZ + 0.11),
      )
      // 天井の照明 (部屋ごとに1つ)
      const light = ceilingLight(HX1 + UNIT * (i + 0.5), y + CEIL, -0.7, 0xfff4e6, 4, 6)
      if (Math.random() < 0.08) light.faulty = true
      light.corridor = f
      light.unit = i
    }
    wallZ(b, mat.paint, CZ, prev, CX1, y, y + CEIL, 1)
    wallX(b, mat.paint, CX1, CZ, 0, y, y + CEIL, -1)

    zones.push(zone(`H${f}`, SX1 + 0.25, HX1 - 0.55, -3.75, -0.25, () => y))
    zones.push(zone(`C${f}`, HX1 - 0.7, CX1 - 0.25, CZ + 0.25, -0.25, () => y))
    zones.push(zone(`D${f}`, SX1 - 0.5, SX1 + 0.5, DOORWAY[0] + 0.25, DOORWAY[1] - 0.25, () => y))
  }

  // 412号室の中 (最後に入る)。玄関のたたきと靴箱、上がり框の先にまっすぐ廊下が伸び、
  // 両側に部屋のドア、突き当たりに明かりの点いた居間のガラス戸がある
  const homeDoor = doors.find((d) => d.home)
  const room = new THREE.Group()
  room.visible = false
  root.add(room)
  const rb = makeBuilder()
  const hx = homeDoor.x
  const hy = homeDoor.y
  const { x0: gx0, x1: gx1, z0: ze, z1: zf } = ROOM
  const kx1 = hx + 0.5
  const zs = CZ - 1.05
  const yf = hy + 0.2
  const yc = hy + 2.6
  // 壁と天井。廊下は玄関より細く、東側は靴箱の奥で折れる
  wallX(rb, mat.cloth, gx0 + 0.005, ze, zf, hy, yc, 1)
  wallX(rb, mat.cloth, gx1 - 0.005, zs, zf, hy, yc, -1)
  wallX(rb, mat.cloth, kx1, ze, zs, hy, yc, -1)
  wallZ(rb, mat.cloth, zs, kx1, gx1, hy, yc, 1)
  wallZ(rb, mat.cloth, zf - 0.005, gx0, hx - 0.48, hy, hy + 2.05, -1)
  wallZ(rb, mat.cloth, zf - 0.005, hx + 0.48, gx1, hy, yc, -1)
  wallZ(rb, mat.cloth, zf - 0.005, gx0, hx + 0.48, hy + 2.05, yc, -1)
  flat(rb, mat.cloth, yc, gx0, gx1, ze, zf, -1)
  // 玄関のたたき、上がり框、廊下の床と巾木
  flat(rb, mat.stone, hy + 0.015, gx0, gx1, zs, zf, 1)
  flat(rb, mat.stone, hy + 0.015, hx - 0.48, hx + 0.48, zf, CZ - 0.04, 1)
  box(rb, mat.woodTrim, gx0, kx1, hy, yf, zs - 0.05, zs)
  flat(rb, mat.flooring, yf, gx0, kx1, ze, zs - 0.05, 1)
  box(rb, mat.woodTrim, gx0, gx0 + 0.015, yf, yf + 0.06, ze, zs - 0.05)
  box(rb, mat.woodTrim, kx1 - 0.015, kx1, yf, yf + 0.06, ze, zs - 0.05)
  // 靴箱。真ん中に扉の合わせ目と取っ手
  const mid = (zs + zf) / 2
  box(rb, mat.cabinet, gx1 - 0.38, gx1 - 0.005, hy + 0.015, hy + 0.95, zs + 0.02, zf - 0.01)
  box(rb, mat.dark, gx1 - 0.386, gx1 - 0.379, hy + 0.08, hy + 0.9, mid - 0.004, mid + 0.004)
  ;[-1, 1].forEach((side) => {
    const z = mid + side * 0.045
    box(rb, mat.stainless, gx1 - 0.396, gx1 - 0.38, hy + 0.78, hy + 0.84, z - 0.008, z + 0.008)
  })

  /**
   * 廊下の横の壁に、部屋のドアを1枚付ける
   * @param x - 壁の位置
   * @param dir - 廊下へ向く向き。西の壁なら 1、東の壁なら -1
   * @param z - ドアの真ん中
   */
  const sideDoor = (x, dir, z, w = 0.72) => {
    const span = (d0, d1) => {
      const a = x + dir * d0
      const c = x + dir * d1
      return [Math.min(a, c), Math.max(a, c)]
    }
    const [d0, d1] = span(0, 0.03)
    box(rb, mat.inDoor, d0, d1, yf, yf + 2.0, z - w / 2, z + w / 2)
    const [f0, f1] = span(0, 0.045)
    box(rb, mat.woodTrim, f0, f1, yf, yf + 2.05, z - w / 2 - 0.05, z - w / 2)
    box(rb, mat.woodTrim, f0, f1, yf, yf + 2.05, z + w / 2, z + w / 2 + 0.05)
    box(rb, mat.woodTrim, f0, f1, yf + 2.0, yf + 2.05, z - w / 2, z + w / 2)
    const [l0, l1] = span(0.03, 0.085)
    box(rb, mat.stainless, l0, l1, yf + 0.94, yf + 0.962, z + w / 2 - 0.17, z + w / 2 - 0.06)
  }
  sideDoor(gx0, 1, CZ - 1.95)
  sideDoor(kx1, -1, CZ - 2.65, 0.75)
  sideDoor(gx0, 1, CZ - 3.95)

  // 突き当たりの、居間へのガラス戸
  const gl = hx - 0.39
  const gr = hx + 0.39
  wallZ(rb, mat.cloth, ze + 0.005, gx0, gl - 0.05, hy, yc, 1)
  wallZ(rb, mat.cloth, ze + 0.005, gr + 0.05, kx1, hy, yc, 1)
  wallZ(rb, mat.cloth, ze + 0.005, gl - 0.05, gr + 0.05, yf + 2.05, yc, 1)
  box(rb, mat.woodTrim, gl - 0.05, gl, yf, yf + 2.05, ze, ze + 0.045)
  box(rb, mat.woodTrim, gr, gr + 0.05, yf, yf + 2.05, ze, ze + 0.045)
  box(rb, mat.woodTrim, gl, gr, yf + 2.0, yf + 2.05, ze, ze + 0.045)
  box(rb, mat.inDoor, gl, gl + 0.06, yf, yf + 2.0, ze, ze + 0.03)
  box(rb, mat.inDoor, gr - 0.06, gr, yf, yf + 2.0, ze, ze + 0.03)
  box(rb, mat.inDoor, gl + 0.06, gr - 0.06, yf, yf + 0.12, ze, ze + 0.03)
  box(rb, mat.inDoor, gl + 0.06, gr - 0.06, yf + 1.94, yf + 2.0, ze, ze + 0.03)
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(gr - gl - 0.12, 1.82), frosted.lit)
  glass.position.set(hx, yf + 1.03, ze + 0.015)
  room.add(glass)

  // 上がり框の先にそろえたスリッパと、たたきの靴
  ;[-0.09, 0.09].forEach((dx) => {
    box(rb, mat.slipper, hx + dx - 0.045, hx + dx + 0.045, yf, yf + 0.025, zs - 0.33, zs - 0.07)
  })
  const shoeMat = new THREE.MeshStandardMaterial({ color: 0x1b1a19, roughness: 0.6 })
  ;[-0.12, 0.12].forEach((dx, k) => {
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.27), shoeMat)
    shoe.position.set(hx + 0.25 + dx, hy + 0.055, CZ - 0.75 - k * 0.03)
    shoe.rotation.y = 0.15 * (k ? -1 : 1)
    room.add(shoe)
  })

  // 明かり。4階に着くまでは消えている
  const homeLamps = []

  /**
   * 部屋の天井に、丸い明かりを1つ置く
   */
  const roomLight = (x, z, r, color, power, dist) => {
    rb.add(
      new THREE.CylinderGeometry(r + 0.025, r + 0.025, 0.04, 20),
      mat.white,
      at(x, yc - 0.02, z),
    )
    const glow = new THREE.Mesh(
      new THREE.CircleGeometry(r, 20),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(1.6) }),
    )
    glow.position.set(x, yc - 0.041, z)
    glow.rotation.x = Math.PI / 2
    room.add(glow)
    homeLamps.push(fixture(x, yc - 0.3, z, color, power, dist, glow))
  }
  roomLight(hx + 0.25, CZ - 0.6, 0.07, 0xffd6a0, 2.5, 3.6)
  roomLight(hx, CZ - 3.0, 0.13, 0xffe2c0, 3, 5)
  homeLamps.push(fixture(hx, yf + 1.6, ze + 0.4, 0xffd9a8, 1.5, 3.5, null))
  homeLamps.forEach((lamp) => {
    lamp.on = false
  })
  rb.build(room)

  // ---------- 1階のエントランス ----------
  box(b, mat.alum, SX1, HX1, 2.2, 2.3, 0, FRONT)
  ;[SX1, 4.05, 5.95, HX1 - 0.05].forEach((x) => box(b, mat.alum, x, x + 0.06, 0, 2.5, 0, FRONT))
  b.add(new THREE.PlaneGeometry(1.15, 2.2), mat.glass, at(3.45, 1.1, 0.07))
  b.add(new THREE.PlaneGeometry(0.95, 2.2), mat.glass, at(6.48, 1.1, 0.07))
  b.add(new THREE.PlaneGeometry(4.1, 0.2), mat.glass, at(4.9, 2.4, 0.07))
  const entrance = [-1, 1].map((side) => {
    const g = new THREE.Group()
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 2.18), mat.glass)
    pane.position.y = 1.1
    const edge = new THREE.Mesh(new THREE.BoxGeometry(0.04, 2.2, 0.05), mat.alum)
    edge.position.set(-side * 0.43, 1.1, 0)
    g.add(pane, edge)
    g.position.set(5.0 + side * 0.45, 0, 0.09)
    g.userData.home = g.position.x
    g.userData.side = side
    root.add(g)
    return g
  })
  box(b, mat.white, 3.6, 6.4, 2.55, 2.75, FRONT, 1.5)
  b.add(new THREE.PlaneGeometry(2.6, 0.17), mat.nameSign, at(5.0, 2.65, 1.505))
  ceilingLight(5.0, 2.55, 0.9, 0xffe3bf, 5, 6).outdoor = true
  zones.push(zone('E', 4.35, 5.65, -0.5, 1.25, () => 0))
  // 前の道。始めの場所 (x = -8) より西へは戻れない
  zones.push(zone('S', -9.2, 88, 1.25, 2.75, () => 0))
  // 集合ポスト、掲示板、時計
  box(b, mat.mailbox, HX1 - 0.32, HX1, 0.3, 1.9, -4.55, -1.75)
  box(b, mat.trim, 3.05, 4.35, 0.95, 1.95, BACK_Z, BACK_Z + 0.03)
  const notice = noticePaper()
  const paper = new THREE.Mesh(
    new THREE.PlaneGeometry(0.33, 0.44),
    new THREE.MeshStandardMaterial({ map: notice.tex, roughness: 0.9 }),
  )
  paper.position.set(3.4, 1.45, BACK_Z + 0.035)
  paper.rotation.z = 0.02
  root.add(paper)
  const rules = new THREE.Mesh(
    new THREE.PlaneGeometry(0.3, 0.4),
    new THREE.MeshStandardMaterial({
      map: signTexture([
        'ゴミ出し',
        '',
        '燃えるゴミ 月・木',
        '資源ゴミ 水',
        '朝8時までに',
        '出してください',
      ]),
      roughness: 0.9,
    }),
  )
  rules.position.set(3.95, 1.43, BACK_Z + 0.035)
  rules.rotation.z = -0.03
  root.add(rules)
  const clock = clockFace()
  const clockFaceMesh = new THREE.Mesh(
    new THREE.CircleGeometry(0.15, 32),
    new THREE.MeshStandardMaterial({ map: clock.tex, roughness: 0.6 }),
  )
  clockFaceMesh.position.set(6.3, 2.05, BACK_Z + 0.045)
  root.add(clockFaceMesh)
  b.add(
    new THREE.CylinderGeometry(0.165, 0.165, 0.04, 32),
    mat.trim,
    at(6.3, 2.05, BACK_Z + 0.02, Math.PI / 2),
  )
  // エレベーターの前の立て看板
  box(b, mat.guard, 4.6, 5.4, 0, 0.9, -4.1, -4.05)
  const stand = new THREE.Mesh(
    new THREE.PlaneGeometry(0.7, 0.6),
    new THREE.MeshStandardMaterial({
      map: signTexture(
        ['点検中', '', 'エレベーターは', '使えません', '階段をご利用ください'],
        320,
        280,
      ),
      roughness: 0.8,
    }),
  )
  stand.position.set(5.0, 0.6, -4.04)
  root.add(stand)

  // ---------- 階段室 ----------
  const flight = Math.hypot(LAND_Z - MID_Z, HALF)
  const slope = Math.atan2(HALF, LAND_Z - MID_Z)
  for (let f = 1; f <= FLOORS + 1; f++) {
    const y = floorY(f)
    const roof = f === FLOORS + 1
    const wallTop = roof ? y + CEIL : y + FH
    // 各階の踊り場
    box(b, mat.concrete, SX0 + 0.01, SX1 - 0.01, y - 0.25, y, LAND_Z, -0.01)
    if (roof) box(b, mat.ceiling, 0, SX1, y + CEIL, y + CEIL + 0.4, BACK_Z, FRONT)
    // 壁
    wallX(b, mat.paint, SX0, BACK_Z, 0, y, wallTop, 1)
    wallZ(b, mat.paint, BACK_Z, SX0, SX1, y, wallTop, 1)
    wallZ(b, mat.paint, -0.001, SX0, SX1, y, wallTop, -1)
    wallX(b, mat.paint, SX1, BACK_Z, DOORWAY[0], y, wallTop, -1)
    wallX(b, mat.paint, SX1, DOORWAY[1], 0, y, wallTop, -1)
    wallX(b, mat.paint, SX1, DOORWAY[0], DOORWAY[1], y + 2.1, wallTop, -1)
    // 階の表示
    const sign = floorSign()
    sign.draw(roof ? 'R' : `${f}F`)
    const plaque = new THREE.Mesh(
      new THREE.PlaneGeometry(0.85, 0.53),
      new THREE.MeshStandardMaterial({
        map: sign.tex,
        transparent: true,
        alphaTest: 0.3,
        roughness: 0.9,
      }),
    )
    plaque.position.set(1.0, y + 1.65, -0.006)
    plaque.rotation.y = Math.PI
    root.add(plaque)
    signs.push({ floor: f, draw: sign.draw, label: roof ? 'R' : `${f}F` })
    // 踊り場の照明。屋上の階のは古くて、ときどきちらつく
    const landLamp = wallLight(2.2, y + 2.25, 0, 0, -1, 0xffe7c9, 3, 5.5)
    landLamp.stair = f
    zones.push(zone(`L${f}`, SX0 + 0.25, SX1 - 0.25, LAND_Z - 0.05, -0.25, () => y))
    if (roof) {
      landLamp.faulty = true
      roofDoor(y)
      continue
    }
    // 防火扉 (いつもは開けてある)
    const door = new THREE.Group()
    door.position.set(SX1 + 0.05, y, DOORWAY[0])
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.045, 2.05, 1.0), mat.steel)
    panel.position.set(0, 1.025, 0.5)
    door.add(panel)
    door.rotation.y = Math.PI
    root.add(door)
    fireDoors.push({ floor: f, group: door })

    // 中間の踊り場と、その窓と照明
    box(b, mat.concrete, SX0 + 0.01, SX1 - 0.01, y + HALF - 0.25, y + HALF, BACK_Z + 0.01, MID_Z)
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.8), wire.plain)
    pane.position.set(SX0 + 0.006, y + HALF + 1.4, -4.2)
    pane.rotation.y = Math.PI / 2
    root.add(pane)
    windows.push({
      mesh: pane,
      normal: wire.plain,
      peek: wire.peek,
      floor: f + 0.5,
      pos: pane.position,
    })
    box(b, mat.alum, SX0, SX0 + 0.05, y + HALF + 0.97, y + HALF + 1.83, -4.53, -4.48)
    box(b, mat.alum, SX0, SX0 + 0.05, y + HALF + 0.97, y + HALF + 1.83, -3.92, -3.87)
    box(b, mat.alum, SX0, SX0 + 0.05, y + HALF + 0.97, y + HALF + 1.01, -4.53, -3.87)
    box(b, mat.alum, SX0, SX0 + 0.05, y + HALF + 1.79, y + HALF + 1.83, -4.53, -3.87)
    const midLamp = wallLight(1.5, y + HALF + 2.15, BACK_Z + 0.03, 0, 1, 0xffe7c9, 3, 5.5)
    midLamp.stair = f + 0.5

    // 上り (東側の列で奥へ) と、折り返し (西側の列で手前へ)
    for (let k = 0; k < STEPS; k++) {
      const run = (LAND_Z - MID_Z) / STEPS
      const za0 = LAND_Z - (k + 1) * run
      const ya = y + (k + 1) * RISE
      box(b, mat.concrete, DIV1, SX1 - 0.01, ya - RISE - 0.06, ya, za0, za0 + run)
      box(b, mat.nosing, DIV1, SX1 - 0.01, ya - 0.01, ya + 0.004, za0 + run - 0.05, za0 + run)
      const zb0 = MID_Z + k * run
      const yb = y + HALF + (k + 1) * RISE
      box(b, mat.concrete, SX0 + 0.01, DIV0, yb - RISE - 0.06, yb, zb0, zb0 + run)
      box(b, mat.nosing, SX0 + 0.01, DIV0, yb - 0.01, yb + 0.004, zb0, zb0 + 0.05)
    }
    // 階段の裏の斜めの板
    b.add(
      new THREE.BoxGeometry(SX1 - DIV1 - 0.02, 0.15, flight),
      mat.concrete,
      at((DIV1 + SX1) / 2, y + HALF / 2 - 0.16, (LAND_Z + MID_Z) / 2, slope),
    )
    b.add(
      new THREE.BoxGeometry(DIV0 - SX0 - 0.02, 0.15, flight),
      mat.concrete,
      at((SX0 + DIV0) / 2, y + HALF * 1.5 - 0.16, (LAND_Z + MID_Z) / 2, -slope),
    )
    // 真ん中の仕切り壁と手すり
    box(b, mat.paint, DIV0, DIV1, y, y + FH, MID_Z, LAND_Z)
    const railA = Math.atan2(LAND_Z - MID_Z, HALF)
    ;[
      [DIV1 + 0.06, y + HALF / 2 + 0.85, -railA],
      [SX1 - 0.06, y + HALF / 2 + 0.85, -railA],
      [DIV0 - 0.06, y + HALF * 1.5 + 0.85, railA],
      [SX0 + 0.06, y + HALF * 1.5 + 0.85, railA],
    ].forEach(([x, yy, a]) => {
      b.add(
        new THREE.CylinderGeometry(0.02, 0.02, flight, 8),
        mat.stainless,
        at(x, yy, (LAND_Z + MID_Z) / 2, a),
      )
    })
    if (f === 1) {
      box(b, mat.paint, SX0, DIV0, 0, HALF, BACK_Z, LAND_Z)
      wallZ(b, mat.paint, LAND_Z, SX0, DIV0, HALF, FH - 0.2, 1)
    }

    const run = LAND_Z - MID_Z
    zones.push(zone(`M${f}`, SX0 + 0.25, SX1 - 0.25, BACK_Z + 0.25, MID_Z + 0.05, () => y + HALF))
    zones.push(
      zone(
        `A${f}`,
        DIV1 + 0.25,
        SX1 - 0.25,
        MID_Z,
        LAND_Z,
        (x, z) => y + ((LAND_Z - z) / run) * HALF,
      ),
    )
    zones.push(
      zone(
        `B${f}`,
        SX0 + 0.25,
        DIV0 - 0.25,
        MID_Z,
        LAND_Z,
        (x, z) => y + HALF + (1 - (LAND_Z - z) / run) * HALF,
      ),
    )
  }

  // ---------- 古び ----------
  // 雨だれ、床の端の汚れ、天井の雨じみ。どれも透ける絵を面に重ねて貼る

  /**
   * 透ける汚れの絵を1枚貼る。絵の横は u0 から uw の幅だけ使う
   */
  const decal = (mat0, w, h, x, y, z, ry, rx = 0, u0 = Math.random(), uw = 0.5, flipV = false) => {
    const g = new THREE.PlaneGeometry(w, h)
    const uv = g.attributes.uv
    for (let k = 0; k < uv.count; k++) {
      uv.setXY(k, u0 + uv.getX(k) * uw, flipV ? 1 - uv.getY(k) : uv.getY(k))
    }
    b.add(g, mat0, at(x, y, z, rx, ry))
  }
  for (let f = 1; f <= FLOORS; f++) {
    const y = floorY(f)
    // 腰壁の外側と、その下の床版の縁
    const x0 = f === 1 ? HX1 : SX1
    for (let x = x0; x < CX1; x += UNIT) {
      const w = Math.min(UNIT, CX1 - x)
      decal(mat.streak, w, 1.35, x + w / 2, y + 0.4, FRONT + 0.004, 0)
    }
    // 柱の正面
    for (let k = 0; k <= UNITS / 2; k++) {
      const x = Math.min(HX1 + UNIT * 2 * k, CX1 - 0.45)
      decal(mat.streak, 0.45, 2.2, x + 0.225, y + FH - 1.1, FRONT + 0.304, 0, 0, Math.random(), 0.1)
    }
    // 廊下の床の、壁ぎわと腰壁ぎわ
    const len = CX1 - HX1
    decal(
      mat.edgeDirt,
      len,
      0.16,
      HX1 + len / 2,
      y + 0.004,
      CZ + 0.08,
      0,
      -Math.PI / 2,
      0,
      len / 2,
      true,
    )
    decal(mat.edgeDirt, len, 0.16, HX1 + len / 2, y + 0.004, -0.08, 0, -Math.PI / 2, 0, len / 2)
    // 廊下の天井の雨じみ
    for (let k = 0; k < 3; k++) {
      const size = 0.7 + Math.random() * 0.7
      const x = HX1 + 2 + Math.random() * (len - 4)
      decal(mat.waterStain, size, size, x, y + CEIL - 0.004, -0.45, 0, Math.PI / 2, 0, 1)
    }
    // 階段室の西の窓の下
    const wy = y + HALF + 1.4
    decal(mat.streak, 0.7, 1.6, -0.204, wy - 1.2, -4.2, -Math.PI / 2, 0, Math.random(), 0.12)
  }
  // 階段室の西と南の面、建物の東の端の、上からの雨だれ
  decal(mat.streak, 9.15, 4, -0.204, top + 0.8, -4.43, -Math.PI / 2)
  decal(mat.streak, 2.8, 3.5, 1.4, top + 1.05, FRONT + 0.004, 0)
  decal(mat.streak, 9.15, 3.5, CX1 + 0.204, top - 1.65, -4.43, Math.PI / 2)

  b.build(root)

  /**
   * 足元の高さを決める。今の高さに近い区画の中なら、その高さを返す。外に出ていたら、一番近い区画の端に戻す
   */
  const resolve = (pos, feet) => {
    let best = null
    let bestD = Infinity
    zones.forEach((z) => {
      if (!z.on) return
      if (pos.x < z.x0 || pos.x > z.x1 || pos.z < z.z0 || pos.z > z.z1) return
      const d = Math.abs(z.h(pos.x, pos.z) - feet)
      if (d < 0.6 && d < bestD) {
        best = z
        bestD = d
      }
    })
    if (best) return { feet: best.h(pos.x, pos.z), zone: best }
    let near = null
    let nearD = Infinity
    let nx = 0
    let nz = 0
    zones.forEach((z) => {
      if (!z.on) return
      const cx = THREE.MathUtils.clamp(pos.x, z.x0, z.x1)
      const cz = THREE.MathUtils.clamp(pos.z, z.z0, z.z1)
      if (Math.abs(z.h(cx, cz) - feet) > 0.6) return
      const d = Math.hypot(cx - pos.x, cz - pos.z)
      if (d >= nearD) return
      near = z
      nearD = d
      nx = cx
      nz = cz
    })
    if (!near) return { feet, zone: null }
    pos.x = nx
    pos.z = nz
    return { feet: near.h(nx, nz), zone: near }
  }

  return {
    root,
    zones,
    fixtures,
    doors,
    windows,
    signs,
    fireDoors,
    entrance,
    room,
    homeLamps,
    hallLights,
    clock,
    notice,
    resolve,
  }
}
