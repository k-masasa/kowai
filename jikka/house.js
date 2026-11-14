import * as THREE from 'three'
import {
  at,
  box,
  flat,
  gableEnd,
  gableRoof,
  makeBuilder,
  makeWalls,
  stairs,
  tube,
  wallZ,
} from './kit.js'
import { bulb, ringLamp } from './lamps.js'

// 家。母屋 (座敷・茶の間・台所・仏間など)、北の家 (1階がものおき)、東の小屋 (ふろ・洗濯機・トイレ)、南の小屋。
// 住んでいた人の手書きの間取りをもとにしている。分からない所 (2階、部屋の広さ) は仮。
// 1間 = 1.82 m で組む。母屋は x が -3.64 から 9.7、z が -5.46 から 9.1。玄関は東の道の方を向く

// 母屋の床、天井、外壁の上の高さ
const FLOOR = 0.5
const CEIL = 2.9
const WALL_TOP = 3.34
// 母屋の屋根の軒の高さと、軒から棟までの高さ
const EAVE = 3.05
const RISE = 3.4
// 台の脚の太さ
const LEG = 0.05

const TUB = new THREE.CylinderGeometry(0.42, 0.4, 0.58, 24)
const TUB_WATER = new THREE.CircleGeometry(0.38, 24)
const CHABUDAI = new THREE.CylinderGeometry(0.45, 0.45, 0.03, 28)

/**
 * x, y, z の点を作る
 */
const v = (x, y, z) => new THREE.Vector3(x, y, z)

/**
 * 家を組んで scene に足す。ぶつかる線、床、場所の名前、照明の置き場所を返す
 */
export const buildHouse = (scene, mats) => {
  const root = new THREE.Group()
  scene.add(root)
  const b = makeBuilder()
  const c = { b, mats, walls: [], floors: [], places: [], fixtures: [] }
  c.W = makeWalls(b, mats, c.walls)
  buildMain(c)
  buildNorth(c)
  buildBath(c)
  buildSouthShed(c)
  b.build(root)
  return { root, walls: c.walls, floors: c.floors, places: c.places, fixtures: c.fixtures }
}

/**
 * 部屋を1つ足す。床と天井を張り、床の高さと足音の種類、名前を覚える
 * @param r - { name, x: [x0, x1], z: [z0, z1], floor: 床のマテリアル, sound: 足音の種類, y: 床の高さ, ceil: 天井の高さ }
 */
const room = (c, r) => {
  const [x0, x1] = r.x
  const [z0, z1] = r.z
  flat(c.b, r.floor, r.y + 0.002, x0, x1, z0, z1, 1)
  if (r.ceil) {
    flat(c.b, r.ceilMat ?? c.mats.ceiling, r.ceil, x0, x1, z0, z1, -1)
  }
  c.floors.push({ x0, x1, z0, z1, h: r.y, s: r.sound })
  c.places.push({ name: r.name, x0, x1, z0, z1 })
}

/**
 * 家具などの箱を置いて、ぶつかるようにもする
 */
const thing = (c, mat, x0, x1, y0, y1, z0, z1) => {
  box(c.b, mat, x0, x1, y0, y1, z0, z1)
  c.W.rect(x0, x1, z0, z1)
}

/**
 * 脚の付いた台 (座卓や食卓)。天板と4本の脚
 * @param top - 天板の上の高さ
 */
const table = (c, mat, x0, x1, z0, z1, y0, top) => {
  box(c.b, mat, x0, x1, top - 0.03, top, z0, z1)
  const xs = [x0 + 0.04, x1 - 0.04 - LEG]
  const zs = [z0 + 0.04, z1 - 0.04 - LEG]
  xs.forEach((x) => {
    zs.forEach((z) => {
      box(c.b, mat, x, x + LEG, y0, top - 0.03, z, z + LEG)
    })
  })
  c.W.rect(x0, x1, z0, z1)
}

/**
 * 棚。両側の板と、何段かの板
 * @param n - 段の数
 */
const shelf = (c, mat, x0, x1, z0, z1, y0, y1, n) => {
  if (x1 - x0 > z1 - z0) {
    box(c.b, mat, x0, x0 + 0.03, y0, y1, z0, z1)
    box(c.b, mat, x1 - 0.03, x1, y0, y1, z0, z1)
  } else {
    box(c.b, mat, x0, x1, y0, y1, z0, z0 + 0.03)
    box(c.b, mat, x0, x1, y0, y1, z1 - 0.03, z1)
  }
  for (let i = 0; i <= n; i++) {
    const y = y0 + 0.05 + ((y1 - y0 - 0.08) * i) / n
    box(c.b, mat, x0, x1, y, y + 0.025, z0, z1)
  }
  c.W.rect(x0, x1, z0, z1)
}

