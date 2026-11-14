import * as THREE from 'three'
import { at, box, flat, makeBuilder, tiled, wallX, wallZ, zone } from './kit.js'
import {
  ballastTexture,
  ceilingTexture,
  clockFace,
  concreteTexture,
  departureBoardTexture,
  fareChartTexture,
  gateTopTexture,
  meshTexture,
  signTexture,
  stationBoardTexture,
  stationNameTexture,
  stationPosterTexture,
  stoneTileTexture,
  tactileTexture,
  wallTexture,
} from './textures.js'

// 地上の小さな駅。駅舎の南の入口が道に面し、改札を抜けた北にホーム、その北に線路が2本と向かいのホームがある。
// 線路は x の向き。座標は、駅舎の入口の真ん中 (ox, 0, oz) からの相対で決める
// ホームの縁 (z = -14) から、手前の線路の真ん中までが 1.5m。電車の床は、ホームと同じ高さ
export const TRACK1 = -15.5
export const TRACK2 = -19.5

/**
 * 駅を1つ作る
 * @param o - { origin: [ox, oz], name, kana, roman, prev, next, color, departures, tag }
 *   prev / next は [ひらがな, 漢字]、departures は発車標の行、tag は区画の名前の頭 (例: '@H')
 * @param shared - { zones, fixtures }。建物と同じ並びに足す
 */
