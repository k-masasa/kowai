import * as THREE from 'three'
import {
  at,
  box,
  boxWithout,
  flat,
  gableEnd,
  gableRoof,
  makeBuilder,
  makeWalls,
  slantWall,
  stairs,
  tube,
  wallX,
  wallZ,
} from './kit.js'
import {
  CEIL,
  FLOOR,
  FLOOR_KINDS,
  GENKAN,
  LANDING,
  N_FLOOR,
  N_LOFT,
  N_UP,
  WALL_TOP,
  WASH,
} from './layout.js'

// 家。母屋 (座敷・茶の間・台所・仏間など)、北の家 (1階がものおき)、東の小屋 (ふろ・洗濯機・トイレ)、南の小屋。
// 住んでいた人の手書きの間取りをもとにしている。分からない所 (母屋の2階、部屋の広さ) は仮。
// 部屋の床の種類と、壁 (戸口と窓) は layout.js のデータから組む。ここにあるのは、それ以外の骨組み
// (土台、石段、床の間、仏壇の棚、階段、屋根など)

// 母屋の屋根の軒の高さと、軒から棟までの高さ
const EAVE = 2.68
const RISE = 3.77

const TUB = new THREE.CylinderGeometry(0.42, 0.4, 0.58, 24)
const TUB_WATER = new THREE.CircleGeometry(0.38, 24)
const KNOB = new THREE.SphereGeometry(0.028, 10, 8)

/**
 * x, y, z の点を作る
 */
const v = (x, y, z) => new THREE.Vector3(x, y, z)

/**
 * 家を、組み直せる入れ物を作る。build に間取りのデータを渡すと、前の家を捨てて組み直し、
 * ぶつかる線、床、場所の名前を返す
 */
export const createHouse = (scene, mats) => {
  let root = null

  /**
   * 前に組んだ家の形を捨てる (マテリアルは使い回すので捨てない)
   */
  const clear = () => {
    if (!root) return
    root.traverse((o) => {
      if (o.geometry) {
        o.geometry.dispose()
      }
    })
    scene.remove(root)
  }

  /**
   * 間取りのデータから、家を組む
   */
  const build = (layout) => {
    clear()
    root = new THREE.Group()
    scene.add(root)
    const b = makeBuilder()
    const c = { b, mats, layout, walls: [], floors: [], places: [] }
    c.W = makeWalls(b, mats, c.walls)
    buildMain(c)
    buildRooms(c)
    buildDataWalls(c)
    buildMainAfter(c)
    buildNorth(c)
    buildBath(c)
    buildSouthShed(c)
    b.build(root)
    return { walls: c.walls, floors: c.floors, places: c.places }
  }

  return { build }
}

/**
 * 部屋を組む。床と天井を張り、床の高さと足音の種類、名前を覚える
 */
const buildRooms = (c) => {
  c.layout.rooms.forEach((r) => {
    const [x0, x1] = r.x
    const [z0, z1] = r.z
    const y = r.y ?? FLOOR
    const kind = FLOOR_KINDS[r.floor] ?? FLOOR_KINDS.board
    flat(c.b, c.mats[kind.mat], y + 0.002, x0, x1, z0, z1, 1)
    flat(c.b, c.mats.ceiling, r.ceil ?? CEIL, x0, x1, z0, z1, -1)
    c.floors.push({ x0, x1, z0, z1, h: y, s: kind.sound })
    c.places.push({ name: r.name, x0, x1, z0, z1 })
  })
}

/**
 * 壁を、データから組む。inner の壁の戸口は、y0 から head までの高さ
 */
const buildDataWalls = (c) => {
  const { W, mats } = c
  c.layout.walls.forEach((w) => {
    if (w.type === 'inner') {
      W.inner({
        axis: w.axis,
        at: w.at,
        from: w.from,
        to: w.to,
        y0: w.y0 ?? FLOOR,
        y1: w.y1 ?? CEIL,
        kind: w.kind,
        head: w.head,
        koshi: w.koshi,
        mat: w.mat ? mats[w.mat] : undefined,
        pane: w.pane ? mats[w.pane] : undefined,
        doors: w.holes.map((h) => [h.from, h.to]),
      })
      return
    }
    if (w.type === 'solid') {
      W.solid({ ...w, mat: mats[w.mat], holes: w.holes })
      return
    }
    W.outer({
      ...w,
      mat: w.mat ? mats[w.mat] : undefined,
      inner: w.inner ? mats[w.inner] : undefined,
    })
    if (w.cover) {
      cover(c, w)
    }
  })
}

