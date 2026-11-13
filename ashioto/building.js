import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import {
  asphaltTexture,
  ceilingTexture,
  clockFace,
  concreteTexture,
  doorLeafTexture,
  exitTexture,
  floorSign,
  floorTexture,
  frostedTexture,
  hedgeTexture,
  labelTexture,
  mailboxTexture,
  meterBoxTexture,
  nameSignTexture,
  neighborTexture,
  noticePaper,
  paverTexture,
  plateAtlas,
  signTexture,
  stoneTileTexture,
  tileTexture,
  vendingTexture,
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
    nameSign: new THREE.MeshStandardMaterial({
      map: nameSignTexture(),
      roughness: 0.4,
      metalness: 0.3,
    }),
    neighbor: new THREE.MeshBasicMaterial({ map: neighborTexture(), color: 0x9a9a9a }),
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
    roomDark: new THREE.MeshStandardMaterial({ color: 0x0e0d0c, roughness: 1 }),
    roomWarm: new THREE.MeshStandardMaterial({
      color: 0x6e5c48,
      roughness: 0.95,
      side: THREE.BackSide,
    }),
  }
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
  // 向かい側のブロック塀と家
  box(b, mat.concrete, -40, 90, -0.15, 1.3, 11.3, 11.45)
  for (let x = -36; x < 88; x += 11 + Math.random() * 4) {
    const w = 7 + Math.random() * 3
    const h = 5.5 + Math.random() * 1.5
    box(b, mat.dark, x, x + w, -0.15, h, 12.5, 20)
    b.add(
      new THREE.PlaneGeometry(w * 0.7, h * 0.6),
      mat.neighbor,
      at(x + w / 2, h * 0.45, 12.49, 0, Math.PI),
    )
    box(b, mat.dark, x - 0.3, x + w + 0.3, h, h + 0.25, 12.2, 20.3)
  }
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
  // 自販機
  box(b, mat.dark, -2.3, -1.2, 0, 1.83, 0.2, 0.95)
  b.add(new THREE.PlaneGeometry(1.0, 1.75), mat.vending, at(-1.75, 0.92, 0.952))
  box(b, mat.white, -1.05, -0.65, 0, 0.75, 0.45, 0.85)
  fixture(-1.75, 1.3, 1.6, 0xeaf3ff, 5, 5, null).outdoor = true

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
  box(b, mat.tile, 0, CX1 + 0.2, 0, top + 0.1, -9, BACK_Z - 0.2)
  box(b, mat.tile, HX1, CX1 + 0.2, 0, top + 0.1, BACK_Z - 0.25, CZ - 0.2)
  box(b, mat.tile, -0.2, 0, 0, top + 2.8, -9, FRONT)
  box(b, mat.tile, CX1, CX1 + 0.2, 0, top + 0.7, CZ - 0.2, FRONT)
  box(b, mat.tile, 0, SX1, 0, top + 2.8, 0, FRONT)
  box(b, mat.tile, 0, SX1 + 0.05, top + 2.5, top + 3.0, BACK_Z - 0.2, FRONT)
  box(b, mat.tile, SX1, CX1 + 0.2, top + 0.4, top + 0.75, 0, FRONT)
  box(b, mat.alum, SX1, CX1 + 0.2, top + 0.75, top + 0.8, -0.02, FRONT + 0.02)
  box(b, mat.tile, SX1, CX1 + 0.2, top, top + 0.4, -9, FRONT)
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
      box(b, mat.ceiling, SX1, HX1, y - 0.4, y, BACK_Z, FRONT)
      box(b, mat.ceiling, HX1, CX1, y - 0.4, y, CZ, FRONT)
      wallZ(b, mat.tile, FRONT + 0.002, SX1, CX1 + 0.2, y - 0.4, y, 1)
    }
    flat(b, ground ? mat.stone : mat.sheet, y + 0.001, SX1, HX1, BACK_Z, 0, 1)
    flat(b, mat.sheet, y + 0.001, HX1, CX1, CZ, 0, 1)
    if (f === FLOORS) {
      box(b, mat.ceiling, SX1, HX1, top - 0.4, top, BACK_Z, FRONT)
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
      prev = xd + 0.48
      // 枠
      box(b, mat.trim, xd - 0.5, xd - 0.45, y, y + 2.08, CZ - 0.02, CZ + 0.03)
      box(b, mat.trim, xd + 0.45, xd + 0.5, y, y + 2.08, CZ - 0.02, CZ + 0.03)
      box(b, mat.trim, xd - 0.5, xd + 0.5, y + 2.03, y + 2.08, CZ - 0.02, CZ + 0.03)
      // ドア
      const leaf = makeLeaf(0.9, 2.0)
      leaf.group.position.set(xd, y, CZ - 0.03)
      root.add(leaf.group)
      const isHome = f === FLOORS && i === UNITS - 1
      const back = new THREE.Mesh(
        new THREE.PlaneGeometry(0.96, 2.05),
        isHome ? mat.roomDark : mat.black,
      )
      back.position.set(xd, y + 1.025, CZ - 0.2)
      root.add(back)
      doors.push({ ...leaf, floor: f, num, x: xd, y, z: CZ, rattle: 0, home: isHome })
      // 部屋番号の札、インターホン、メーターボックス
      const plate = new THREE.PlaneGeometry(0.2, 0.2)
      const uv = plate.attributes.uv
      for (let k = 0; k < uv.count; k++) uv.setX(k, (i + uv.getX(k)) / 12)
      b.add(plate, plates[f - 1], at(xd + 0.68, y + 1.62, CZ + 0.004))
      box(b, mat.white, xd + 0.62, xd + 0.74, y + 1.28, y + 1.44, CZ, CZ + 0.035)
      box(
        b,
        mat.meter,
        HX1 + UNIT * i + 1.43,
        HX1 + UNIT * i + 2.07,
        y + 0.08,
        y + 1.98,
        CZ,
        CZ + 0.03,
      )
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
    }
    wallZ(b, mat.paint, CZ, prev, CX1, y, y + CEIL, 1)
    wallX(b, mat.paint, CX1, CZ, 0, y, y + CEIL, -1)

    zones.push(zone(`H${f}`, SX1 + 0.25, HX1 - 0.55, -3.75, -0.25, () => y))
    zones.push(zone(`C${f}`, HX1 - 0.7, CX1 - 0.25, CZ + 0.25, -0.25, () => y))
    zones.push(zone(`D${f}`, SX1 - 0.5, SX1 + 0.5, DOORWAY[0] + 0.25, DOORWAY[1] - 0.25, () => y))
  }

  // 412号室の中 (最後に入る玄関)。たたき、上がりかまち、靴、奥のガラス戸
  const homeDoor = doors.find((d) => d.home)
  const room = new THREE.Group()
  room.visible = false
  root.add(room)
  const hx = homeDoor.x
  const hy = homeDoor.y
  const inner = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.4, 2.4), mat.roomWarm)
  inner.position.set(hx, hy + 1.2, CZ - 1.4)
  const step = new THREE.Mesh(
    new THREE.BoxGeometry(1.38, 0.18, 1.5),
    new THREE.MeshStandardMaterial({ color: 0x5c4330, roughness: 0.7 }),
  )
  step.position.set(hx, hy + 0.09, CZ - 1.85)
  const genkan = new THREE.Mesh(new THREE.PlaneGeometry(1.38, 0.88), mat.stone)
  genkan.rotation.x = -Math.PI / 2
  genkan.position.set(hx, hy + 0.005, CZ - 0.66)
  const shoeMat = new THREE.MeshStandardMaterial({ color: 0x1b1a19, roughness: 0.6 })
  ;[-0.12, 0.12].forEach((dx, k) => {
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.27), shoeMat)
    shoe.position.set(hx + 0.25 + dx, hy + 0.045, CZ - 0.75 - k * 0.03)
    shoe.rotation.y = 0.15 * (k ? -1 : 1)
    room.add(shoe)
  })
  const glassDoor = new THREE.Mesh(
    new THREE.PlaneGeometry(0.7, 1.9),
    new THREE.MeshBasicMaterial({ map: frostedTexture('lit') }),
  )
  glassDoor.position.set(hx, hy + 0.18 + 0.95, CZ - 2.58)
  room.add(inner, step, genkan, glassDoor)
  const homeLamp = fixture(hx, hy + 2.1, CZ - 1.3, 0xffd6a0, 3, 4.2, null)
  homeLamp.on = false

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
  zones.push(zone('S', -38, 88, 1.25, 2.75, () => 0))
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
    // 踊り場の照明
    const landLamp = wallLight(2.2, y + 2.25, 0, 0, -1, 0xffe7c9, 3, 5.5)
    landLamp.stair = f
    // 防火扉 (いつもは開けてある)。屋上だけ閉まっていて開かない
    const door = new THREE.Group()
    door.position.set(SX1 + 0.05, y, DOORWAY[0])
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.045, 2.05, 1.0), mat.steel)
    panel.position.set(0, 1.025, 0.5)
    door.add(panel)
    door.rotation.y = roof ? 0 : Math.PI
    root.add(door)
    fireDoors.push({ floor: f, group: door })
    if (roof) {
      const warn = new THREE.Mesh(
        new THREE.PlaneGeometry(0.34, 0.42),
        new THREE.MeshStandardMaterial({
          map: signTexture(['屋上', '', '関係者以外', '立入禁止']),
          roughness: 0.9,
        }),
      )
      warn.position.set(SX1 + 0.02, y + 1.5, -0.8)
      warn.rotation.y = -Math.PI / 2
      root.add(warn)
    }
    zones.push(zone(`L${f}`, SX0 + 0.25, SX1 - 0.25, LAND_Z - 0.05, -0.25, () => y))
    if (roof) continue

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
    homeLamp,
    hallLights,
    clock,
    notice,
    resolve,
  }
}