/**
 * 段ボール箱をいくつか置く
 * @param list - 箱の並び。それぞれ [x0, x1, y0, y1, z0, z1]
 */
const boxes = (c, list) => {
  list.forEach(([x0, x1, y0, y1, z0, z1]) => {
    thing(c, c.mats.cardboard, x0, x1, y0, y1, z0, z1)
  })
}

/**
 * 母屋。座敷が2つ、じいさんのへや、茶の間、台所、玄関、洗面所、仏間、小部屋、ものおき。南と東にろうか
 */
const buildMain = (c) => {
  const { b, mats, W } = c
  // 床下 (土台)
  box(b, mats.base, -3.64, 8.19, 0, FLOOR, -5.46, 4.55)
  box(b, mats.base, 0, 9.1, 0, FLOOR, 4.55, 9.1)
  box(b, mats.base, 8.19, 9.1, 0, FLOOR, -0.91, 4.55)
  // 玄関の土間と外の石段、勝手口の踏み台、ろうかから庭へ下りる沓脱石
  box(b, mats.doma, 8.19, 9.7, 0, 0.18, -3.64, -0.91)
  box(b, mats.stone, 9.7, 10.4, 0, 0.09, -3.05, -1.5)
  box(b, mats.doma, 8.19, 8.85, 0, 0.25, -5.36, -4.62)
  box(b, mats.stone, 9.1, 9.75, 0, 0.25, 5.55, 6.35)
  c.floors.push(
    { x0: -3.64, x1: 8.19, z0: -5.46, z1: 4.55, h: FLOOR, s: 'board' },
    { x0: 0, x1: 9.1, z0: 4.55, z1: 9.1, h: FLOOR, s: 'board' },
    { x0: 8.19, x1: 9.1, z0: -0.91, z1: 4.55, h: FLOOR, s: 'board' },
    { x0: 9.7, x1: 10.4, z0: -3.05, z1: -1.5, h: 0.09, s: 'hard' },
    { x0: 8.19, x1: 8.85, z0: -5.36, z1: -4.62, h: 0.25, s: 'hard' },
    { x0: 9.1, x1: 9.75, z0: 5.55, z1: 6.35, h: 0.25, s: 'hard' },
  )

  // 部屋
  const T = { floor: mats.tatami, sound: 'tatami' }
  const B = { floor: mats.board, sound: 'board' }
  ;[
    { name: '座敷', x: [0.91, 4.55], z: [4.55, 8.19], ...T },
    { name: 'じいさんのへや', x: [4.55, 8.19], z: [4.55, 8.19], ...T },
    { name: '座敷', x: [0, 3.64], z: [0.91, 4.55], ...T },
    { name: '座敷', x: [0, 0.91], z: [0, 0.91], ...B },
    { name: '茶の間', x: [3.64, 8.19], z: [0, 4.55], ...T },
    { name: '台所', x: [0, 4.55], z: [-5.46, 0], ...B },
    { name: '玄関', x: [4.55, 8.19], z: [-4.1, 0], ...B },
    { name: '洗面所', x: [4.55, 8.19], z: [-5.46, -4.1], ...B },
    { name: '仏間', x: [-3.64, 0], z: [-3.64, 0], ...T },
    { name: '小部屋', x: [-3.64, 0], z: [-5.46, -3.64], ...T },
    { name: 'ものおき', x: [-3.64, 0], z: [0, 4.55], ...T },
    { name: 'ろうか', x: [0, 9.1], z: [8.19, 9.1], ...B },
    { name: 'ろうか', x: [8.19, 9.1], z: [-0.91, 8.19], ...B },
    { name: '玄関', x: [8.19, 9.7], z: [-3.64, -0.91], floor: mats.doma, sound: 'hard', y: 0.18 },
  ].forEach((r) => room(c, { y: FLOOR, ceil: CEIL, ...r }))
  // 床の間と押し入れの上の天井。階段の上は、あけておく
  flat(b, mats.ceiling, CEIL, 0, 0.91, 4.55, 8.19, -1)
  // 2階 (天井裏) の床。階段の穴から見える
  const loft = CEIL + 0.2
  flat(b, mats.attic, loft, -3.64, 9.1, -5.46, 0, 1)
  flat(b, mats.attic, loft, -3.64, 0.91, 0, 0.91, 1)
  flat(b, mats.attic, loft, 3.64, 9.1, 0, 0.91, 1)
  flat(b, mats.attic, loft, -3.64, 9.1, 0.91, 4.55, 1)
  flat(b, mats.attic, loft, 0, 9.1, 4.55, 9.1, 1)

  // 外壁
  const y0 = FLOOR
  // 北 (台所と洗面所の外)。流しの上と洗面所に窓
  W.outer({
    axis: 'x',
    at: -5.46,
    from: 1.82,
    to: 8.19,
    y0,
    y1: WALL_TOP,
    out: -1,
    holes: [
      { from: 2.15, to: 3.75, y0: y0 + 1.0, y1: y0 + 1.8 },
      { from: 6.7, to: 7.5, y0: y0 + 1.0, y1: y0 + 1.75 },
    ],
  })
  // 東。洗面所の勝手口
  W.outer({
    axis: 'z',
    at: 8.19,
    from: -5.46,
    to: -3.64,
    y0,
    y1: WALL_TOP,
    out: 1,
    holes: [{ from: -5.36, to: -4.62, y0, y1: y0 + 1.8, door: true }],
  })
  // 玄関 (土間の北と南の壁と、表の戸口)
  W.outer({ axis: 'x', at: -3.64, from: 8.19, to: 9.7, y0: 0.18, y1: 3.0, out: -1 })
  W.outer({
    axis: 'z',
    at: 9.7,
    from: -3.64,
    to: -0.91,
    y0: 0.18,
    y1: 3.0,
    out: 1,
    holes: [{ from: -3.05, to: -1.5, y0: 0.18, y1: 2.25, door: true }],
  })
  W.outer({ axis: 'x', at: -0.91, from: 9.1, to: 9.7, y0: 0.18, y1: 3.0, out: 1 })
  // ろうかのガラス戸。東の1枚は、庭へ下りられるように、あけておく
  W.inner({
    axis: 'z',
    at: 9.1,
    from: -0.91,
    to: 9.1,
    y0,
    y1: WALL_TOP,
    kind: 'glass',
    head: 1.85,
    doors: [[5.55, 6.35]],
  })
  W.inner({ axis: 'x', at: 9.1, from: 0, to: 9.1, y0, y1: WALL_TOP, kind: 'glass', head: 1.85 })
  // 西。床の間と押し入れの裏と、ろうかの西の端
  W.outer({ axis: 'z', at: 0, from: 4.55, to: 9.1, y0, y1: WALL_TOP, out: -1 })
  // 西に張り出した部屋 (ものおき・仏間・小部屋) の南と西
  W.outer({
    axis: 'x',
    at: 4.55,
    from: -3.64,
    to: 0,
    y0,
    y1: WALL_TOP,
    out: 1,
    holes: [{ from: -2.6, to: -1.0, y0: y0 + 0.9, y1: y0 + 1.8 }],
  })
  W.outer({
    axis: 'z',
    at: -3.64,
    from: -5.46,
    to: 4.55,
    y0,
    y1: WALL_TOP,
    out: -1,
    holes: [
      { from: 1.4, to: 3.0, y0: y0 + 0.9, y1: y0 + 1.8 },
      { from: -5.05, to: -4.05, y0: y0 + 0.9, y1: y0 + 1.7 },
    ],
  })
  // 南西の角と北東の角は、屋根の下があいている。柱と桁だけ
  W.post('x', 9.1, -3.64, 0, WALL_TOP)
  box(b, mats.post, -3.7, -3.58, WALL_TOP - 0.24, WALL_TOP, 4.55, 9.16)
  box(b, mats.post, -3.7, 0, WALL_TOP - 0.24, WALL_TOP, 9.04, 9.16)
  W.rect(-3.7, -3.58, 9.04, 9.16)
  W.post('x', -5.46, 9.1, 0, WALL_TOP)
  box(b, mats.post, 9.04, 9.16, WALL_TOP - 0.24, WALL_TOP, -5.52, -3.64)
  box(b, mats.post, 8.19, 9.16, WALL_TOP - 0.24, WALL_TOP, -5.52, -5.4)
  W.rect(9.04, 9.16, -5.52, -5.4)

  /**
   * 母屋の中の壁 (床から天井まで)
   */
  const wall = (axis, pos, from, to, kind, doors = []) =>
    W.inner({ axis, at: pos, from, to, y0: FLOOR, y1: CEIL, kind, doors })
  // 東西に走る壁 (z が一定)
  wall('x', 0, -3.64, 0, 'plaster')
  wall('x', 0, 0, 4.55, 'plaster', [[0.06, 0.86]])
  wall('x', 0, 4.55, 8.19, 'fusuma', [[5.55, 6.46]])
  wall('x', 4.55, 0, 0.91, 'plaster')
  wall('x', 4.55, 0.91, 4.55, 'fusuma', [[3.68, 4.51]])
  wall('x', 4.55, 4.55, 8.19, 'plaster')
  wall('x', 6.37, 0, 0.91, 'plaster')
  wall('x', 8.19, 0, 0.91, 'plaster')
  wall('x', 8.19, 0.91, 4.55, 'shoji', [[2.75, 3.62]])
  wall('x', 8.19, 4.55, 8.19, 'shoji', [[6.4, 7.28]])
  wall('x', -3.64, -3.64, 0, 'fusuma', [[-2.73, -1.82]])
  wall('x', -4.1, 4.55, 8.19, 'plaster', [[7.3, 8.15]])
  // 南北に走る壁 (x が一定)
  wall('z', 0, 0, 4.55, 'fusuma', [[1.82, 2.73]])
  wall('z', 0, -3.64, 0, 'plaster', [[-1.4, -0.5]])
  wall('z', 0, -5.46, -3.64, 'plaster')
  wall('z', 0.91, 4.55, 6.37, 'fusuma')
  wall('z', 3.64, 0, 4.55, 'fusuma', [[2.3, 3.2]])
  wall('z', 4.55, 4.55, 8.19, 'fusuma', [[6.3, 7.2]])
  wall('z', 4.55, -5.46, 0, 'plaster', [[-1.25, -0.35]])
  wall('z', 8.19, 4.55, 8.19, 'shoji', [[5.5, 6.4]])
  wall('z', 8.19, 0, 4.55, 'shoji', [[1.82, 2.73]])
  wall('z', 8.19, -0.91, 0, 'plaster')

  // 床の間。一段高い床、床柱、落とし掛け、掛け軸
  box(b, mats.darkWood, 0.04, 0.91, FLOOR, FLOOR + 0.12, 6.42, 8.14)
  box(b, mats.tokobashira, 0.85, 0.97, FLOOR, CEIL, 6.31, 6.43)
  box(b, mats.frame, 0.86, 0.96, FLOOR + 1.95, FLOOR + 2.02, 6.37, 8.19)
  box(b, mats.plaster, 0.88, 0.94, FLOOR + 2.02, CEIL, 6.37, 8.19)
  b.add(
    new THREE.PlaneGeometry(0.42, 1.45),
    mats.kakejiku,
    at(0.075, FLOOR + 1.25, 7.28, 0, Math.PI / 2),
  )
  W.seg('z', 0.91, 6.37, 8.19)
  // 2階へ上がる階段。まだ上がれない
  stairs(b, mats.board, 0.91, 3.6, 0.06, 0.86, FLOOR, loft, 13, '+x')
  W.seg('x', 0.88, 0.91, 3.64)
  W.seg('z', 0.91, 0, 0.88)

  // 座敷の座卓
  table(c, mats.darkWood, 2.13, 3.33, 5.99, 6.75, FLOOR, FLOOR + 0.33)
  // 茶の間のちゃぶ台と、南の壁ぎわのテレビ
  b.add(CHABUDAI, mats.furniture, at(5.9, FLOOR + 0.315, 2.27))
  ;[
    [5.65, 2.02],
    [6.1, 2.02],
    [5.65, 2.47],
    [6.1, 2.47],
  ].forEach(([x, z]) => box(b, mats.furniture, x, x + LEG, FLOOR, FLOOR + 0.3, z, z + LEG))
  W.rect(5.45, 6.35, 1.82, 2.72)
  thing(c, mats.darkWood, 5.35, 6.35, FLOOR, FLOOR + 0.35, 3.95, 4.47)
  box(b, mats.tv, 5.45, 6.25, FLOOR + 0.35, FLOOR + 0.98, 4.0, 4.45)
  box(b, mats.screen, 5.53, 6.07, FLOOR + 0.43, FLOOR + 0.9, 3.985, 4.0)
  // 台所。北の壁ぎわに流しとコンロ。冷蔵庫、食器棚、食卓
  thing(c, mats.cream, 2.0, 3.8, FLOOR, FLOOR + 0.82, -5.39, -4.79)
  box(b, mats.stainless, 1.98, 3.82, FLOOR + 0.82, FLOOR + 0.86, -5.41, -4.77)
  box(b, mats.screen, 2.45, 3.05, FLOOR + 0.861, FLOOR + 0.865, -5.3, -4.92)
  tube(b, mats.stainless, v(2.75, FLOOR + 0.86, -5.34), v(2.75, FLOOR + 1.12, -5.34), 0.012)
  tube(b, mats.stainless, v(2.75, FLOOR + 1.12, -5.34), v(2.75, FLOOR + 1.08, -5.14), 0.01)
  thing(c, mats.cream, 3.8, 4.48, FLOOR, FLOOR + 0.7, -5.39, -4.79)
  box(b, mats.stove, 3.86, 4.42, FLOOR + 0.7, FLOOR + 0.8, -5.32, -4.86)
  thing(c, mats.white, 0.07, 0.72, FLOOR, FLOOR + 1.55, -4.55, -3.9)
  thing(c, mats.furniture, 0.07, 0.5, FLOOR, FLOOR + 1.8, -3.35, -1.85)
  table(c, mats.furniture, 1.8, 2.6, -3.4, -2.2, FLOOR, FLOOR + 0.72)
  // 玄関。上がった所のたなと、土間の下駄箱
  shelf(c, mats.furniture, 5.0, 7.0, -4.03, -3.65, FLOOR, FLOOR + 1.5, 3)
  thing(c, mats.furniture, 8.25, 9.62, 0.18, 1.05, -3.57, -3.25)
  // 洗面所。歯をみがく流しと鏡
  thing(c, mats.white, 5.3, 6.3, FLOOR, FLOOR + 0.8, -5.39, -4.95)
  box(b, mats.mirror, 5.45, 6.15, FLOOR + 1.05, FLOOR + 1.75, -5.389, -5.383)
  // 仏間の仏壇。扉はあいている
  const [px0, px1, pz0, pz1] = [-3.57, -3.0, -2.42, -1.22]
  box(b, mats.lacquer, px0, px1, FLOOR, FLOOR + 0.45, pz0, pz1)
  box(b, mats.lacquer, px0, px0 + 0.04, FLOOR + 0.45, FLOOR + 1.75, pz0, pz1)
  box(b, mats.lacquer, px0, px1, FLOOR + 0.45, FLOOR + 1.75, pz0, pz0 + 0.04)
  box(b, mats.lacquer, px0, px1, FLOOR + 0.45, FLOOR + 1.75, pz1 - 0.04, pz1)
  box(b, mats.lacquer, px0, px1, FLOOR + 1.71, FLOOR + 1.75, pz0, pz1)
  box(b, mats.gold, px0 + 0.04, px0 + 0.07, FLOOR + 0.5, FLOOR + 1.68, pz0 + 0.06, pz1 - 0.06)
  box(b, mats.gold, px0 + 0.07, px1 - 0.08, FLOOR + 0.9, FLOOR + 0.94, pz0 + 0.04, pz1 - 0.04)
  box(b, mats.lacquer, px1, px1 + 0.55, FLOOR + 0.48, FLOOR + 1.7, pz0, pz0 + 0.025)
  box(b, mats.lacquer, px1, px1 + 0.55, FLOOR + 0.48, FLOOR + 1.7, pz1 - 0.025, pz1)
  W.rect(-3.64, px1 + 0.55, pz0, pz1)
  // ものおき (西に張り出した部屋)。段ボール箱
  boxes(c, [
    [-3.55, -2.95, FLOOR, FLOOR + 0.45, 0.12, 0.66],
    [-3.52, -2.98, FLOOR + 0.45, FLOOR + 0.85, 0.14, 0.62],
    [-3.55, -3.0, FLOOR, FLOOR + 0.4, 0.75, 1.25],
    [-2.9, -2.3, FLOOR, FLOOR + 0.5, 0.1, 0.55],
    [-3.55, -2.75, FLOOR, FLOOR + 0.6, 3.75, 4.45],
    [-2.7, -2.1, FLOOR, FLOOR + 0.42, 3.95, 4.45],
  ])

  /**
   * 部屋の天井の、丸い蛍光灯
   */
  const lamp = (x, z) => ringLamp(b, mats, c.fixtures, x, z, CEIL)
  /**
   * ろうかや土間の、裸電球
   */
  const bare = (x, z) => bulb(b, mats, c.fixtures, x, z, CEIL)
  lamp(2.73, 6.37)
  lamp(6.37, 6.37)
  lamp(1.82, 2.73)
  lamp(5.9, 2.27)
  lamp(2.27, -2.73)
  lamp(6.37, -2.05)
  lamp(-1.82, -1.82)
  lamp(-1.82, 2.27)
  bare(8.95, -2.27)
  bare(6.37, -4.78)
  bare(4.55, 8.65)
  bare(8.65, 4.0)

  // 屋根。棟は南北で、東と西に軒が出る。北と南は妻 (三角の壁)
  gableRoof(b, mats.roofMain, -4.24, 9.7, -5.46, 9.7, EAVE, RISE, 'z')
  gableEnd(b, mats.siding, 'z', -5.535, -3.64, 9.1, WALL_TOP, 3.1, -1)
  gableEnd(b, mats.siding, 'z', 9.175, -3.64, 9.1, WALL_TOP, 3.1, 1)
  // 玄関の庇
  box(b, mats.roofMain, 9.7, 10.65, 2.5, 2.56, -3.45, -1.1)
  ;[-3.35, -1.2].forEach((z) => box(b, mats.frame, 9.7, 10.5, 2.42, 2.5, z - 0.03, z + 0.03))
}