/**
 * 外壁の外側の一部を、土壁の面でおおう (となりの建物の部屋から見える所)。戸口の所は、戸口の上だけ
 */
const cover = (c, w) => {
  const { from, to, y0, y1 } = w.cover
  const face = w.at + w.out * 0.072
  /**
   * 壁の面を1枚張る
   */
  const plane = (a0, a1, b0, b1) => {
    if (a1 - a0 < 0.01 || b1 - b0 < 0.01) return
    if (w.axis === 'x') {
      wallZ(c.b, c.mats.plaster, face, a0, a1, b0, b1, w.out)
      return
    }
    wallX(c.b, c.mats.plaster, face, a0, a1, b0, b1, w.out)
  }
  const doors = w.holes
    .filter((h) => h.door && h.to > from && h.from < to)
    .sort((p, q) => p.from - q.from)
  let cur = from
  doors.forEach((h) => {
    plane(cur, h.from, y0, y1)
    plane(Math.max(h.from, from), Math.min(h.to, to), h.y1, y1)
    cur = Math.max(cur, h.to)
  })
  plane(cur, to, y0, y1)
}

/**
 * 母屋の骨組みのうち、部屋と壁より先に置くもの。土台、土間、石段、大きな床の四角
 */
const buildMain = (c) => {
  const { b, mats } = c
  // 床下 (土台)。玄関の板の間は一段低い。台所のコンロの横は一段下がり、洗面所はさらに下がって、
  // ほぼ外と同じ高さ
  boxWithout(
    b,
    mats.base,
    [-3.64, 8.19, 0, FLOOR, -5.46, 4.55],
    [
      [3.64, 4.55, LANDING, 1, -5.5, -4.55],
      [4.55, 8.2, WASH, 1, -5.5, -4.1],
      [4.55, 8.2, GENKAN, 1, -4.1, 0],
    ],
  )
  box(b, mats.base, 0, 9.1, 0, FLOOR, 4.55, 9.1)
  box(b, mats.base, 8.19, 9.1, 0, GENKAN, -3.64, -0.91)
  box(b, mats.base, 8.19, 9.1, 0, FLOOR, -0.91, 4.55)
  // 玄関の土間と、表の戸口の前の石段。土間の広さと戸口の場所は、layout.js のデータに合わせる
  const doma = c.layout.rooms.find((r) => r.id === 'doma')
  const [dx0, dx1] = doma.x
  const [dz0, dz1] = doma.z
  const door = c.layout.walls.find((w) => w.id === 'doma-e').holes.find((h) => h.door)
  box(b, mats.doma, dx0, dx1, 0, doma.y, dz0, dz1)
  box(b, mats.stone, dx1, dx1 + 0.7, 0, 0.09, door.from, door.to)
  c.floors.push(
    { x0: -3.64, x1: 8.19, z0: -5.46, z1: 4.55, h: FLOOR, s: 'board' },
    { x0: 0, x1: 9.1, z0: 4.55, z1: 9.1, h: FLOOR, s: 'board' },
    { x0: 8.19, x1: 9.1, z0: -3.64, z1: 4.55, h: FLOOR, s: 'board' },
    { x0: dx1, x1: dx1 + 0.7, z0: door.from, z1: door.to, h: 0.09, s: 'hard' },
  )
}

/**
 * 母屋の骨組みのうち、部屋と壁のあとに置くもの。天井裏、玄関の斜めの壁と段、床の間、階段、仏壇の棚、
 * 屋根、土間の屋根
 */
