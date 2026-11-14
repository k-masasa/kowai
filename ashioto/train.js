import * as THREE from 'three'
import { at, box, flat, makeBuilder, tiled, tube, wallX, wallZ, zone } from './kit.js'
import {
  floorTexture,
  meshTexture,
  moquetteTexture,
  trainAdTexture,
  trainDisplay,
} from './textures.js'

// 2両の通勤電車。1両は長さ 20m、幅 2.95m。車内の床はホームと同じ高さ (y = 0)
// 1両目の真ん中を原点にして組み、place() で、ホームの前や走っている場所へ動かす。線路は x の向き
// ホームは +z の側。ドアは片側4つで、+z の側だけ開く
export const CAR = 20
const HALF_W = 1.38
const OUT_W = 1.47
const ROOF = 2.3
export const DOORS = [-7.4, -2.47, 2.47, 7.4]
const DOOR_W = 0.65
const DOOR_H = 1.85
const WIN0 = 0.95
const WIN1 = 1.75
// 窓の並ぶ区間 (ドアとドアのあいだ)
const SECTIONS = [
  [-9.75, -8.05],
  [-6.75, -3.12],
  [-1.82, 1.82],
  [3.12, 6.75],
  [8.05, 9.75],
]

/**
 * 2つの値を、小さい順にして返す
 */
const span = (a, c) => [Math.min(a, c), Math.max(a, c)]

/**
 * 電車を作る
 * @param shared - { zones, fixtures }。建物と同じ並びに足す
 */