/**
 * 北の家。1階はものおきで、東の壁ぞいに2階へ上がる階段がある。2階はまだ分からないので、上がれない
 */
const buildNorth = (c) => {
  const { b, mats, W } = c
  const [x0, x1, z0, z1] = [-5.46, 1.82, -12.74, -5.46]
  const eave = 5.4
  const rise = 1.9
  const over = 0.45
  const half = (z1 - z0) / 2 + over
  const top = eave + (over * rise) / half
  const floor = 0.1
  const loft = 2.95
  box(b, mats.doma, x0, x1, 0, floor, z0, z1)
  c.floors.push({ x0, x1, z0, z1, h: floor, s: 'hard' })
  c.places.push({ name: '北のものおき', x0, x1, z0, z1 })

  // 外壁。南の壁の、台所の戸口から母屋へ入る
  W.outer({
    axis: 'z',
    at: x0,
    from: z0,
    to: z1,
    y0: 0,
    y1: top,
    out: -1,
    holes: [
      { from: -10.0, to: -8.6, y0: 1.0, y1: 1.9 },
      { from: -10.0, to: -8.6, y0: 3.9, y1: 4.8 },
    ],
  })
  W.outer({
    axis: 'x',
    at: z0,
    from: x0,
    to: x1,
    y0: 0,
    y1: top,
    out: -1,
    holes: [
      { from: -3.2, to: -1.8, y0: 1.0, y1: 1.9 },
      { from: -3.2, to: -1.8, y0: 3.9, y1: 4.8 },
      { from: -0.6, to: 0.8, y0: 3.9, y1: 4.8 },
    ],
  })
  W.outer({
    axis: 'z',
    at: x1,
    from: z0,
    to: z1,
    y0: 0,
    y1: top,
    out: 1,
    holes: [
      { from: -12.55, to: -11.7, y0: floor, y1: 2.0, door: true },
      { from: -7.2, to: -6.2, y0: 1.0, y1: 1.9 },
      { from: -9.8, to: -8.4, y0: 3.9, y1: 4.8 },
    ],
  })
  W.outer({
    axis: 'x',
    at: z1,
    from: x0,
    to: x1,
    y0: 0,
    y1: top,
    out: 1,
    holes: [
      { from: 0.2, to: 1.1, y0: floor, y1: FLOOR + 1.8, door: true },
      { from: -5.1, to: -4.0, y0: 3.9, y1: 4.8 },
    ],
  })
  // 母屋の台所と小部屋から見える側は、土壁にする
  wallZ(b, mats.plaster, -5.388, -3.64, 0.2, FLOOR, CEIL, 1)
  wallZ(b, mats.plaster, -5.388, 1.1, 1.82, FLOOR, CEIL, 1)
  wallZ(b, mats.plaster, -5.388, 0.2, 1.1, FLOOR + 1.8, CEIL, 1)

  // 1階の天井と2階の床。階段の上はあけておく
  const [hx0, hz0, hz1] = [0.91, -11.3, -7.5]
  flat(b, mats.ceiling, 2.8, x0, x1, z0, hz0, -1)
  flat(b, mats.ceiling, 2.8, x0, x1, hz1, z1, -1)
  flat(b, mats.ceiling, 2.8, x0, hx0, hz0, hz1, -1)
  flat(b, mats.attic, loft, x0, x1, z0, hz0, 1)
  flat(b, mats.attic, loft, x0, x1, hz1, z1, 1)
  flat(b, mats.attic, loft, x0, hx0, hz0, hz1, 1)
  // 2階へ上がる階段。下は北の端で、中庭への戸口のそば
  stairs(b, mats.board, 0.97, 1.75, -11.2, -7.6, floor, loft, 14, '+z')
  W.rect(0.95, 1.82, -11.22, -7.58)

  // ものおきの中。棚、たんす、箱
  shelf(c, mats.furniture, x0 + 0.1, x0 + 0.6, -12.5, -10.1, floor, 2.0, 3)
  thing(c, mats.furniture, -2.6, -1.4, floor, 1.3, z0 + 0.08, z0 + 0.55)
  boxes(c, [
    [-5.3, -4.6, floor, floor + 0.5, -7.3, -6.6],
    [-5.27, -4.65, floor + 0.5, floor + 0.88, -7.25, -6.65],
    [-4.5, -3.9, floor, floor + 0.45, -6.3, -5.65],
    [-1.2, -0.4, floor, floor + 0.55, -12.6, -12.02],
  ])
  bulb(b, mats, c.fixtures, -1.8, -9.1, 2.8)

  // 屋根。棟は東西
  gableRoof(b, mats.roofRed, x0 - over, x1 + over, z0 - over, z1 + over, eave, rise, 'x')
  gableEnd(b, mats.siding, 'x', x0 - 0.075, z0, z1, top, rise - (over * rise) / half, -1)
  gableEnd(b, mats.siding, 'x', x1 + 0.075, z0, z1, top, rise - (over * rise) / half, 1)
}