const buildMainAfter = (c) => {
  const { b, mats, W } = c
  // 床の間と押し入れ、仏間の奥の押し入れと仏壇の上の天井。階段の上は、あけておく
  flat(b, mats.ceiling, CEIL, 0, 0.91, 4.55, 8.19, -1)
  flat(b, mats.ceiling, CEIL, -3.64, 0, -5.46, -4.55, -1)
  // 2階 (天井裏) の床。階段の穴から見える
  const loft = CEIL + 0.2
  flat(b, mats.attic, loft, -3.64, 9.1, -5.46, 0, 1)
  flat(b, mats.attic, loft, -3.64, 0.91, 0, 0.91, 1)
  flat(b, mats.attic, loft, 3.64, 9.1, 0, 0.91, 1)
  flat(b, mats.attic, loft, -3.64, 9.1, 0.91, 4.55, 1)
  flat(b, mats.attic, loft, 0, 9.1, 4.55, 9.1, 1)

  // 玄関の北の、母屋の屋根の下のすき間は、斜めの壁でふさぐ
  /**
   * 母屋の屋根の東側の、x の所の屋根板の下の高さ
   */
  const roofY = (x) => EAVE + ((10.45 - x) * RISE) / 7.72 - 0.04
  slantWall(b, mats.siding, 'x', -3.675, 8.19, 9.1, 3.3, roofY(8.19), roofY(9.1))
  // 上がり框と、その上の小壁
  box(b, mats.frame, 9.04, 9.16, 0.18, GENKAN, -3.64, -0.91)
  box(b, mats.frame, 9.04, 9.16, 2.45, 2.55, -3.64, -0.91)
  box(b, mats.plaster, 9.06, 9.14, 2.55, CEIL, -3.64, -0.91)
  // 玄関の板の間から、茶の間・台所・ろうかへ上がる段の、前の板
  box(b, mats.frame, 4.55, 8.19, GENKAN, FLOOR, -0.03, 0)
  box(b, mats.frame, 4.55, 4.6, GENKAN, FLOOR, -4.1, 0)
  box(b, mats.frame, 8.19, 9.1, GENKAN, FLOOR, -0.94, -0.91)

  // 南西の角と北東の角は、屋根の下があいている。柱と桁だけ
  W.post('x', 9.1, -3.64, 0, WALL_TOP)
  box(b, mats.post, -3.7, -3.58, WALL_TOP - 0.24, WALL_TOP, 4.55, 9.16)
  box(b, mats.post, -3.7, 0, WALL_TOP - 0.24, WALL_TOP, 9.04, 9.16)
  W.rect(-3.7, -3.58, 9.04, 9.16)
  W.post('x', -5.46, 9.1, 0, WALL_TOP)
  box(b, mats.post, 9.04, 9.16, WALL_TOP - 0.24, WALL_TOP, -5.52, -3.64)
  box(b, mats.post, 8.19, 9.16, WALL_TOP - 0.24, WALL_TOP, -5.52, -5.4)
  W.rect(9.04, 9.16, -5.52, -5.4)

  // 床の間。一段高い床、床柱、落とし掛け
  box(b, mats.darkWood, 0.04, 0.91, FLOOR, FLOOR + 0.12, 6.42, 8.14)
  box(b, mats.tokobashira, 0.85, 0.97, FLOOR, CEIL, 6.31, 6.43)
  box(b, mats.frame, 0.86, 0.96, FLOOR + 1.95, FLOOR + 2.02, 6.37, 8.19)
  box(b, mats.plaster, 0.88, 0.94, FLOOR + 2.02, CEIL, 6.37, 8.19)
  W.seg('z', 0.91, 6.37, 8.19)
  // 2階へ上がる階段。まだ上がれない
  stairs(b, mats.board, 0.91, 3.6, 0.06, 0.86, FLOOR, loft, 13, '+x')
  W.seg('x', 0.88, 0.91, 3.64)
  W.seg('z', 0.91, 0, 0.88)
  // 仏壇を置く棚。前に落とし掛けと小壁があり、床は一段高い板
  box(b, mats.darkWood, -1.82, 0, FLOOR, FLOOR + 0.08, -5.46, -4.55)
  box(b, mats.frame, -1.82, 0, FLOOR + 1.95, FLOOR + 2.02, -4.6, -4.5)
  box(b, mats.plaster, -1.82, 0, FLOOR + 2.02, CEIL, -4.585, -4.515)
  W.seg('x', -4.55, -1.82, 0)
  // 玄関の部屋から洗面所へ下りる戸口の、踏み台 (戸口の場所に合わせる)
  const step = (GENKAN + WASH) / 2
  const door = c.layout.walls.find((w) => w.id === 'genkan-wash')
  door?.holes.forEach((h) => {
    box(b, mats.doma, h.from, h.to, WASH, step, -4.5, -4.15)
    c.floors.push({ x0: h.from, x1: h.to, z0: -4.5, z1: -4.1, h: step, s: 'hard' })
  })

  // 屋根。棟は南北で、東と西に軒が出る。北と南は妻 (三角の壁)
  gableRoof(b, mats.roofMain, -4.99, 10.45, -5.46, 9.7, EAVE, RISE, 'z')
  gableEnd(b, mats.siding, 'z', -5.535, -3.64, 9.1, WALL_TOP, 3.1, -1)
  gableEnd(b, mats.siding, 'z', 9.175, -3.64, 9.1, WALL_TOP, 3.1, 1)
  // 土間の屋根。母屋の屋根の下から東へ突き出す切妻で、棟は東西。表の戸口の上まで出る。
  // 土間の壁の上の高さ (layout.js の 2.68) は、この屋根の軒の線に合わせてある
  const doma = c.layout.rooms.find((r) => r.id === 'doma')
  const [dx0, dx1] = doma.x
  const [dz0, dz1] = doma.z
  const over = 0.35
  const eave = 2.53
  const rise = 0.72
  const wallTop = eave + (over * rise) / ((dz1 - dz0) / 2 + over)
  gableRoof(b, mats.roofEntry, dx0, dx1 + 0.6, dz0 - over, dz1 + over, eave, rise, 'x')
  gableEnd(b, mats.siding, 'x', dx1 + 0.075, dz0, dz1, wallTop, eave + rise - wallTop, 1)
}