export const buildTrain = (scene, shared) => {
  const root = new THREE.Group()
  scene.add(root)
  const b = makeBuilder()

  const mat = {
    floor: tiled(floorTexture(), 2.0, { roughness: 0.6 }),
    panel: new THREE.MeshStandardMaterial({ color: 0xe6e2d8, roughness: 0.6 }),
    ceiling: new THREE.MeshStandardMaterial({ color: 0xf0eee8, roughness: 0.7 }),
    stainless: new THREE.MeshStandardMaterial({
      color: 0xb7bbc0,
      roughness: 0.32,
      metalness: 0.65,
    }),
    pole: new THREE.MeshStandardMaterial({ color: 0xd0d2d4, roughness: 0.25, metalness: 0.8 }),
    stripe: new THREE.MeshStandardMaterial({ color: 0x2e8b57, roughness: 0.5 }),
    roof: new THREE.MeshStandardMaterial({ color: 0x6d7074, roughness: 0.8 }),
    under: new THREE.MeshStandardMaterial({ color: 0x1b1c1e, roughness: 0.9 }),
    seat: tiled(moquetteTexture('#3d6f8f'), 0.5, { roughness: 1 }),
    priority: tiled(moquetteTexture('#8f6a3d'), 0.5, { roughness: 1 }),
    skirt: new THREE.MeshStandardMaterial({ color: 0x3a3c40, roughness: 0.6 }),
    strap: new THREE.MeshStandardMaterial({ color: 0xf2f0ea, roughness: 0.5 }),
    rack: new THREE.MeshStandardMaterial({
      map: meshTexture(),
      alphaTest: 0.5,
      side: THREE.DoubleSide,
      metalness: 0.5,
      roughness: 0.4,
    }),
    glass: new THREE.MeshStandardMaterial({
      color: 0x9fb0bb,
      roughness: 0.05,
      metalness: 0.4,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
    }),
    bellows: new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 1 }),
    light: new THREE.MeshBasicMaterial({ color: 0xf6f8ff }),
  }
  const display = trainDisplay()
  const displayMat = new THREE.MeshBasicMaterial({ map: display.tex })
  const ads = [0, 1, 2, 3].map(
    (k) => new THREE.MeshStandardMaterial({ map: trainAdTexture(k), roughness: 0.7 }),
  )

  // 照明。動かす時に、場所を一緒に動かすので、車の中の座標も覚えておく
  const lights = []

  /**
   * 1両分を組む。cx は、その両の真ん中の x
   */
  const car = (cx, front, rear) => {
    const x0 = cx - CAR / 2 + 0.25
    const x1 = cx + CAR / 2 - 0.25
    flat(b, mat.floor, 0.002, x0, x1, -HALF_W, HALF_W, 1)
    flat(b, mat.ceiling, ROOF, x0, x1, -HALF_W, HALF_W, -1)
    ;[-1, 1].forEach((s) => {
      const zi = s * HALF_W
      const zo = s * OUT_W
      // 窓の並ぶ区間の、窓の下と上、柱、ガラス
      SECTIONS.forEach(([a, c]) => {
        const xa = cx + a
        const xc = cx + c
        wallZ(b, mat.panel, zi, xa, xc, 0, WIN0, -s)
        wallZ(b, mat.panel, zi, xa, xc, WIN1, ROOF, -s)
        wallZ(b, mat.stainless, zo, xa, xc, -1.0, WIN0, s)
        wallZ(b, mat.stainless, zo, xa, xc, WIN1, 2.62, s)
        box(b, mat.stripe, xa, xc, 0.74, 0.9, ...span(zo, zo + s * 0.006))
        // ドアの隣の 0.7m は戸袋なので、窓を開けない
        const ga = xa + (a > -9 ? 0.7 : 0)
        const gc = xc - (c < 9 ? 0.7 : 0)
        ;[
          [xa, ga],
          [gc, xc],
        ].forEach(([p, q]) => {
          if (q - p < 0.01) return
          wallZ(b, mat.panel, zi, p, q, WIN0, WIN1, -s)
          wallZ(b, mat.stainless, zo, p, q, WIN0, WIN1, s)
        })
        const n = Math.max(1, Math.round((gc - ga) / 1.15))
        const step = (gc - ga) / n
        for (let k = 0; k <= n; k++) {
          const px = ga + k * step
          box(b, mat.panel, px - 0.05, px + 0.05, WIN0, WIN1, ...span(zi, zo))
        }
        b.add(
          new THREE.PlaneGeometry(gc - ga, WIN1 - WIN0),
          mat.glass,
          at((ga + gc) / 2, (WIN0 + WIN1) / 2, s * 1.425),
        )
        // ロングシート。端の区間は優先席
        const seat = a < -8 || c > 8 ? mat.priority : mat.seat
        box(b, seat, xa + 0.05, xc - 0.05, 0.36, 0.46, ...span(zi, s * 0.86))
        box(b, seat, xa + 0.05, xc - 0.05, 0.46, 0.98, ...span(zi, s * 1.27))
        box(b, mat.skirt, xa + 0.05, xc - 0.05, 0, 0.36, ...span(s * 0.9, s * 0.88))
        // 網棚
        b.add(
          new THREE.PlaneGeometry(xc - xa, 0.32),
          mat.rack,
          at((xa + xc) / 2, 1.86, s * 1.22, -Math.PI / 2),
        )
        tube(
          b,
          mat.pole,
          new THREE.Vector3(xa, 1.86, s * 1.06),
          new THREE.Vector3(xc, 1.86, s * 1.06),
          0.012,
        )
      })
      // ドアのところの、上の壁と、ドアの上の表示
      DOORS.forEach((d) => {
        const x = cx + d
        wallZ(b, mat.panel, zi, x - DOOR_W - 0.05, x + DOOR_W + 0.05, DOOR_H, ROOF, -s)
        wallZ(b, mat.stainless, zo, x - DOOR_W - 0.05, x + DOOR_W + 0.05, DOOR_H, 2.62, s)
        wallZ(b, mat.stainless, zo, x - DOOR_W - 0.05, x + DOOR_W + 0.05, -1.0, 0, s)
        box(
          b,
          mat.stripe,
          x - DOOR_W - 0.05,
          x + DOOR_W + 0.05,
          2.0,
          2.12,
          ...span(zo, zo + s * 0.006),
        )
        b.add(
          new THREE.PlaneGeometry(0.62, 0.16),
          displayMat,
          at(x, 2.06, zi - s * 0.005, 0, s > 0 ? Math.PI : 0),
        )
        // ドアの両わきの手すり
        ;[-1, 1].forEach((e) => {
          tube(
            b,
            mat.pole,
            new THREE.Vector3(x + e * 0.78, 0, s * 1.1),
            new THREE.Vector3(x + e * 0.78, 2.25, s * 1.1),
            0.017,
          )
        })
      })
      // つり革の棒と、つり革
      tube(
        b,
        mat.pole,
        new THREE.Vector3(x0, 2.06, s * 0.78),
        new THREE.Vector3(x1, 2.06, s * 0.78),
        0.014,
      )
      for (let x = x0 + 0.3; x < x1 - 0.2; x += 0.36) {
        box(
          b,
          mat.strap,
          x - 0.012,
          x + 0.012,
          1.8,
          2.05,
          ...span(s * 0.78 - 0.004, s * 0.78 + 0.004),
        )
        b.add(
          new THREE.TorusGeometry(0.05, 0.008, 6, 14),
          mat.strap,
          at(x, 1.75, s * 0.78, 0, Math.PI / 2),
        )
      }
      // 天井の明かり
      b.add(
        new THREE.PlaneGeometry(x1 - x0 - 0.6, 0.12),
        mat.light,
        at(cx, ROOF - 0.006, s * 0.5, Math.PI / 2),
      )
    })
    // 中づり広告
    for (let x = x0 + 1.6; x < x1 - 1; x += 3.1) {
      const k = Math.floor(Math.abs(x * 7)) % ads.length
      ;[0, Math.PI].forEach((ry) => {
        b.add(
          new THREE.PlaneGeometry(0.52, 0.34),
          ads[k],
          at(x + (ry ? -0.003 : 0.003), 1.98, 0, 0, Math.PI / 2 + ry),
        )
      })
    }
    // 両はしの壁と、貫通扉の窓
    ;[-1, 1].forEach((e) => {
      const xe = cx + e * (CAR / 2 - 0.25)
      wallX(b, mat.panel, xe, -HALF_W, -0.45, 0, ROOF, -e)
      wallX(b, mat.panel, xe, 0.45, HALF_W, 0, ROOF, -e)
      wallX(b, mat.panel, xe, -0.45, 0.45, 1.9, ROOF, -e)
      wallX(b, mat.panel, xe, -0.45, 0.45, 0, 1.0, -e)
      b.add(new THREE.PlaneGeometry(0.7, 0.85), mat.glass, at(xe, 1.45, 0, 0, Math.PI / 2))
      box(b, mat.stainless, xe - 0.02, xe + 0.02, 1.0, 1.9, -0.45, -0.38)
      box(b, mat.stainless, xe - 0.02, xe + 0.02, 1.0, 1.9, 0.38, 0.45)
      const xo = cx + e * (CAR / 2)
      const closed = (e < 0 && front) || (e > 0 && rear)
      if (closed) {
        wallX(b, mat.stainless, xo, -OUT_W, OUT_W, -1.0, 2.62, e)
        return
      }
      wallX(b, mat.stainless, xo, -OUT_W, -0.45, -1.0, 2.62, e)
      wallX(b, mat.stainless, xo, 0.45, OUT_W, -1.0, 2.62, e)
      wallX(b, mat.stainless, xo, -0.45, 0.45, 1.9, 2.62, e)
      wallX(b, mat.stainless, xo, -0.45, 0.45, -1.0, 0, e)
    })
    // 屋根と床下
    box(b, mat.roof, cx - CAR / 2, cx + CAR / 2, 2.62, 2.74, -OUT_W, OUT_W)
    ;[-5, 5].forEach((d) => box(b, mat.roof, cx + d - 1.2, cx + d + 1.2, 2.74, 3.05, -0.9, 0.9))
    box(b, mat.under, cx - CAR / 2 + 0.5, cx + CAR / 2 - 0.5, -1.0, -0.02, -1.3, 1.3)
    // 照明 (本物の光)
    ;[-6, 0, 6].forEach((d) => lights.push({ local: new THREE.Vector3(cx + d, 2.0, 0) }))
  }
  car(0, true, false)
  car(CAR + 0.6, false, true)
  // 2両のあいだの幌。中を通れるように、筒の内側だけ
  wallZ(b, mat.bellows, -0.45, CAR / 2 - 0.25, CAR / 2 + 0.85, 0, 1.9, 1)
  wallZ(b, mat.bellows, 0.45, CAR / 2 - 0.25, CAR / 2 + 0.85, 0, 1.9, -1)
  flat(b, mat.bellows, 1.9, CAR / 2 - 0.25, CAR / 2 + 0.85, -0.45, 0.45, -1)
  flat(b, mat.floor, 0.002, CAR / 2 - 0.25, CAR / 2 + 0.85, -0.45, 0.45, 1)
  b.build(root)

  // ドア。2枚ずつ、x の向きに開く
  const doorMat = mat.stainless
  const doors = []
  ;[0, CAR + 0.6].forEach((cx) => {
    ;[-1, 1].forEach((s) => {
      DOORS.forEach((d) => {
        const panels = [-1, 1].map((e) => {
          const g = new THREE.Group()
          const leaf = new THREE.Mesh(new THREE.BoxGeometry(DOOR_W, DOOR_H, 0.035), doorMat)
          leaf.position.y = DOOR_H / 2
          const win = new THREE.Mesh(new THREE.PlaneGeometry(DOOR_W - 0.2, 0.7), mat.glass)
          win.position.set(0, 1.35, 0.02)
          const win2 = win.clone()
          win2.position.z = -0.02
          win2.rotation.y = Math.PI
          g.add(leaf, win, win2)
          g.userData.home = cx + d + e * (DOOR_W / 2)
          g.userData.side = e
          g.position.set(g.userData.home, 0, s * 1.425)
          root.add(g)
          return g
        })
        doors.push({ panels, side: s, car: cx })
      })
    })
  })

  // 光る部分と区画は、place() のたびに動かす
  const fixtures = lights.map(({ local }) => {
    const f = {
      pos: local.clone(),
      color: new THREE.Color(0xf4f6ff),
      power: 5,
      dist: 9,
      glow: null,
      base: null,
      on: true,
      level: 1,
      stutter: 0,
      faulty: false,
      local,
      train: true,
    }
    shared.fixtures.push(f)
    return f
  })
  // 1両目の通路と、ドアの前。開いている間だけ、ホームへの橋の区画も使う
  const zoneLocal = [
    ['@TA', -9.5, 9.5, -0.8, 0.8],
    ...DOORS.map((d) => ['@TD', d - 0.6, d + 0.6, -1.3, 1.3]),
  ]
  const bridgeLocal = DOORS.map((d) => ['@TB', d - 0.55, d + 0.55, 1.1, 2.2])
  const zones = zoneLocal.map(([tag, a, c, d, e]) => zone(tag, a, c, d, e, () => 0))
  const bridges = bridgeLocal.map(([tag, a, c, d, e]) => {
    const z = zone(tag, a, c, d, e, () => 0)
    z.on = false
    return z
  })
  shared.zones.push(...zones, ...bridges)

  /**
   * 電車を、1両目の真ん中が pos に来るように動かす。区画と照明も一緒に動かす
   */
  const place = (pos) => {
    root.position.copy(pos)
    ;[
      [zones, zoneLocal],
      [bridges, bridgeLocal],
    ].forEach(([list, locals]) => {
      list.forEach((z, k) => {
        const [, a, c, d, e] = locals[k]
        z.x0 = pos.x + a
        z.x1 = pos.x + c
        z.z0 = pos.z + d
        z.z1 = pos.z + e
      })
    })
    fixtures.forEach((f) => f.pos.copy(f.local).add(pos))
  }

  /**
   * ホームの側 (+z) のドアを、開き具合 k (0 から 1) にする。開いている間は、ホームへ渡れる
   */
  const setOpen = (k) => {
    doors.forEach(({ panels, side }) => {
      if (side < 0) return
      panels.forEach((g) => {
        g.position.x = g.userData.home + g.userData.side * DOOR_W * k
      })
    })
    bridges.forEach((z) => {
      z.on = k > 0.8
    })
  }

  return { root, place, setOpen, display, fixtures }
}