/**
 * 東の小屋。南の端にまきを焚く所、その北にふろ、さらに北に洗濯機の所。東の半分は物置の小屋で、南東の角にトイレ
 */
const buildBath = (c) => {
  const { b, mats, W } = c
  const [x0, x1, z0, z1] = [9.1, 16.38, -12.74, -5.46]
  const xm = 12.74
  const eave = 2.6
  const rise = 1.5
  const over = 0.5
  const half = (x1 - x0) / 2 + over
  const top = eave + (over * rise) / half
  // 床
  box(b, mats.dirt, x0, xm, 0, 0.05, -7.28, z1)
  box(b, mats.bathTile, x0, xm, 0, 0.15, -10.92, -7.28)
  box(b, mats.concrete, x0, xm, 0, 0.15, z0, -10.92)
  box(b, mats.concrete, xm, x1, 0, 0.05, z0, z1)
  box(b, mats.bathTile, 14.56, x1, 0.05, 0.15, -7.28, z1)
  c.floors.push(
    { x0, x1: xm, z0: -7.28, z1, h: 0.05, s: 'ground' },
    { x0, x1: xm, z0: -10.92, z1: -7.28, h: 0.15, s: 'hard' },
    { x0, x1: xm, z0, z1: -10.92, h: 0.15, s: 'hard' },
    { x0: xm, x1, z0, z1, h: 0.05, s: 'hard' },
    { x0: 14.56, x1, z0: -7.28, z1, h: 0.15, s: 'hard' },
  )
  c.places.push(
    { name: 'まきを焚く所', x0, x1: xm, z0: -7.28, z1 },
    { name: 'ふろ', x0, x1: xm, z0: -10.92, z1: -7.28 },
    { name: '洗濯機の所', x0, x1: xm, z0, z1: -10.92 },
    { name: 'トイレ', x0: 14.56, x1, z0: -7.28, z1 },
    { name: '小屋', x0: xm, x1, z0, z1 },
  )

  // 外壁 (板張り)
  const board = { mat: mats.shedBoard, inner: mats.shedBoard }
  W.outer({
    axis: 'x',
    at: z1,
    from: x0,
    to: x1,
    y0: 0,
    y1: top,
    out: 1,
    ...board,
    holes: [
      { from: 9.55, to: 10.45, y0: 0.05, y1: 1.85, door: true },
      { from: 15.0, to: 15.75, y0: 0.15, y1: 1.85, door: true },
    ],
  })
  W.outer({
    axis: 'z',
    at: x0,
    from: z0,
    to: z1,
    y0: 0,
    y1: top,
    out: -1,
    ...board,
    holes: [
      { from: -6.95, to: -6.1, y0: 0.05, y1: 1.85, door: true },
      { from: -10.2, to: -8.7, y0: 1.2, y1: 1.8 },
      { from: -12.3, to: -11.3, y0: 1.0, y1: 1.7 },
    ],
  })
  W.outer({
    axis: 'x',
    at: z0,
    from: x0,
    to: x1,
    y0: 0,
    y1: top,
    out: -1,
    ...board,
    holes: [{ from: 13.5, to: 14.8, y0: 1.0, y1: 1.7 }],
  })
  W.outer({
    axis: 'z',
    at: x1,
    from: z0,
    to: z1,
    y0: 0,
    y1: top,
    out: 1,
    ...board,
    holes: [
      { from: -11.2, to: -9.2, y0: 0.05, y1: 2.1, door: true },
      { from: -6.7, to: -6.1, y0: 1.4, y1: 1.8 },
    ],
  })

  /**
   * 小屋の中の板壁
   */
  const wall = (axis, pos, from, to, doors = []) =>
    W.inner({
      axis,
      at: pos,
      from,
      to,
      y0: 0,
      y1: top,
      kind: 'plaster',
      mat: mats.shedBoard,
      doors,
    })
  wall('x', -7.28, x0, xm, [[11.8, 12.6]])
  wall('x', -10.92, x0, xm, [[9.5, 10.35]])
  wall('z', xm, z0, z1, [[-12.45, -11.6]])
  wall('x', -7.28, 14.56, x1)
  wall('z', 14.56, -7.28, z1)
  flat(b, mats.cream, 2.3, x0, xm, -10.92, -7.28, -1)
  flat(b, mats.cream, 2.3, x0, xm, z0, -10.92, -1)
  flat(b, mats.cream, 2.3, 14.56, x1, -7.28, z1, -1)

  // ふろおけ。まきを焚くかまどの上に、鉄のおけが乗る。焚き口は、まきを焚く所の側にある
  box(b, mats.block, 10.45, 11.45, 0.15, 0.62, -8.42, -7.33)
  b.add(TUB, mats.iron, at(10.95, 0.91, -7.88))
  b.add(TUB_WATER, mats.water, at(10.95, 1.205, -7.88, -Math.PI / 2))
  W.rect(10.45, 11.45, -8.42, -7.33)
  box(b, mats.iron, 10.62, 11.28, 0.06, 0.56, -7.235, -7.225)
  box(b, mats.black, 10.7, 11.2, 0.1, 0.48, -7.225, -7.2)
  tube(b, mats.iron, v(11.35, 0.62, -8.3), v(11.35, top + 1.6, -8.3), 0.06)
  box(b, mats.furniture, 9.3, 10.3, 0.15, 0.19, -10.7, -8.6)
  // 洗濯機 (2つの槽があるもの)
  thing(c, mats.white, 11.55, 12.4, 0.15, 1.05, -12.66, -12.2)
  box(b, mats.gray, 11.6, 11.96, 1.05, 1.075, -12.6, -12.26)
  box(b, mats.gray, 12.0, 12.35, 1.05, 1.075, -12.6, -12.26)
  // トイレ (和式)
  box(b, mats.white, 15.3, 15.66, 0.15, 0.22, -6.98, -6.36)
  box(b, mats.black, 15.37, 15.59, 0.221, 0.224, -6.88, -6.5)
  // まき
  thing(c, mats.logs, 12.2, 12.68, 0.05, 1.15, -7.2, -5.6)
  // 小屋の中の箱
  boxes(c, [
    [15.6, 16.28, 0.05, 0.62, -12.62, -12.0],
    [15.7, 16.25, 0.62, 1.0, -12.55, -12.05],
    [13.0, 13.7, 0.05, 0.5, -12.62, -12.05],
  ])
  // 明かり
  bulb(b, mats, c.fixtures, 10.9, -6.4, 3.3)
  bulb(b, mats, c.fixtures, 10.9, -9.1, 2.3)
  bulb(b, mats, c.fixtures, 10.9, -11.8, 2.3)
  bulb(b, mats, c.fixtures, 14.6, -9.8, 3.3)
  bulb(b, mats, c.fixtures, 15.47, -6.4, 2.3)

  // 屋根。棟は南北
  gableRoof(b, mats.roofShed, x0 - over, x1 + over, z0 - over, z1 + over, eave, rise, 'z')
  gableEnd(b, mats.shedBoard, 'z', z0 - 0.075, x0, x1, top, rise - (over * rise) / half, -1)
  gableEnd(b, mats.shedBoard, 'z', z1 + 0.075, x0, x1, top, rise - (over * rise) / half, 1)
}