/**
 * 北の家の骨組み。1階はものおきで、東の壁ぞいに2階へ上がる階段がある。
 * 上がった所の左 (西) に扉、右 (東) に窓。扉の先の部屋はまだ分からないので、あかない
 */
const buildNorth = (c) => {
  const { b, mats, W } = c
  const [x0, x1, z0, z1] = [-5.46, 1.82, -12.74, -5.46]
  const eave = 5.4
  const rise = 1.9
  const over = 0.45
  const half = (z1 - z0) / 2 + over
  const top = eave + (over * rise) / half
  box(b, mats.doma, x0, x1, 0, N_FLOOR, z0, z1)
  c.floors.push({ x0, x1, z0, z1, h: N_FLOOR, s: 'hard' })

  // 1階の天井と2階の床。階段の上はあけておく
  const [hx0, hz0, hz1] = [0.91, -10.1, -6.3]
  flat(b, mats.ceiling, 2.8, x0, x1, z0, hz0, -1)
  flat(b, mats.ceiling, 2.8, x0, x1, hz1, z1, -1)
  flat(b, mats.ceiling, 2.8, x0, hx0, hz0, hz1, -1)
  flat(b, mats.attic, N_LOFT, x0, x1, z0, hz0, 1)
  flat(b, mats.attic, N_LOFT, x0, x1, hz1, z1, 1)
  flat(b, mats.attic, N_LOFT, x0, hx0, hz0, hz1, 1)
  // 2階へ上がる階段。台所の戸口から入って、そのまま北へ上がる。足元の高さは、段の高さをなめらかにつなぐ
  const [sx0, sx1, sz0, sz1] = [0.97, 1.75, -10.0, -6.4]
  stairs(b, mats.board, sx0, sx1, sz0, sz1, N_FLOOR, N_LOFT, 14, '-z')
  c.floors.push(
    {
      x0: sx0,
      x1: sx1,
      z0: sz0,
      z1: sz1,
      h: (x, z) => N_FLOOR + ((sz1 - z) / (sz1 - sz0)) * (N_LOFT - N_FLOOR),
      s: 'board',
    },
    { x0: hx0, x1, z0: -11.2, z1: sz0, h: N_LOFT, s: 'board' },
  )
  W.seg('z', sx0, sz0, sz1)
  tube(b, mats.frame, v(1.0, N_FLOOR + 0.85, sz1 - 0.05), v(1.0, N_LOFT + 0.85, sz0), 0.02)
  box(b, mats.frame, 0.98, 1.02, N_FLOOR, N_FLOOR + 0.85, sz1 - 0.07, sz1 - 0.03)
  // 穴のふち
  box(b, mats.post, hx0 - 0.05, hx0 + 0.05, 2.8, N_LOFT, hz0, hz1)
  box(b, mats.post, hx0, x1, 2.8, N_LOFT, hz1 - 0.05, hz1 + 0.05)
  // 2階の天井と、上がった所の左の扉
  flat(b, mats.ceiling, N_UP, hx0, x1, -11.2, hz1, -1)
  box(b, mats.darkWood, 0.96, 0.99, N_LOFT, N_LOFT + 1.85, -11.05, -10.2)
  box(b, mats.frame, 0.95, 1.0, N_LOFT + 1.85, N_LOFT + 1.9, -11.08, -10.17)
  b.add(KNOB, mats.stainless, at(1.01, N_LOFT + 0.95, -10.33))
  c.places.push(
    { name: '北の家の2階', x0: hx0, x1, z0: -11.2, z1: sz0 },
    { name: '北の家の階段', x0: sx0, x1: sx1, z0: sz0, z1: sz1 },
    { name: '北のものおき', x0, x1, z0, z1 },
  )

  // 屋根。棟は東西
  gableRoof(b, mats.roofRed, x0 - over, x1 + over, z0 - over, z1 + over, eave, rise, 'x')
  gableEnd(b, mats.siding, 'x', x0 - 0.075, z0, z1, top, rise - (over * rise) / half, -1)
  gableEnd(b, mats.siding, 'x', x1 + 0.075, z0, z1, top, rise - (over * rise) / half, 1)
}

