import * as THREE from 'three'
import { at, box, flat, makeBuilder, tiled, tube, wallX, wallZ, zone } from './kit.js'
import {
  asphaltTexture,
  ceilingTexture,
  concreteTexture,
  directoryTexture,
  fraudPosterTexture,
  gateTopTexture,
  kobanSignTexture,
  paverTexture,
  shopSignTexture,
  shrineSignTexture,
  shutterTexture,
  signTexture,
  stoneTileTexture,
  storeInsideTexture,
  walkSignalTexture,
  wallTexture,
} from './textures.js'

// 会社のある町。会社のビルのロビーから出て、通りを東へ歩くと、交番と中央町駅がある。
// 座標は、ロビーの入口の真ん中の前 (tx, 0, tz) からの相対で決める。通りは x の向きで、南 (+z) が車道
// 駅 (station.js) は、この町の (70, 3) に置く

/**
 * 町を作る
 * @param origin - [tx, tz]
 * @param shared - { zones, fixtures }。建物と同じ並びに足す
 */
export const buildTown = (scene, origin, shared) => {
  const [tx, tz] = origin
  const X = (x) => tx + x
  const Z = (z) => tz + z
  const root = new THREE.Group()
  scene.add(root)
  const b = makeBuilder()

  const mat = {
    stone: tiled(stoneTileTexture(), 1.6, { roughness: 0.18, metalness: 0.1 }),
    wall: tiled(wallTexture(), 2.0),
    ceiling: tiled(ceilingTexture(), 2.0, { roughness: 1 }),
    concrete: tiled(concreteTexture(), 1.5),
    paver: tiled(paverTexture(), 1.0),
    asphalt: tiled(asphaltTexture(), 3.0),
    shutter: tiled(shutterTexture(), 1.0, { roughness: 0.5, metalness: 0.4 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x1a1b1e, roughness: 0.9 }),
    facade: new THREE.MeshStandardMaterial({ color: 0x3b3e43, roughness: 0.7 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x8a8e93, roughness: 0.45, metalness: 0.5 }),
    stainless: new THREE.MeshStandardMaterial({ color: 0xb8b8b4, roughness: 0.3, metalness: 0.7 }),
    white: new THREE.MeshStandardMaterial({ color: 0xe8e6e0, roughness: 0.6 }),
    line: new THREE.MeshStandardMaterial({ color: 0xdedcd6, roughness: 0.7 }),
    gate: new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.35, metalness: 0.4 }),
    gateTop: new THREE.MeshStandardMaterial({ map: gateTopTexture(), roughness: 0.4 }),
    wood: new THREE.MeshStandardMaterial({ color: 0x6b5138, roughness: 0.6 }),
    plant: new THREE.MeshStandardMaterial({ color: 0x2f5a33, roughness: 0.9 }),
    pot: new THREE.MeshStandardMaterial({ color: 0x4a4540, roughness: 0.8 }),
    glass: new THREE.MeshStandardMaterial({
      color: 0x8fa3b0,
      roughness: 0.05,
      metalness: 0.5,
      transparent: true,
      opacity: 0.2,
      depthWrite: false,
    }),
    lit: new THREE.MeshBasicMaterial({ color: 0xd9b77a }),
    cool: new THREE.MeshBasicMaterial({ color: 0xbfd6f2 }),
    lantern: new THREE.MeshBasicMaterial({ color: 0xff4a2a }),
    red: new THREE.MeshBasicMaterial({ color: 0xff2414 }),
    off: new THREE.MeshBasicMaterial({ color: 0x2a2c30 }),
    glow: new THREE.MeshBasicMaterial({ color: 0xf2f5ff }),
    store: new THREE.MeshBasicMaterial({ map: storeInsideTexture() }),
    directory: new THREE.MeshBasicMaterial({ map: directoryTexture(), color: 0xcccccc }),
    koban: new THREE.MeshBasicMaterial({ map: kobanSignTexture() }),
    fraud: new THREE.MeshStandardMaterial({ map: fraudPosterTexture(), roughness: 0.75 }),
    // 祠。古い木、緑青の屋根、色のあせた朱の鳥居、鈴の緒、落ちている鈴
    oldWood: new THREE.MeshStandardMaterial({ color: 0x4a3b2c, roughness: 0.9 }),
    copper: new THREE.MeshStandardMaterial({ color: 0x4f6f60, roughness: 0.75, metalness: 0.2 }),
    vermilion: new THREE.MeshStandardMaterial({ color: 0xa3442e, roughness: 0.85 }),
    rope: new THREE.MeshStandardMaterial({ color: 0x8e3328, roughness: 0.95 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xc9a14a, roughness: 0.28, metalness: 0.9 }),
    sakaki: new THREE.MeshStandardMaterial({ color: 0x24432a, roughness: 0.8 }),
    shrineSign: new THREE.MeshStandardMaterial({ map: shrineSignTexture(), roughness: 0.9 }),
    lamp: new THREE.MeshBasicMaterial({ color: 0xffc27a }),
    walkRed: new THREE.MeshBasicMaterial({ map: walkSignalTexture(false) }),
    walkGo: new THREE.MeshBasicMaterial({ map: walkSignalTexture(true) }),
  }

  /**
   * 照明を1つ。光る部分と、あとで本物の光を割り当てるための印
   */
  const fixture = (x, y, z, color, power, dist, glow, outdoor = false) => {
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
      outdoor,
    }
    shared.fixtures.push(f)
    return f
  }

  /**
   * 文字の看板を1枚。光るなら MeshBasic
   */
  const sign = (map, w, h, x, y, z, ry = 0, lit = false) => {
    const m = lit
      ? new THREE.MeshBasicMaterial({ map })
      : new THREE.MeshStandardMaterial({ map, roughness: 0.6 })
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m)
    mesh.position.set(x, y, z)
    mesh.rotation.y = ry
    root.add(mesh)
    return mesh
  }

  // ---------- 会社のビルのロビー ----------
  const LH = 4.2
  flat(b, mat.stone, 0.002, X(-8), X(8), Z(-10), Z(3), 1)
  flat(b, mat.ceiling, LH, X(-8), X(8), Z(-10), Z(3), -1)
  wallX(b, mat.wall, X(-8), Z(-10), Z(3), 0, LH, 1)
  wallX(b, mat.wall, X(8), Z(-10), Z(3), 0, LH, -1)
  wallZ(b, mat.wall, Z(-10), X(-8), X(8), 0, LH, 1)
  // 正面のガラスの壁と、自動ドア
  ;[
    [-8, -1.2],
    [1.2, 8],
  ].forEach(([a, c]) =>
    b.add(new THREE.PlaneGeometry(c - a, LH), mat.glass, at(X((a + c) / 2), LH / 2, Z(3))),
  )
  b.add(new THREE.PlaneGeometry(2.4, LH - 2.4), mat.glass, at(X(0), 2.4 + (LH - 2.4) / 2, Z(3)))
  for (let x = -8; x <= 8; x += 1.6)
    box(b, mat.steel, X(x - 0.04), X(x + 0.04), 0, LH, Z(2.96), Z(3.06))
  box(b, mat.steel, X(-8), X(8), 2.38, 2.46, Z(2.96), Z(3.06))
  const lobbyDoors = [-1, 1].map((side) => {
    const g = new THREE.Group()
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 2.35), mat.glass)
    pane.position.y = 1.18
    const edge = new THREE.Mesh(new THREE.BoxGeometry(0.04, 2.38, 0.05), mat.steel)
    edge.position.set(-side * 0.56, 1.19, 0)
    g.add(pane, edge)
    g.position.set(X(side * 0.58), 0, Z(3.0))
    g.userData.home = g.position.x
    g.userData.side = side
    root.add(g)
    return g
  })
  // セキュリティゲート
  const gateX = [-2.3, -1.1, 0.1, 1.3]
  gateX.forEach((x) => {
    box(b, mat.gate, X(x - 0.12), X(x + 0.12), 0, 0.98, Z(-3.7), Z(-2.4))
    b.add(new THREE.PlaneGeometry(0.24, 1.3), mat.gateTop, at(X(x), 0.985, Z(-3.05), -Math.PI / 2))
  })
  box(b, mat.gate, X(-8), X(-2.42), 0, 1.0, Z(-3.1), Z(-3.0))
  box(b, mat.gate, X(1.42), X(8), 0, 1.0, Z(-3.1), Z(-3.0))
  // エレベーター2基と、階の表示
  ;[-2.4, 2.4].forEach((x) => {
    box(b, mat.stainless, X(x - 0.55), X(x + 0.55), 0, 2.25, Z(-10), Z(-9.97))
    box(b, mat.dark, X(x - 0.006), X(x + 0.006), 0, 2.25, Z(-10), Z(-9.965))
    box(b, mat.stainless, X(x - 0.7), X(x + 0.7), 2.25, 2.4, Z(-10), Z(-9.95))
    box(b, mat.stainless, X(x + 0.75), X(x + 0.87), 1.0, 1.3, Z(-10), Z(-9.97))
    b.add(new THREE.PlaneGeometry(0.4, 0.14), mat.off, at(X(x), 2.6, Z(-9.965)))
  })
  sign(signTexture(['1', '', ''], 128, 96), 0.12, 0.09, X(-2.4), 2.6, Z(-9.96), 0, true)
  // 受付と、テナント案内、植木
  box(b, mat.wood, X(4.2), X(7.6), 0, 1.05, Z(-1.6), Z(-0.9))
  box(b, mat.white, X(4.15), X(7.65), 1.05, 1.1, Z(-1.65), Z(-0.85))
  sign(
    signTexture(['受付', '', '夜間は', '守衛室へ'], 256, 220),
    0.42,
    0.36,
    X(5.9),
    1.35,
    Z(-0.84),
    0,
  )
  b.add(new THREE.PlaneGeometry(1.2, 1.6), mat.directory, at(X(-7.98), 1.9, Z(-6), 0, Math.PI / 2))
  ;[
    [-6.8, 1.8],
    [6.8, -8.8],
  ].forEach(([x, z]) => {
    b.add(new THREE.CylinderGeometry(0.28, 0.22, 0.55, 16), mat.pot, at(X(x), 0.28, Z(z)))
    b.add(new THREE.SphereGeometry(0.5, 12, 10), mat.plant, at(X(x), 1.0, Z(z)))
  })
  // 天井の明かり。夜なので、半分は消えている
  ;[
    [0, -6.5, true],
    [0, 0.5, true],
    [-4.5, -6.5, false],
    [4.5, -6.5, false],
    [-4.5, 0.5, false],
    [4.5, 0.5, true],
  ].forEach(([x, z, on]) => {
    box(b, mat.white, X(x - 0.62), X(x + 0.62), LH - 0.03, LH, Z(z - 0.32), Z(z + 0.32))
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 0.55), on ? mat.glow : mat.off)
    glow.rotation.x = Math.PI / 2
    glow.position.set(X(x), LH - 0.035, Z(z))
    root.add(glow)
    if (on) fixture(X(x), LH - 0.4, Z(z), 0xeef2ff, 7, 11, null)
  })
  // ビルの外側 (8階建て)
  box(b, mat.facade, X(-10), X(10), LH, 30, Z(-14), Z(2.9))
  box(b, mat.facade, X(-10), X(-8.05), 0, LH, Z(-14), Z(3))
  box(b, mat.facade, X(8.05), X(10), 0, LH, Z(-14), Z(3))
  for (let y = 6; y < 29; y += 3.2) {
    for (let x = -8.5; x < 8.6; x += 2.4) {
      if (Math.random() < 0.82) continue
      b.add(new THREE.PlaneGeometry(1.6, 1.3), mat.cool, at(X(x), y, Z(2.91)))
    }
  }

  // ---------- 通り ----------
  flat(b, mat.paver, 0.003, X(-40), X(100), Z(3), Z(6.5), 1)
  box(b, mat.concrete, X(-40), X(100), -0.15, 0.04, Z(6.5), Z(6.7))
  flat(b, mat.asphalt, -0.15, X(-40), X(100), Z(6.7), Z(14.7), 1)
  box(b, mat.concrete, X(-40), X(100), -0.15, 0.04, Z(14.7), Z(14.9))
  flat(b, mat.paver, 0.003, X(-40), X(100), Z(14.9), Z(18), 1)
  ;[7.1, 14.3].forEach((z) =>
    flat(b, mat.line, -0.145, X(-40), X(100), Z(z - 0.06), Z(z + 0.06), 1),
  )
  for (let x = -40; x < 100; x += 6)
    flat(b, mat.line, -0.145, X(x), X(x + 3), Z(10.64), Z(10.76), 1)
  // 横断歩道と信号
  for (let z = 7.2; z < 14.4; z += 0.9)
    flat(b, mat.line, -0.144, X(36), X(40), Z(z), Z(z + 0.45), 1)
  const signals = []
  ;[
    [34.6, 6.6, 1],
    [34.6, 14.8, -1],
  ].forEach(([x, z, dir]) => {
    box(b, mat.steel, X(x - 0.06), X(x + 0.06), 0, 3.2, Z(z - 0.06), Z(z + 0.06))
    box(b, mat.dark, X(x - 0.2), X(x + 0.2), 2.2, 2.95, Z(z - 0.1), Z(z + 0.1))
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34), mat.walkRed)
    face.position.set(X(x), 2.55, Z(z + dir * 0.105))
    face.rotation.y = dir > 0 ? 0 : Math.PI
    root.add(face)
    signals.push(face)
  })
  // 街灯 (北の歩道)
  ;[-30, -10, 12, 32, 52, 88].forEach((x) => {
    box(b, mat.steel, X(x - 0.08), X(x + 0.08), 0, 6.5, Z(6.3), Z(6.46))
    box(b, mat.steel, X(x - 0.06), X(x + 0.06), 6.4, 6.5, Z(6.3), Z(8.2))
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.55), mat.glow)
    glow.rotation.x = Math.PI / 2
    glow.position.set(X(x), 6.36, Z(7.9))
    root.add(glow)
    fixture(X(x), 6.0, Z(7.6), 0xe6eeff, 24, 15, glow, true)
  })
  // 電柱と電線 (南の歩道)
  ;[-25, 15, 55, 95].forEach((x) => {
    b.add(new THREE.CylinderGeometry(0.14, 0.18, 10, 12), mat.steel, at(X(x), 5, Z(15.3)))
  })
  ;[8.4, 8.8].forEach((y) => {
    b.add(
      new THREE.CylinderGeometry(0.012, 0.012, 140, 6),
      mat.dark,
      at(X(30), y, Z(15.3), 0, 0, Math.PI / 2),
    )
  })
  // 向かい側の、暗いビルの並び
  for (let x = -40; x < 100; x += 9 + Math.random() * 5) {
    const w = 7 + Math.random() * 4
    const h = 8 + Math.random() * 14
    box(b, mat.facade, X(x), X(x + w), -0.15, h, Z(18.2), Z(30))
    for (let y = 3; y < h - 1; y += 3) {
      for (let wx = x + 1; wx < x + w - 1; wx += 1.8) {
        if (Math.random() < 0.8) continue
        b.add(
          new THREE.PlaneGeometry(1.1, 1.0),
          Math.random() < 0.6 ? mat.lit : mat.cool,
          at(X(wx), y, Z(18.19), 0, Math.PI),
        )
      }
    }
  }

  // ---------- 北側の店 ----------
  /**
   * シャッターの閉まった店
   */
  const closedShop = (x0, x1, name, bg, fg) => {
    box(b, mat.facade, X(x0), X(x1), 0, 7, Z(-6), Z(2.9))
    b.add(
      new THREE.PlaneGeometry(x1 - x0 - 0.4, 2.6),
      mat.shutter,
      at(X((x0 + x1) / 2), 1.3, Z(2.92)),
    )
    box(b, mat.dark, X(x0 + 0.1), X(x1 - 0.1), 2.6, 2.75, Z(2.9), Z(3.05))
    sign(shopSignTexture(name, bg, fg), x1 - x0 - 0.6, 0.62, X((x0 + x1) / 2), 3.15, Z(2.93))
  }
  closedShop(10.2, 16.6, '三河屋', '#2a3b5e', '#f1e6c8')
  // コンビニ。明るいガラスの向こうに棚
  box(b, mat.facade, X(17), X(25.2), 2.9, 7, Z(-6), Z(2.9))
  box(b, mat.white, X(17), X(17.25), 0, 2.9, Z(-6), Z(2.9))
  box(b, mat.white, X(24.95), X(25.2), 0, 2.9, Z(-6), Z(2.9))
  b.add(new THREE.PlaneGeometry(7.7, 2.7), mat.store, at(X(21.1), 1.35, Z(1.2)))
  b.add(new THREE.PlaneGeometry(7.7, 2.7), mat.glass, at(X(21.1), 1.35, Z(2.92)))
  flat(b, mat.white, 0.004, X(17.25), X(24.95), Z(1.2), Z(2.9), 1)
  sign(
    shopSignTexture('SUNNY MART', '#2b6fb8', '#ffffff', '24時間営業'),
    7.8,
    0.75,
    X(21.1),
    3.3,
    Z(2.93),
    0,
    true,
  )
  fixture(X(21.1), 2.3, Z(4.2), 0xf4f8ff, 9, 9, null, true)
  // ラーメン屋。赤ちょうちんと、暖かい窓
  box(b, mat.facade, X(25.6), X(31.4), 0, 7, Z(-6), Z(2.9))
  b.add(new THREE.PlaneGeometry(3.2, 1.3), mat.lit, at(X(28.5), 1.55, Z(2.92)))
  sign(shopSignTexture('ラーメン 龍', '#7a1d14', '#ffe9b0'), 5.2, 0.62, X(28.5), 3.1, Z(2.93))
  b.add(new THREE.SphereGeometry(0.26, 14, 12), mat.lantern, at(X(30.7), 2.35, Z(3.25)))
  fixture(X(30.7), 2.1, Z(3.8), 0xff8a5a, 2.5, 5, null, true)
  closedShop(31.8, 36.2, '中央町不動産', '#e6e2d6', '#1f3d7a')
  closedShop(38.8, 46, 'クリーニング', '#2e6b4f', '#ffffff')
  closedShop(46.4, 54.6, '喫茶 白樺', '#3b2a20', '#e8d4b0')

  // ---------- ビルの隙間の祠 ----------
  // 不動産屋とクリーニング屋のあいだ (x = 36.2 から 38.8)。奥はブロック塀。
  // 石の台に古い祠が載り、前に小さな鳥居と由来の立て札。鈴の緒だけが残り、鈴は歩道に落ちている
  const sx = 37.5
  box(b, mat.facade, X(36.2), X(38.8), 0, 7, Z(-6), Z(-1.3))
  box(b, mat.concrete, X(36.2), X(38.8), 0, 1.9, Z(-1.32), Z(-1.2))
  flat(b, mat.concrete, 0.004, X(36.2), X(38.8), Z(-1.2), Z(2.95), 1)
  box(b, mat.concrete, X(sx - 0.45), X(sx + 0.45), 0, 0.55, Z(-1.05), Z(-0.35))
  box(b, mat.oldWood, X(sx - 0.32), X(sx + 0.32), 0.55, 1.08, Z(-0.95), Z(-0.45))
  box(b, mat.oldWood, X(sx - 0.32), X(sx + 0.32), 1.08, 1.3, Z(-0.85), Z(-0.55))
  b.add(new THREE.PlaneGeometry(0.46, 0.4), mat.dark, at(X(sx), 0.8, Z(-0.448)))
  box(b, mat.oldWood, X(sx - 0.01), X(sx + 0.01), 0.6, 1.02, Z(-0.45), Z(-0.43))
  // 屋根。棟から前後へ、0.6 rad かたむけた板を2枚
  ;[-1, 1].forEach((e) => {
    b.add(
      new THREE.BoxGeometry(0.92, 0.035, 0.5),
      mat.copper,
      at(X(sx), 1.42 - 0.25 * Math.sin(0.6), Z(-0.7 + e * 0.25 * Math.cos(0.6)), e * 0.6),
    )
  })
  box(b, mat.oldWood, X(sx - 0.48), X(sx + 0.48), 1.4, 1.47, Z(-0.73), Z(-0.67))
  // 鈴の緒。先の鈴が無い
  tube(
    b,
    mat.rope,
    new THREE.Vector3(X(sx), 1.17, Z(-0.36)),
    new THREE.Vector3(X(sx), 0.7, Z(-0.33)),
    0.013,
  )
  // お神酒と榊
  ;[-0.3, 0.3].forEach((d) => {
    b.add(
      new THREE.CylinderGeometry(0.03, 0.035, 0.12, 12),
      mat.white,
      at(X(sx + d), 0.61, Z(-0.3)),
    )
    b.add(
      new THREE.CylinderGeometry(0.035, 0.03, 0.1, 12),
      mat.white,
      at(X(sx + d * 1.3), 0.6, Z(-0.85)),
    )
    b.add(new THREE.SphereGeometry(0.08, 10, 8), mat.sakaki, at(X(sx + d * 1.3), 0.72, Z(-0.85)))
  })
  // 鳥居
  ;[-0.6, 0.6].forEach((d) => {
    b.add(
      new THREE.CylinderGeometry(0.045, 0.05, 1.7, 12),
      mat.vermilion,
      at(X(sx + d), 0.85, Z(1.2)),
    )
  })
  box(b, mat.dark, X(sx - 0.85), X(sx + 0.85), 1.7, 1.78, Z(1.14), Z(1.26))
  box(b, mat.vermilion, X(sx - 0.76), X(sx + 0.76), 1.63, 1.7, Z(1.15), Z(1.25))
  box(b, mat.vermilion, X(sx - 0.7), X(sx + 0.7), 1.42, 1.48, Z(1.17), Z(1.23))
  box(b, mat.vermilion, X(sx - 0.03), X(sx + 0.03), 1.48, 1.63, Z(1.17), Z(1.23))
  // 由来の立て札。小さな屋根つき
  box(b, mat.oldWood, X(36.42), X(36.48), 0, 1.55, Z(1.42), Z(1.48))
  b.add(new THREE.PlaneGeometry(0.42, 0.66), mat.shrineSign, at(X(36.45), 1.15, Z(1.49)))
  box(b, mat.oldWood, X(36.2), X(36.7), 1.5, 1.53, Z(1.36), Z(1.62))
  // 右の壁の、小さな明かり
  box(b, mat.steel, X(38.6), X(38.8), 1.9, 1.94, Z(0.36), Z(0.44))
  const shrineLamp = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 10), mat.lamp.clone())
  shrineLamp.position.set(X(38.58), 1.86, Z(0.4))
  root.add(shrineLamp)
  fixture(X(38.4), 1.75, Z(0.4), 0xffb070, 1.2, 4.5, shrineLamp, true)
  // 歩道に落ちている鈴。赤い紐が少し付いている
  const bell = new THREE.Group()
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.032, 16, 12), mat.gold)
  ball.position.y = 0.032
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.01, 0.003, 6, 12), mat.gold)
  ring.position.set(0.03, 0.06, 0)
  ring.rotation.z = -0.9
  const cord = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.006, 0.01), mat.rope)
  cord.position.set(0.1, 0.004, 0.02)
  cord.rotation.y = 0.5
  bell.add(ball, ring, cord)
  bell.position.set(X(sx), 0.003, Z(4.25))
  root.add(bell)

  // ---------- 交番 ----------
  // 白い壁の小さな建物。入口のガラス戸のところだけ奥へへこませ、その奥に明るい部屋が見える
  box(b, mat.white, X(55), X(61.6), 0, 3.4, Z(-3), Z(2.5))
  box(b, mat.white, X(55), X(58.2), 0, 3.4, Z(2.5), Z(2.9))
  box(b, mat.white, X(59.6), X(61.6), 0, 3.4, Z(2.5), Z(2.9))
  box(b, mat.white, X(58.2), X(59.6), 2.2, 3.4, Z(2.5), Z(2.9))
  box(b, mat.dark, X(54.8), X(61.8), 3.4, 3.6, Z(-3.2), Z(3.3))
  b.add(new THREE.PlaneGeometry(1.4, 2.2), mat.cool, at(X(58.9), 1.1, Z(2.51)))
  b.add(new THREE.PlaneGeometry(1.4, 2.2), mat.glass, at(X(58.9), 1.1, Z(2.88)))
  sign(kobanSignTexture(), 1.6, 0.5, X(58.9), 2.75, Z(2.93), 0, true)
  b.add(new THREE.SphereGeometry(0.16, 14, 12), mat.red, at(X(58.9), 3.25, Z(3.15)))
  fixture(X(58.9), 3.0, Z(3.6), 0xff3a2a, 2, 5, null, true)
  fixture(X(58.9), 2.0, Z(4.2), 0xe8eeff, 3, 6, null, true)
  sign(
    signTexture(['パトロール中', '', 'ご用の方は', '110番へ'], 256, 220),
    0.5,
    0.42,
    X(58.9),
    0.8,
    Z(2.7),
  )
  // 交番の前の掲示板。特殊詐欺と、交通安全のポスター
  box(b, mat.wood, X(55.4), X(57.6), 0.95, 2.2, Z(2.9), Z(2.96))
  b.add(new THREE.PlaneGeometry(0.62, 0.88), mat.fraud, at(X(56.05), 1.58, Z(2.965)))
  sign(
    signTexture(['交通安全', '', '横断歩道は', '手をあげて', 'わたろう'], 256, 340),
    0.56,
    0.74,
    X(57.0),
    1.56,
    Z(2.965),
  )

  b.build(root)

  // 区画。ロビー (ゲートの奥と手前、ゲートの通路)、ドア、北の歩道、祠の鳥居の前
  const zones = [
    zone('@OB', X(-7.6), X(7.6), Z(-9.6), Z(-3.9), () => 0),
    ...gateX.slice(0, 3).map((x) => zone('@OG', X(x + 0.2), X(x + 1.0), Z(-4.2), Z(-2.2), () => 0)),
    zone('@OL', X(-7.6), X(7.6), Z(-2.4), Z(2.6), () => 0),
    zone('@OD', X(-1.0), X(1.0), Z(2.3), Z(3.9), () => 0),
    zone('@CS', X(-35), X(95), Z(3.5), Z(6.2), () => 0),
    zone('@CJ', X(36.4), X(38.6), Z(1.75), Z(3.6), () => 0),
  ]
  shared.zones.push(...zones)

  return {
    root,
    lobbyDoors,
    signals,
    walkRed: mat.walkRed,
    walkGo: mat.walkGo,
    // ロビーのエレベーターの前。ここから始める
    start: new THREE.Vector3(X(-2.4), 0, Z(-8.6)),
    door: new THREE.Vector3(X(0), 0, Z(3)),
    // 歩道に落ちている鈴と、その場所
    shrine: { bell, at: bell.position.clone() },
    stationOrigin: [X(70), Z(3)],
  }
}