/**
 * 走っている間に窓の外を流れる景色。家の明かり、街灯、架線の柱、踏切。電車は止めたまま、景色を動かす
 * @param center - 電車を置く場所 (1両目の真ん中)
 */
export const buildRideScenery = (scene, center) => {
  const group = new THREE.Group()
  group.position.copy(center)
  scene.add(group)
  const dark = new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 1 })
  const windowLit = new THREE.MeshBasicMaterial({ color: 0xd9b77a })
  const windowCool = new THREE.MeshBasicMaterial({ color: 0xbfd6f2 })
  const lamp = new THREE.MeshBasicMaterial({ color: 0xfff1d6 })
  const red = new THREE.MeshBasicMaterial({ color: 0xff2a1a })
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 200),
    new THREE.MeshStandardMaterial({ color: 0x0c0d0f, roughness: 1 }),
  )
  ground.rotation.x = -Math.PI / 2
  ground.position.y = -1.2
  group.add(ground)
  const items = []

  /**
   * 流れる物を1つ足す。make は、その物の Group を作る関数
   */
  const add = (make, x) => {
    const g = make()
    g.position.x = x
    group.add(g)
    items.push({ g, make })
  }

  /**
   * 線路わきの家。暗い箱に、明かりの点いた窓がいくつか
   */
  const house = () => {
    const g = new THREE.Group()
    const side = Math.random() < 0.5 ? -1 : 1
    const z = side * (7 + Math.random() * 22)
    const h = 4 + Math.random() * (Math.random() < 0.2 ? 14 : 5)
    const w = 5 + Math.random() * 6
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, 6), dark)
    body.position.set(0, h / 2 - 1.2, z)
    g.add(body)
    const n = Math.floor(Math.random() * 4)
    for (let k = 0; k < n; k++) {
      const win = new THREE.Mesh(
        new THREE.PlaneGeometry(0.9, 0.7),
        Math.random() < 0.7 ? windowLit : windowCool,
      )
      win.position.set(
        (Math.random() - 0.5) * (w - 1.5),
        0.5 + Math.random() * (h - 2),
        z - side * 3.01,
      )
      win.rotation.y = side > 0 ? Math.PI : 0
      g.add(win)
    }
    return g
  }

  /**
   * 道の街灯
   */
  const streetLamp = () => {
    const g = new THREE.Group()
    const z = (Math.random() < 0.5 ? -1 : 1) * (5 + Math.random() * 6)
    const pole = new THREE.Mesh(new THREE.BoxGeometry(0.12, 6, 0.12), dark)
    pole.position.set(0, 1.8, z)
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), lamp)
    light.position.set(0, 4.8, z)
    g.add(pole, light)
    return g
  }

  /**
   * 架線の柱
   */
  const mast = () => {
    const g = new THREE.Group()
    const pole = new THREE.Mesh(new THREE.BoxGeometry(0.22, 7, 0.22), dark)
    pole.position.set(0, 2.3, -2.4)
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 3.2), dark)
    arm.position.set(0, 5.4, -1.0)
    g.add(pole, arm)
    return g
  }
  for (let k = 0; k < 46; k++) add(house, -200 + Math.random() * 400)
  for (let k = 0; k < 18; k++) add(streetLamp, -200 + Math.random() * 400)
  for (let x = -200; x < 200; x += 50) add(mast, x)

  // 踏切。赤い灯りが交互に点く。cross() で、少し先に出す
  const crossing = new THREE.Group()
  const lights = [-1, 1].map((e) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), red)
    m.position.set(e * 0.3, 2.4, 3.2)
    crossing.add(m)
    return m
  })
  const crossPole = new THREE.Mesh(new THREE.BoxGeometry(0.1, 3, 0.1), dark)
  crossPole.position.set(0, 0.3, 3.2)
  const arm = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.08, 4),
    new THREE.MeshBasicMaterial({ color: 0xd8c43a }),
  )
  arm.position.set(0, 0.9, 5.2)
  crossing.add(crossPole, arm)
  crossing.visible = false
  group.add(crossing)
  let blink = 0

  /**
   * 景色を、速さ speed (m/秒) で後ろへ流す
   */
  const update = (dt, speed) => {
    items.forEach((item) => {
      item.g.position.x -= speed * dt
      if (item.g.position.x > -200) return
      group.remove(item.g)
      item.g = item.make()
      item.g.position.x = 200
      group.add(item.g)
    })
    if (crossing.visible) {
      crossing.position.x -= speed * dt
      if (crossing.position.x < -150) crossing.visible = false
    }
    blink += dt
    const on = Math.floor(blink * 2.4) % 2 === 0
    lights[0].visible = on
    lights[1].visible = !on
  }

  /**
   * 踏切を、x 先に出す
   */
  const cross = (x) => {
    crossing.position.x = x
    crossing.visible = true
  }

  /**
   * 踏切が、窓の外のすぐ近くにあるか (鐘を鳴らすのに使う)
   */
  const crossingNear = () => crossing.visible && Math.abs(crossing.position.x) < 40

  return { group, update, cross, crossingNear }
}