/**
 * 東の小屋の骨組み。南の端にまきを焚く所、その北にふろ、さらに北に洗濯機の所。東の3分の2は物置の小屋で、
 * 南東の角にトイレ。東西に長い (6間)
 */
const buildBath = (c) => {
  const { b, mats, W } = c
  const [x0, x1, z0, z1] = [9.1, 20.02, -12.74, -5.46]
  // ふろの側と小屋の境、トイレの西の壁
  const xm = 12.74
  const xt = x1 - 1.82
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
  box(b, mats.bathTile, xt, x1, 0.05, 0.15, -7.28, z1)
  c.floors.push(
    { x0, x1: xm, z0: -7.28, z1, h: 0.05, s: 'ground' },
    { x0, x1: xm, z0: -10.92, z1: -7.28, h: 0.15, s: 'hard' },
    { x0, x1: xm, z0, z1: -10.92, h: 0.15, s: 'hard' },
    { x0: xm, x1, z0, z1, h: 0.05, s: 'hard' },
    { x0: xt, x1, z0: -7.28, z1, h: 0.15, s: 'hard' },
  )
  c.places.push(
    { name: 'まきを焚く所', x0, x1: xm, z0: -7.28, z1 },
    { name: 'ふろ', x0, x1: xm, z0: -10.92, z1: -7.28 },
    { name: '洗濯機の所', x0, x1: xm, z0, z1: -10.92 },
    { name: 'トイレ', x0: xt, x1, z0: -7.28, z1 },
    { name: '小屋', x0: xm, x1, z0, z1 },
  )
  flat(b, mats.cream, 2.3, x0, xm, -10.92, -7.28, -1)
  flat(b, mats.cream, 2.3, x0, xm, z0, -10.92, -1)
  flat(b, mats.cream, 2.3, xt, x1, -7.28, z1, -1)

  // ふろおけ。まきを焚くかまどの上に、鉄のおけが乗る。焚き口は、まきを焚く所の側にある
  box(b, mats.block, 10.45, 11.45, 0.15, 0.62, -8.42, -7.33)
  b.add(TUB, mats.iron, at(10.95, 0.91, -7.88))
  b.add(TUB_WATER, mats.water, at(10.95, 1.205, -7.88, -Math.PI / 2))
  W.rect(10.45, 11.45, -8.42, -7.33)
  box(b, mats.iron, 10.62, 11.28, 0.06, 0.56, -7.235, -7.225)
  box(b, mats.black, 10.7, 11.2, 0.1, 0.48, -7.225, -7.2)
  tube(b, mats.iron, v(11.35, 0.62, -8.3), v(11.35, top + 1.6, -8.3), 0.06)

  // 屋根。棟は南北
  gableRoof(b, mats.roofShed, x0 - over, x1 + over, z0 - over, z1 + 0.1, eave, rise, 'z')
  gableEnd(b, mats.shedBoard, 'z', z0 - 0.075, x0, x1, top, rise - (over * rise) / half, -1)
  gableEnd(b, mats.shedBoard, 'z', z1 + 0.075, x0, x1, top, rise - (over * rise) / half, 1)
}

/**
 * 南の小屋の骨組み。東があいていて、柱だけ
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
  ;[z0, (z0 + z1) / 2, z1].forEach((z) => {
    box(b, mats.post, x1 - 0.06, x1 + 0.06, 0, top, z - 0.06, z + 0.06)
    W.rect(x1 - 0.06, x1 + 0.06, z - 0.06, z + 0.06)
  })
  box(b, mats.post, x1 - 0.06, x1 + 0.06, top - 0.18, top, z0, z1)
  gableRoof(b, mats.roofBrown, x0 - over, x1 + over, z0 - over, z1 + over, eave, rise, 'z')
  gableEnd(b, mats.shedBoard, 'z', z0 - 0.03, x0, x1, top, rise - (over * rise) / half, -1)
  gableEnd(b, mats.shedBoard, 'z', z1 + 0.03, x0, x1, top, rise - (over * rise) / half, 1)
}