export const buildStation = (scene, o, shared) => {
  const [ox, oz] = o.origin
  const X = (x) => ox + x
  const Z = (z) => oz + z
  const root = new THREE.Group()
  scene.add(root)
  const b = makeBuilder()

  const mat = {
    floor: tiled(stoneTileTexture(), 1.2, { roughness: 0.35 }),
    wall: tiled(wallTexture(), 2.0),
    ceiling: tiled(ceilingTexture(), 2.0, { roughness: 1 }),
    concrete: tiled(concreteTexture(), 1.5),
    tactile: tiled(tactileTexture(), 0.3, { roughness: 0.7 }),
    ballast: tiled(ballastTexture(), 1.0, { roughness: 1 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x868b90, roughness: 0.5, metalness: 0.5 }),
    rail: new THREE.MeshStandardMaterial({ color: 0x8f8c86, roughness: 0.35, metalness: 0.8 }),
    sleeper: new THREE.MeshStandardMaterial({ color: 0x77736c, roughness: 0.9 }),
    white: new THREE.MeshStandardMaterial({ color: 0xe6e5e0, roughness: 0.6 }),
    edge: new THREE.MeshStandardMaterial({ color: 0xd7d4cc, roughness: 0.7 }),
    gate: new THREE.MeshStandardMaterial({ color: 0xc9ccd0, roughness: 0.35, metalness: 0.3 }),
    gateTop: new THREE.MeshStandardMaterial({ map: gateTopTexture(), roughness: 0.4 }),
    machine: new THREE.MeshStandardMaterial({ color: 0x3f6f8f, roughness: 0.4, metalness: 0.3 }),
    screen: new THREE.MeshBasicMaterial({ color: 0x9fd0ff }),
    glass: new THREE.MeshStandardMaterial({
      color: 0x223038,
      roughness: 0.1,
      metalness: 0.6,
    }),
    bench: new THREE.MeshStandardMaterial({ color: 0x3c6e9e, roughness: 0.5 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x1d1e21, roughness: 0.9 }),
    fence: new THREE.MeshStandardMaterial({
      map: meshTexture(),
      alphaTest: 0.5,
      side: THREE.DoubleSide,
      metalness: 0.4,
      roughness: 0.5,
    }),
    nameSign: new THREE.MeshBasicMaterial({ map: stationNameTexture(o.name + '駅', o.roman) }),
    board: new THREE.MeshStandardMaterial({ map: stationBoardTexture(o), roughness: 0.5 }),
    fare: new THREE.MeshStandardMaterial({
      map: fareChartTexture(o.fares),
      roughness: 0.6,
      emissive: 0x333333,
    }),
    departures: new THREE.MeshBasicMaterial({ map: departureBoardTexture(o.departures, o.note) }),
    glow: new THREE.MeshBasicMaterial({ color: 0xf3f7ff }),
  }

  /**
   * 照明を1つ。光る部分と、あとで本物の光を割り当てるための印
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
    shared.fixtures.push(f)
    return f
  }

  /**
   * 天井の蛍光灯。x の向きに細長い
   */
  const tube = (x, y, z, len = 1.2, power = 3, dist = 6) => {
    box(
      b,
      mat.white,
      x - len / 2 - 0.04,
      x + len / 2 + 0.04,
      y - 0.02,
      y + 0.04,
      z - 0.07,
      z + 0.07,
    )
    const glow = new THREE.Mesh(new THREE.BoxGeometry(len, 0.03, 0.06), mat.glow.clone())
    glow.position.set(x, y - 0.03, z)
    root.add(glow)
    return fixture(x, y - 0.25, z, 0xeef3ff, power, dist, glow)
  }

  // ---------- 駅舎 ----------
  const H = 3.6
  flat(b, mat.floor, 0.002, X(-7), X(7), Z(-10), Z(0), 1)
  // 南の入口のある面 (外と中)
  ;[
    [-7, -2.5],
    [2.5, 7],
  ].forEach(([a, c]) => {
    wallZ(b, mat.wall, Z(0.01), X(a), X(c), 0, H, 1)
    wallZ(b, mat.wall, Z(-0.01), X(a), X(c), 0, H, -1)
  })
  wallZ(b, mat.wall, Z(0.01), X(-2.5), X(2.5), 2.6, H, 1)
  wallZ(b, mat.wall, Z(-0.01), X(-2.5), X(2.5), 2.6, 3.0, -1)
  b.add(new THREE.PlaneGeometry(5.2, 0.6), mat.nameSign, at(X(0), 3.05, Z(0.03)))
  fixture(X(0), 2.4, Z(1.2), 0xe8eeff, 3, 6, null).outdoor = true
  // 東西の壁と、北のホームへの口
  wallX(b, mat.wall, X(-7), Z(-10), Z(0), 0, H, 1)
  wallX(b, mat.wall, X(7), Z(-10), Z(0), 0, H, -1)
  wallX(b, mat.wall, X(-7.01), Z(-10), Z(0), 0, H, -1)
  wallX(b, mat.wall, X(7.01), Z(-10), Z(0), 0, H, 1)
  ;[
    [-7, -2.5],
    [2.5, 7],
  ].forEach(([a, c]) => {
    wallZ(b, mat.wall, Z(-10), X(a), X(c), 0, 3.0, 1)
    wallZ(b, mat.wall, Z(-10.01), X(a), X(c), 0, H, -1)
  })
  wallZ(b, mat.wall, Z(-10), X(-2.5), X(2.5), 2.6, 3.0, 1)
  wallZ(b, mat.wall, Z(-10.01), X(-2.5), X(2.5), 2.6, H, -1)
  // 天井と屋根
  flat(b, mat.ceiling, 3.0, X(-7), X(7), Z(-10), Z(0), -1)
  box(b, mat.concrete, X(-7.3), X(7.3), H, H + 0.22, Z(-10.3), Z(0.7))
  tube(X(-3), 2.98, Z(-2.5), 1.6)
  tube(X(1.5), 2.98, Z(-2.5), 1.6)
  tube(X(0), 2.98, Z(-8.2), 1.6)

  // 券売機と運賃表 (西の壁)
  ;[-3.3, -2.3].forEach((z) => {
    box(b, mat.machine, X(-7), X(-6.35), 0, 1.75, Z(z - 0.42), Z(z + 0.42))
    b.add(new THREE.PlaneGeometry(0.5, 0.36), mat.screen, at(X(-6.345), 1.2, Z(z), 0, Math.PI / 2))
    box(b, mat.dark, X(-6.36), X(-6.34), 0.55, 0.85, Z(z - 0.3), Z(z + 0.3))
  })
  b.add(new THREE.PlaneGeometry(3.4, 1.05), mat.fare, at(X(-6.99), 2.25, Z(-2.8), 0, Math.PI / 2))

  // 駅員室 (東)。窓口は閉まっている
  box(b, mat.wall, X(4), X(4.1), 0, 3.0, Z(-6), Z(-1))
  box(b, mat.wall, X(4), X(7), 0, 3.0, Z(-6.1), Z(-6))
  b.add(new THREE.PlaneGeometry(1.4, 0.8), mat.glass, at(X(3.995), 1.4, Z(-3.5), 0, -Math.PI / 2))
  box(b, mat.white, X(3.75), X(4.0), 0.95, 1.0, Z(-4.3), Z(-2.7))
  const closed = new THREE.Mesh(
    new THREE.PlaneGeometry(0.42, 0.3),
    new THREE.MeshStandardMaterial({
      map: signTexture(['窓口', '', '本日の営業は', '終了しました'], 256, 200),
      roughness: 0.7,
    }),
  )
  closed.position.set(X(3.99), 1.4, Z(-3.5))
  closed.rotation.y = -Math.PI / 2
  root.add(closed)

  // 改札。4つの通路と、その両わきの仕切り
  const gateX = [-2.4, -1.2, 0, 1.2, 2.4]
  gateX.forEach((x) => {
    box(b, mat.gate, X(x - 0.13), X(x + 0.13), 0, 0.98, Z(-6.7), Z(-5.3))
    b.add(new THREE.PlaneGeometry(0.26, 1.4), mat.gateTop, at(X(x), 0.985, Z(-6), -Math.PI / 2))
  })
  box(b, mat.gate, X(-7), X(-2.53), 0, 1.0, Z(-6.05), Z(-5.95))
  box(b, mat.gate, X(2.53), X(4), 0, 1.0, Z(-6.05), Z(-5.95))
  b.add(new THREE.PlaneGeometry(2.6, 0.65), mat.departures, at(X(0), 2.55, Z(-5.6)))
  box(b, mat.dark, X(-1.35), X(1.35), 2.2, 2.9, Z(-5.66), Z(-5.62))
  // 時計と、ポスター
  const clock = clockFace()
  const face = new THREE.Mesh(
    new THREE.CircleGeometry(0.2, 32),
    new THREE.MeshStandardMaterial({ map: clock.tex, roughness: 0.5 }),
  )
  face.position.set(X(0), 2.75, Z(-9.97))
  root.add(face)
  ;['rush', 'last', 'ic'].forEach((kind, k) => {
    const poster = new THREE.Mesh(
      new THREE.PlaneGeometry(0.5, 0.7),
      new THREE.MeshStandardMaterial({ map: stationPosterTexture(kind), roughness: 0.7 }),
    )
    poster.position.set(X(-6.99), 1.5, Z(-5.2 - k * 0.7))
    poster.rotation.y = Math.PI / 2
    root.add(poster)
  })

  // ---------- ホーム ----------
  const P0 = -40
  const P1 = 40
  box(b, mat.concrete, X(P0), X(P1), -1.2, 0, Z(-14), Z(-10))
  flat(b, mat.concrete, 0.003, X(P0), X(P1), Z(-14), Z(-10), 1)
  flat(b, mat.tactile, 0.006, X(P0), X(P1), Z(-13.55), Z(-13.25), 1)
  box(b, mat.edge, X(P0), X(P1), -0.02, 0.012, Z(-14), Z(-13.88))
  // 屋根と柱、蛍光灯
  ;[-12, -4, 4, 12].forEach((x) =>
    box(b, mat.steel, X(x - 0.08), X(x + 0.08), 0, 3.2, Z(-11.4), Z(-11.24)),
  )
  box(b, mat.steel, X(-16), X(16), 3.2, 3.32, Z(-13.8), Z(-10))
  for (let x = -14; x <= 14; x += 4) tube(X(x), 3.18, Z(-12.2), 1.2, 4.5, 9)
  // 駅名標 (両面) と、ベンチ、ごみ箱
  ;[
    [Z(-12.95), 0],
    [Z(-12.97), Math.PI],
  ].forEach(([z, ry]) => {
    b.add(new THREE.PlaneGeometry(1.8, 0.63), mat.board, at(X(7.5), 1.95, z, 0, ry))
  })
  ;[6.55, 8.45].forEach((x) =>
    box(b, mat.steel, X(x - 0.03), X(x + 0.03), 0, 2.3, Z(-12.99), Z(-12.93)),
  )
  ;[-7, 9.5].forEach((x) => {
    box(b, mat.bench, X(x - 0.9), X(x + 0.9), 0.42, 0.47, Z(-10.75), Z(-10.3))
    box(b, mat.bench, X(x - 0.9), X(x + 0.9), 0.47, 0.85, Z(-10.33), Z(-10.27))
    ;[-0.8, 0.8].forEach((d) =>
      box(b, mat.steel, X(x + d - 0.03), X(x + d + 0.03), 0, 0.42, Z(-10.6), Z(-10.4)),
    )
  })
  box(b, mat.steel, X(-11), X(-10.6), 0, 0.85, Z(-10.6), Z(-10.2))
  // ホームと家のあいだの柵
  ;[
    [P0, -7.3],
    [7.3, P1],
  ].forEach(([a, c]) => {
    b.add(new THREE.PlaneGeometry(c - a, 1.5), mat.fence, at(X((a + c) / 2), 0.75, Z(-9.85)))
    for (let x = a; x <= c; x += 2.5)
      box(b, mat.steel, X(x - 0.03), X(x + 0.03), 0, 1.55, Z(-9.88), Z(-9.82))
  })

  // ---------- 線路と、向かいのホーム ----------
  const L0 = -160
  const L1 = 160
  flat(b, mat.ballast, -1.2, X(L0), X(L1), Z(-23.5), Z(-14), 1)
  ;[TRACK1, TRACK2].forEach((tz) => {
    ;[-0.534, 0.534].forEach((d) => {
      box(b, mat.rail, X(L0), X(L1), -1.12, -1.04, Z(tz + d - 0.035), Z(tz + d + 0.035))
    })
    for (let x = L0; x < L1; x += 0.65) {
      box(b, mat.sleeper, X(x), X(x + 0.2), -1.2, -1.12, Z(tz - 1.0), Z(tz + 1.0))
    }
  })
  // 架線の柱と線
  for (let x = -150; x <= 150; x += 50) {
    box(b, mat.steel, X(x - 0.1), X(x + 0.1), -1.2, 5.6, Z(-17.6), Z(-17.4))
    box(b, mat.steel, X(x - 0.06), X(x + 0.06), 5.2, 5.32, Z(-21), Z(-14))
  }
  ;[TRACK1, TRACK2].forEach((tz) => {
    box(b, mat.dark, X(L0), X(L1), 4.6, 4.62, Z(tz - 0.01), Z(tz + 0.01))
    box(b, mat.dark, X(L0), X(L1), 5.15, 5.17, Z(tz - 0.01), Z(tz + 0.01))
  })
  // 向かいのホーム
  box(b, mat.concrete, X(P0), X(P1), -1.2, 0, Z(-24), Z(-21))
  flat(b, mat.concrete, 0.003, X(P0), X(P1), Z(-24), Z(-21), 1)
  flat(b, mat.tactile, 0.006, X(P0), X(P1), Z(-21.75), Z(-21.45), 1)
  box(b, mat.edge, X(P0), X(P1), -0.02, 0.012, Z(-21.12), Z(-21))
  box(b, mat.steel, X(-12), X(12), 3.2, 3.32, Z(-24), Z(-21.2))
  ;[-8, 0, 8].forEach((x) =>
    box(b, mat.steel, X(x - 0.08), X(x + 0.08), 0, 3.2, Z(-23.4), Z(-23.24)),
  )
  for (let x = -10; x <= 10; x += 5) tube(X(x), 3.18, Z(-22.3), 1.2, 4, 9)
  b.add(new THREE.PlaneGeometry(1.8, 0.63), mat.board, at(X(-6), 1.95, Z(-23.3)))
  b.add(new THREE.PlaneGeometry(P1 - P0, 1.6), mat.fence, at(X(0), 0.8, Z(-24.2)))

  b.build(root)

  // 区画。入口、改札の手前、改札の4つの通路、改札の奥、ホーム
  const t = o.tag
  const zones = [
    zone(`${t}E`, X(-2.3), X(2.3), Z(-0.6), Z(1.35), () => 0),
    zone(`${t}G`, X(-6.3), X(3.7), Z(-5.55), Z(-0.4), () => 0),
    ...gateX
      .slice(0, 4)
      .map((x, k) => zone(`${t}T`, X(x + 0.2), X(x + 1.0), Z(-6.9), Z(-5.1), () => 0)),
    zone(`${t}N`, X(-2.3), X(2.3), Z(-10.3), Z(-6.5), () => 0),
    zone(`${t}P`, X(P0 + 1), X(P1 - 1), Z(-13.5), Z(-10.25), () => 0),
  ]
  shared.zones.push(...zones)

  return {
    root,
    clock,
    // 電車が止まる場所 (手前の線路の、駅舎の真ん中の前)
    stop: new THREE.Vector3(X(0), 0, Z(TRACK1)),
    far: new THREE.Vector3(X(0), 0, Z(-22.5)),
  }
}