/**
 * 南の小屋。東があいていて、中に作業台がある
 */
const buildSouthShed = (c) => {
  const { b, mats, W } = c
  const [x0, x1, z0, z1] = [10, 14, 13, 18]
  const eave = 2.3
  const rise = 0.9
  const over = 0.4
  const half = (x1 - x0) / 2 + over
  const top = eave + (over * rise) / half
  box(b, mats.dirt, x0, x1, 0, 0.03, z0, z1)
  c.floors.push({ x0, x1, z0, z1, h: 0.03, s: 'ground' })
  c.places.push({ name: '南の小屋', x0, x1, z0, z1 })
  W.solid({ axis: 'x', at: z0, from: x0, to: x1, y0: 0, y1: top, mat: mats.shedBoard, t: 0.05 })
  W.solid({ axis: 'x', at: z1, from: x0, to: x1, y0: 0, y1: top, mat: mats.shedBoard, t: 0.05 })
  W.solid({ axis: 'z', at: x0, from: z0, to: z1, y0: 0, y1: top, mat: mats.shedBoard, t: 0.05 })
  // 東は柱だけ
  ;[z0, (z0 + z1) / 2, z1].forEach((z) => {
    box(b, mats.post, x1 - 0.06, x1 + 0.06, 0, top, z - 0.06, z + 0.06)
    W.rect(x1 - 0.06, x1 + 0.06, z - 0.06, z + 0.06)
  })
  box(b, mats.post, x1 - 0.06, x1 + 0.06, top - 0.18, top, z0, z1)
  table(c, mats.furniture, x0 + 0.08, x0 + 0.78, 14.2, 16.6, 0.03, 0.8)
  boxes(c, [
    [12.9, 13.6, 0.03, 0.5, 17.3, 17.92],
    [13.0, 13.5, 0.5, 0.85, 17.35, 17.85],
  ])
  bulb(b, mats, c.fixtures, 12, 15.5, top + 0.3)
  gableRoof(b, mats.roofBrown, x0 - over, x1 + over, z0 - over, z1 + over, eave, rise, 'z')
  gableEnd(b, mats.shedBoard, 'z', z0 - 0.03, x0, x1, top, rise - (over * rise) / half, -1)
  gableEnd(b, mats.shedBoard, 'z', z1 + 0.03, x0, x1, top, rise - (over * rise) / half, 1)
}
