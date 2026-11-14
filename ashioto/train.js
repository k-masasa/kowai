import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { at, box, flat, makeBuilder, tiled, tube, wallX, wallZ, zone } from './kit.js'
import {
  frontSignTexture,
  glareTexture,
  moquetteTexture,
  stainlessTexture,
  stationBoardTexture,
  trainAdTexture,
  trainDisplay,
  trainFloorTexture,
  trainWallTexture,
  ventTexture,
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
// 窓の上の壁は SHOULDER_Y から内側へ倒れ、真ん中から CEIL_Z の所で平らな天井につながる (肩)
const SHOULDER_Y = 1.98
const CEIL_Z = 1.0
const SLANT = Math.atan2(HALF_W - CEIL_Z, ROOF - SHOULDER_Y)
const SLANT_LEN = Math.hypot(HALF_W - CEIL_Z, ROOF - SHOULDER_Y)
// 窓の並ぶ区間 (ドアとドアのあいだ)
const SECTIONS = [
  [-9.75, -8.05],
  [-6.75, -3.12],
  [-1.82, 1.82],
  [3.12, 6.75],
  [8.05, 9.75],
]

// 車輪 (軸は z の向きに回して置く) と、台車の空気ばね
const WHEEL = new THREE.CylinderGeometry(0.43, 0.43, 0.12, 24)
const SPRING = new THREE.CylinderGeometry(0.13, 0.13, 0.2, 14)

/**
 * 2つの値を、小さい順にして返す
 */
const span = (a, c) => [Math.min(a, c), Math.max(a, c)]

/**
 * 肩に、板を1枚貼る。広告や、ドアの上の表示もここに貼る
 * @param s - 側。+z なら 1、-z なら -1
 * @param t0 - 肩の下の端を 0、上の端を 1 とした、貼る範囲の下の端
 * @param t1 - 貼る範囲の上の端
 * @param lift - 肩の面から、車内の側へ浮かせる長さ (m)
 */
const onShoulder = (b, mat, x0, x1, s, t0, t1, lift = 0) => {
  const t = (t0 + t1) / 2
  const y = SHOULDER_Y + (ROOF - SHOULDER_Y) * t - Math.sin(SLANT) * lift
  const z = s * (HALF_W - (HALF_W - CEIL_Z) * t - Math.cos(SLANT) * lift)
  b.add(
    new THREE.PlaneGeometry(x1 - x0, (t1 - t0) * SLANT_LEN),
    mat,
    at((x0 + x1) / 2, y, z, s > 0 ? -SLANT : SLANT, s > 0 ? Math.PI : 0),
  )
}

/**
 * 電車を作る
 * @param shared - { zones, fixtures }。建物と同じ並びに足す
 */
export const buildTrain = (scene, shared) => {
  const root = new THREE.Group()
  scene.add(root)
  const b = makeBuilder()

  const mat = {
    floor: tiled(trainFloorTexture(false), 0.6, { roughness: 0.75 }),
    aisle: tiled(trainFloorTexture(true), 0.6, { roughness: 0.7 }),
    panel: tiled(trainWallTexture(), 1.2, { roughness: 0.45 }),
    ceiling: tiled(trainWallTexture(), 1.2, { roughness: 0.6 }),
    vent: tiled(ventTexture(), 0.5, { roughness: 0.7 }),
    lampFrame: new THREE.MeshStandardMaterial({ color: 0xdcdbd6, roughness: 0.5 }),
    // ドアと、車内の金属の部分。走り出したら、車内の映り込みを付ける (capture)
    stainless: new THREE.MeshStandardMaterial({
      color: 0xb7bbc0,
      roughness: 0.32,
      metalness: 0.65,
    }),
    // 車体の外側のステンレス。外は車内と違う景色なので、車内の映り込みではなく、外の映り込みを付ける (lightOutside)
    skin: tiled(stainlessTexture(), 1.5, { roughness: 0.3, metalness: 0.7 }),
    // 正面。窓まわりの黒、前面ガラス、行き先の表示、前照灯と尾灯、そのにじみ、連結器
    mask: new THREE.MeshStandardMaterial({ color: 0x131518, roughness: 0.25, metalness: 0.4 }),
    windshield: new THREE.MeshStandardMaterial({
      color: 0x050607,
      roughness: 0.04,
      metalness: 0.7,
    }),
    destHead: new THREE.MeshBasicMaterial({ map: frontSignTexture('普通 月見台') }),
    destTail: new THREE.MeshBasicMaterial({ map: frontSignTexture('') }),
    headLamp: new THREE.MeshBasicMaterial({ color: 0xfff4dc }),
    tailLamp: new THREE.MeshBasicMaterial({ color: 0xff2a1e }),
    glare: new THREE.SpriteMaterial({
      map: glareTexture(),
      color: 0xfff1d8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
    }),
    coupler: new THREE.MeshStandardMaterial({ color: 0x2a2b2e, roughness: 0.6, metalness: 0.5 }),
    // 床下の機器と台車、車輪、パンタグラフ
    equip: new THREE.MeshStandardMaterial({ color: 0x2c2e31, roughness: 0.8 }),
    bogie: new THREE.MeshStandardMaterial({ color: 0x232426, roughness: 0.75, metalness: 0.2 }),
    wheel: new THREE.MeshStandardMaterial({ color: 0x5c5d5f, roughness: 0.45, metalness: 0.75 }),
    panto: new THREE.MeshStandardMaterial({ color: 0x8c9196, roughness: 0.5, metalness: 0.6 }),
    trim: new THREE.MeshStandardMaterial({ color: 0xc4c7ca, roughness: 0.3, metalness: 0.7 }),
    pole: new THREE.MeshStandardMaterial({ color: 0xd0d2d4, roughness: 0.25, metalness: 0.8 }),
    stripe: new THREE.MeshStandardMaterial({ color: 0x2e8b57, roughness: 0.5 }),
    roof: new THREE.MeshStandardMaterial({ color: 0x6d7074, roughness: 0.8 }),
    under: new THREE.MeshStandardMaterial({ color: 0x1b1c1e, roughness: 0.9 }),
    seat: tiled(moquetteTexture('#3d6f8f'), 0.5, { roughness: 1 }),
    priority: tiled(moquetteTexture('#8f6a3d'), 0.5, { roughness: 1 }),
    partition: new THREE.MeshStandardMaterial({ color: 0xdedcd5, roughness: 0.35 }),
    heater: new THREE.MeshStandardMaterial({ color: 0x55585c, roughness: 0.6, metalness: 0.3 }),
    // 座席の下の床に落ちる影。床の上に、うすい黒を重ねる
    shade: new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
    }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x18191b, roughness: 0.85 }),
    sill: new THREE.MeshStandardMaterial({ color: 0xa9adb1, roughness: 0.35, metalness: 0.6 }),
    yellow: new THREE.MeshStandardMaterial({ color: 0xd9ad1f, roughness: 0.7 }),
    threshold: new THREE.MeshStandardMaterial({ color: 0x8e9195, roughness: 0.4, metalness: 0.7 }),
    // 運転台の窓の向こう。暗くて見えない
    cab: new THREE.MeshBasicMaterial({ color: 0x050506 }),
    adFrame: new THREE.MeshStandardMaterial({ color: 0xb9bcbf, roughness: 0.35, metalness: 0.5 }),
    screenOff: new THREE.MeshStandardMaterial({ color: 0x0b0c0e, roughness: 0.15, metalness: 0.3 }),
    strap: new THREE.MeshStandardMaterial({ color: 0xf2f0ea, roughness: 0.5 }),
    // 窓ガラス。外をほんの少し暗くして、走り出したら車内がうっすら映り込む。外の明かりが見えるくらいに弱く
    glass: new THREE.MeshBasicMaterial({
      color: 0x000000,
      combine: THREE.MixOperation,
      reflectivity: 0.5,
      transparent: true,
      opacity: 0.2,
      depthWrite: false,
      side: THREE.DoubleSide,
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
   * ロングシートを1つ。座面と背もたれ、下の暖房の覆い、床に落ちる影、
   * ドアの側の端の袖仕切りと手すり、7人掛けを 2・3・2 人に分ける縦の手すり
   * @param ends - [西の端, 東の端] のうち、ドアの隣で袖仕切りを置く端
   */
  const seat = (xa, xc, s, priority, ends) => {
    const mq = priority ? mat.priority : mat.seat
    const a = xa + (ends[0] ? 0.07 : 0.03)
    const c = xc - (ends[1] ? 0.07 : 0.03)
    const len = c - a
    const mid = (a + c) / 2
    b.add(new RoundedBoxGeometry(len, 0.12, 0.48, 2, 0.045), mq, at(mid, 0.4, s * 1.1))
    b.add(new RoundedBoxGeometry(len, 0.5, 0.11, 2, 0.045), mq, at(mid, 0.75, s * 1.3, s * 0.1))
    box(b, mat.heater, a, c, 0.06, 0.33, ...span(s * 0.97, s * 1.36))
    flat(b, mat.shade, 0.007, a - 0.03, c + 0.03, ...span(s * 0.78, s * HALF_W), 1)
    ends.forEach((on, k) => {
      if (!on) return
      const x = k === 0 ? xa + 0.03 : xc - 0.03
      b.add(new RoundedBoxGeometry(0.045, 1.22, 0.56, 2, 0.02), mat.partition, at(x, 0.63, s * 1.1))
      tube(
        b,
        mat.pole,
        new THREE.Vector3(x, 0, s * 0.82),
        new THREE.Vector3(x, ROOF, s * 0.82),
        0.017,
      )
    })
    if (len < 3) return
    ;[2 / 7, 5 / 7].forEach((f) => {
      const x = a + len * f
      tube(
        b,
        mat.pole,
        new THREE.Vector3(x, 0.46, s * 0.86),
        new THREE.Vector3(x, ROOF, s * 0.86),
        0.015,
      )
    })
  }

  /**
   * 網棚。壁から腕を出して、細い棒を4本と、手前の太い棒を渡す
   */
  const rack = (xa, xc, s) => {
    for (let x = xa + 0.2; x < xc - 0.1; x += 1.2) {
      box(b, mat.pole, x - 0.012, x + 0.012, 1.79, 1.84, ...span(s * 1.04, s * HALF_W))
    }
    ;[1.12, 1.19, 1.26, 1.33].forEach((z) => {
      tube(
        b,
        mat.pole,
        new THREE.Vector3(xa, 1.83, s * z),
        new THREE.Vector3(xc, 1.83, s * z),
        0.006,
      )
    })
    tube(
      b,
      mat.pole,
      new THREE.Vector3(xa, 1.85, s * 1.06),
      new THREE.Vector3(xc, 1.85, s * 1.06),
      0.013,
    )
  }

  /**
   * 運転台のある端の、正面の顔。黒い窓まわりに大きな前面ガラス、上に行き先の表示、
   * 下のすみに前照灯 (先頭) か尾灯 (うしろ)、帯、下にスカートと連結器
   * @param xo - 車体の端の x
   * @param e - 外を向く向き。+x なら 1
   * @param head - 走る向きの先頭なら true
   */
  const cabFront = (xo, e, head) => {
    wallX(b, mat.skin, xo, -OUT_W, OUT_W, -1.0, 1.0, e)
    wallX(b, mat.mask, xo, -OUT_W, OUT_W, 1.0, 2.62, e)
    ;[-1, 1].forEach((side) => {
      wallX(b, mat.windshield, xo + e * 0.004, ...span(side * 0.07, side * 1.28), 1.15, 2.08, e)
    })
    wallX(b, head ? mat.destHead : mat.destTail, xo + e * 0.004, -0.55, 0.55, 2.2, 2.46, e)
    box(b, mat.stripe, ...span(xo, xo + e * 0.006), 0.74, 0.9, -OUT_W, OUT_W)
    ;[-1, 1].forEach((side) => {
      const lamp = head ? mat.headLamp : mat.tailLamp
      box(b, lamp, ...span(xo, xo + e * 0.012), 0.97, 1.09, ...span(side * 0.85, side * 1.25))
      if (!head) return
      const glow = new THREE.Sprite(mat.glare)
      glow.position.set(xo + e * 0.05, 1.03, side * 1.05)
      glow.scale.set(1.1, 1.1, 1)
      root.add(glow)
    })
    box(b, mat.under, ...span(xo - e * 0.05, xo + e * 0.18), -0.95, -0.3, -1.15, 1.15)
    box(b, mat.coupler, ...span(xo, xo + e * 0.38), -0.62, -0.42, -0.14, 0.14)
  }

  /**
   * 台車。横の枠と真ん中のはり、車輪2組と車軸、空気ばね
   */
  const bogie = (x) => {
    ;[-1, 1].forEach((side) => {
      box(b, mat.bogie, x - 1.3, x + 1.3, -0.78, -0.55, ...span(side * 0.88, side * 1.0))
      b.add(SPRING, mat.rubber, at(x, -0.42, side * 0.94))
    })
    box(b, mat.bogie, x - 0.25, x + 0.25, -0.62, -0.45, -1.0, 1.0)
    ;[-1.05, 1.05].forEach((d) => {
      ;[-0.56, 0.56].forEach((z) => b.add(WHEEL, mat.wheel, at(x + d, -0.62, z, Math.PI / 2)))
      tube(
        b,
        mat.wheel,
        new THREE.Vector3(x + d, -0.62, -0.62),
        new THREE.Vector3(x + d, -0.62, 0.62),
        0.06,
      )
    })
  }

  /**
   * 屋根のパンタグラフ (1本の腕の形)。台、下の腕、上の腕、架線にふれる横の板
   */
  const pantograph = (x) => {
    box(b, mat.bogie, x - 0.6, x + 0.6, 2.74, 2.82, -0.7, 0.7)
    tube(
      b,
      mat.panto,
      new THREE.Vector3(x - 0.45, 2.85, 0),
      new THREE.Vector3(x + 0.55, 3.72, 0),
      0.04,
    )
    tube(
      b,
      mat.panto,
      new THREE.Vector3(x + 0.55, 3.72, 0),
      new THREE.Vector3(x - 0.3, 4.52, 0),
      0.03,
    )
    box(b, mat.panto, x - 0.36, x - 0.24, 4.52, 4.57, -0.8, 0.8)
  }

  /**
   * 1両分を組む。cx は、その両の真ん中の x
   */
  const car = (cx, front, rear) => {
    const x0 = cx - CAR / 2 + 0.25
    const x1 = cx + CAR / 2 - 0.25
    // 床。座席の前は灰色、通路は少し明るい
    flat(b, mat.floor, 0.002, x0, x1, -HALF_W, HALF_W, 1)
    flat(b, mat.aisle, 0.004, x0, x1, -0.42, 0.42, 1)
    // 天井。真ん中に冷房の吹き出し口、その両わきに明かりの列
    flat(b, mat.ceiling, ROOF, x0, x1, -CEIL_Z, CEIL_Z, -1)
    flat(b, mat.vent, ROOF - 0.004, x0 + 0.3, x1 - 0.3, -0.2, 0.2, -1)
    ;[-1, 1].forEach((s) => {
      box(b, mat.lampFrame, x0 + 0.2, x1 - 0.2, ROOF - 0.045, ROOF, ...span(s * 0.5, s * 0.72))
      flat(b, mat.light, ROOF - 0.047, x0 + 0.25, x1 - 0.25, ...span(s * 0.52, s * 0.7), -1)
    })
    ;[-1, 1].forEach((s) => {
      const zi = s * HALF_W
      const zo = s * OUT_W
      onShoulder(b, mat.panel, x0, x1, s, 0, 1)
      SECTIONS.forEach(([a, c]) => {
        const xa = cx + a
        const xc = cx + c
        wallZ(b, mat.panel, zi, xa, xc, 0, WIN0, -s)
        wallZ(b, mat.panel, zi, xa, xc, WIN1, SHOULDER_Y, -s)
        wallZ(b, mat.skin, zo, xa, xc, -1.0, WIN0, s)
        wallZ(b, mat.skin, zo, xa, xc, WIN1, 2.62, s)
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
          wallZ(b, mat.skin, zo, p, q, WIN0, WIN1, s)
        })
        // 窓。柱で何枚かに分け、上下の見込みと窓台、ガラスのまわりの黒いゴム
        const n = Math.max(1, Math.round((gc - ga) / 1.15))
        const step = (gc - ga) / n
        for (let k = 0; k <= n; k++) {
          // 窓の柱。車内の側は化粧板、外の側はステンレス
          const px = ga + k * step
          const pa = Math.max(px - 0.05, xa)
          const pc = Math.min(px + 0.05, xc)
          box(b, mat.panel, pa, pc, WIN0, WIN1, ...span(zi, s * 1.414))
          box(b, mat.skin, pa, pc, WIN0, WIN1, ...span(s * 1.436, zo))
        }
        flat(b, mat.panel, WIN1, ga, gc, ...span(zi, s * 1.425), -1)
        flat(b, mat.panel, WIN0, ga, gc, ...span(zi, s * 1.425), 1)
        box(b, mat.sill, ga, gc, WIN0 - 0.02, WIN0 + 0.012, ...span(zi - s * 0.05, zi))
        box(b, mat.rubber, ga, gc, WIN1 - 0.025, WIN1, ...span(s * 1.405, s * 1.432))
        box(b, mat.rubber, ga, gc, WIN0, WIN0 + 0.025, ...span(s * 1.405, s * 1.432))
        // 外から見た窓のふちの、黒いゴム
        box(b, mat.rubber, ga, gc, WIN1, WIN1 + 0.035, ...span(zo, zo + s * 0.008))
        box(b, mat.rubber, ga, gc, WIN0 - 0.035, WIN0, ...span(zo, zo + s * 0.008))
        b.add(
          new THREE.PlaneGeometry(gc - ga, WIN1 - WIN0),
          mat.glass,
          at((ga + gc) / 2, (WIN0 + WIN1) / 2, s * 1.425),
        )
        seat(xa, xc, s, a < -8 || c > 8, [a > -9.7, c < 9.7])
        rack(xa, xc, s)
        // 肩の広告
        for (let x = xa + 0.36; x + 0.3 < xc; x += 0.66) {
          const k = Math.floor(Math.abs(x * 3.7 + s * 1.3)) % ads.length
          onShoulder(b, mat.adFrame, x - 0.28, x + 0.28, s, 0.1, 0.9, 0.004)
          onShoulder(b, ads[k], x - 0.26, x + 0.26, s, 0.14, 0.86, 0.008)
        }
      })
      // ドアのところ。上の壁、ドアの枠、肩の表示 (次の駅と、消えている画面)、床の黄色い線と、敷居
      DOORS.forEach((d) => {
        const x = cx + d
        const w = DOOR_W + 0.05
        wallZ(b, mat.panel, zi, x - w, x + w, DOOR_H, SHOULDER_Y, -s)
        wallZ(b, mat.skin, zo, x - w, x + w, DOOR_H, 2.62, s)
        wallZ(b, mat.skin, zo, x - w, x + w, -1.0, 0, s)
        box(b, mat.stripe, x - w, x + w, 2.0, 2.12, ...span(zo, zo + s * 0.006))
        flat(b, mat.panel, DOOR_H, x - DOOR_W, x + DOOR_W, ...span(zi, s * 1.445), -1)
        box(
          b,
          mat.trim,
          x - w - 0.02,
          x + w + 0.02,
          DOOR_H,
          DOOR_H + 0.04,
          ...span(zi - s * 0.015, zi),
        )
        ;[-1, 1].forEach((e) => {
          const xe = x + e * (w + 0.0)
          box(b, mat.trim, ...span(xe, xe + e * 0.04), 0, DOOR_H, ...span(zi - s * 0.015, zi))
        })
        onShoulder(b, displayMat, x - 0.56, x - 0.02, s, 0.2, 0.47, 0.01)
        onShoulder(b, mat.screenOff, x + 0.02, x + 0.56, s, 0.2, 0.47, 0.01)
        onShoulder(b, mat.adFrame, x - 0.6, x + 0.6, s, 0.16, 0.51, 0.005)
        flat(b, mat.yellow, 0.006, x - DOOR_W, x + DOOR_W, ...span(s * 1.17, s * 1.32), 1)
        box(b, mat.threshold, x - DOOR_W, x + DOOR_W, -0.01, 0.009, ...span(s * 1.32, zo))
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
    })
    // 中づり広告。天井から細い針金で下げる
    for (let x = x0 + 1.6; x < x1 - 1; x += 3.1) {
      const k = Math.floor(Math.abs(x * 7)) % ads.length
      ;[0, Math.PI].forEach((ry) => {
        b.add(
          new THREE.PlaneGeometry(0.52, 0.34),
          ads[k],
          at(x + (ry ? -0.003 : 0.003), 1.98, 0, 0, Math.PI / 2 + ry),
        )
      })
      ;[-0.22, 0.22].forEach((dz) => {
        tube(b, mat.pole, new THREE.Vector3(x, 2.15, dz), new THREE.Vector3(x, ROOF, dz), 0.003)
      })
    }
    // 両はしの壁と、貫通扉の窓。運転台の側は、窓の向こうが暗い
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
        // 走る向き (+x) の側が先頭で、前照灯が点く。うしろの端は尾灯
        cabFront(xo, e, e > 0)
        wallX(b, mat.cab, xo - e * 0.01, -0.6, 0.6, 0.8, 2.1, -e)
        return
      }
      wallX(b, mat.skin, xo, -OUT_W, -0.45, -1.0, 2.62, e)
      wallX(b, mat.skin, xo, 0.45, OUT_W, -1.0, 2.62, e)
      wallX(b, mat.skin, xo, -0.45, 0.45, 1.9, 2.62, e)
      wallX(b, mat.skin, xo, -0.45, 0.45, -1.0, 0, e)
    })
    // 屋根と、冷房の箱
    box(b, mat.roof, cx - CAR / 2, cx + CAR / 2, 2.62, 2.74, -OUT_W, OUT_W)
    ;[-5, 5].forEach((d) => {
      box(b, mat.roof, cx + d - 1.2, cx + d + 1.2, 2.74, 3.05, -0.9, 0.9)
      box(b, mat.rubber, cx + d - 1.0, cx + d + 1.0, 3.05, 3.055, -0.7, 0.7)
    })
    // 床下。車体のすそ、台車、そのあいだの機器の箱
    box(b, mat.under, cx - CAR / 2 + 0.2, cx + CAR / 2 - 0.2, -0.32, -0.02, -1.38, 1.38)
    ;[-7, 7].forEach((d) => bogie(cx + d))
    ;[
      [-4.9, -2.6, 1.1],
      [-2.3, -0.4, 0.9],
      [0.2, 2.5, 1.05],
      [2.9, 4.8, 0.8],
    ].forEach(([p, q, w]) => box(b, mat.equip, cx + p, cx + q, -0.92, -0.32, -w, w))
    // 照明 (本物の光)
    ;[-7.5, -2.5, 2.5, 7.5].forEach((d) =>
      lights.push({ local: new THREE.Vector3(cx + d, 2.05, 0) }),
    )
  }
  car(0, true, false)
  car(CAR + 0.6, false, true)
  pantograph(CAR + 0.6 + 7.8)
  // 2両のあいだの幌。中を通れるように、筒の内側だけ
  wallZ(b, mat.bellows, -0.45, CAR / 2 - 0.25, CAR / 2 + 0.85, 0, 1.9, 1)
  wallZ(b, mat.bellows, 0.45, CAR / 2 - 0.25, CAR / 2 + 0.85, 0, 1.9, -1)
  flat(b, mat.bellows, 1.9, CAR / 2 - 0.25, CAR / 2 + 0.85, -0.45, 0.45, -1)
  flat(b, mat.floor, 0.002, CAR / 2 - 0.25, CAR / 2 + 0.85, -0.45, 0.45, 1)
  b.build(root)

  // ドア。2枚ずつ、x の向きに開く。窓は穴をあけてガラスを入れ、閉まる側の端に黒いゴム
  const doors = []
  const WIN_W = DOOR_W - 0.2
  const leafParts = [
    [-DOOR_W / 2, DOOR_W / 2, 0, 1.0],
    [-DOOR_W / 2, DOOR_W / 2, 1.7, DOOR_H],
    [-DOOR_W / 2, -WIN_W / 2, 1.0, 1.7],
    [WIN_W / 2, DOOR_W / 2, 1.0, 1.7],
  ]
  ;[0, CAR + 0.6].forEach((cx) => {
    ;[-1, 1].forEach((s) => {
      DOORS.forEach((d) => {
        const panels = [-1, 1].map((e) => {
          const g = new THREE.Group()
          leafParts.forEach(([p, q, y0, y1]) => {
            const m = new THREE.Mesh(new THREE.BoxGeometry(q - p, y1 - y0, 0.035), mat.stainless)
            m.position.set((p + q) / 2, (y0 + y1) / 2, 0)
            g.add(m)
          })
          const win = new THREE.Mesh(new THREE.PlaneGeometry(WIN_W, 0.7), mat.glass)
          win.position.y = 1.35
          const edge = new THREE.Mesh(new THREE.BoxGeometry(0.022, DOOR_H, 0.05), mat.rubber)
          edge.position.set(-e * (DOOR_W / 2 - 0.011), DOOR_H / 2, 0)
          g.add(win, edge)
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
      power: 6,
      dist: 8,
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
   * @param bridge - ホームへ渡れるようにするか。途中の駅では降りられないので false
   */
  const setOpen = (k, bridge = true) => {
    doors.forEach(({ panels, side }) => {
      if (side < 0) return
      panels.forEach((g) => {
        g.position.x = g.userData.home + g.userData.side * DOOR_W * k
      })
    })
    bridges.forEach((z) => {
      z.on = bridge && k > 0.8
    })
  }

  // 車内の映り込み。1両目の真ん中から、まわりをぐるりと撮った写真 (キューブマップ) を使う
  const cubeTarget = new THREE.WebGLCubeRenderTarget(256)
  const cubeCamera = new THREE.CubeCamera(0.05, 30, cubeTarget)
  const shine = [
    [mat.pole, 1],
    [mat.trim, 1],
    [mat.stainless, 0.9],
    [mat.sill, 0.8],
    [mat.threshold, 0.6],
    [mat.adFrame, 0.8],
    [mat.screenOff, 1],
    [mat.heater, 0.4],
    [mat.panel, 0.35],
    [mat.ceiling, 0.35],
    [mat.partition, 0.4],
    [mat.lampFrame, 0.35],
    [mat.floor, 0.3],
    [mat.aisle, 0.3],
    [mat.seat, 0.25],
    [mat.priority, 0.25],
  ]
  let captured = false

  /**
   * 車内を撮って、窓ガラスや金属、白い壁に映り込ませる。走っていて、車内の明かりが点いている時に呼ぶ。
   * 乗客が降りたら、撮り直す
   */
  const capture = (renderer) => {
    cubeCamera.position.set(root.position.x, 1.5, root.position.z)
    cubeCamera.updateMatrixWorld()
    cubeCamera.update(renderer, scene)
    if (captured) return
    captured = true
    shine.forEach(([m, k]) => {
      m.envMap = cubeTarget.texture
      m.envMapIntensity = k
      m.needsUpdate = true
    })
    mat.glass.envMap = cubeTarget.texture
    mat.glass.needsUpdate = true
  }

  /**
   * 車体の外側に、外の景色の映り込み (env) を付ける。ステンレスが、暗い灰色の板に見えないように
   */
  const lightOutside = (env) => {
    ;[
      [mat.skin, 0.28],
      [mat.stainless, 0.3],
      [mat.mask, 0.5],
      [mat.windshield, 0.8],
      [mat.coupler, 0.3],
      [mat.wheel, 0.4],
      [mat.panto, 0.4],
    ].forEach(([m, k]) => {
      if (m.envMap) return
      m.envMap = env
      m.envMapIntensity = k
      m.needsUpdate = true
    })
  }

  const lightBase = mat.light.color.clone()

  /**
   * 車内の明かりを点ける / 消す。天井の明かりの列と、本物の光の両方
   */
  const setLit = (on) => {
    mat.light.color.copy(lightBase).multiplyScalar(on ? 1 : 0.04)
    fixtures.forEach((f) => {
      f.on = on
    })
  }

  return { root, place, setOpen, display, fixtures, capture, lightOutside, setLit }
}

/**
 * 走っている間に窓の外を流れる景色。家の明かり、街灯、架線の柱、踏切、途中の駅のホーム。
 * 電車は止めたまま、景色を動かす
 * @param center - 電車を置く場所 (1両目の真ん中)
 * @param shared - { fixtures }。途中の駅のホームの照明を足す
 */
export const buildRideScenery = (scene, center, shared) => {
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
    const z = side * (10 + Math.random() * 20)
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
    const z = (Math.random() < 0.5 ? -1 : 1) * (7.5 + Math.random() * 5)
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

  // 途中の駅のホーム。止まる時だけ出して、景色と一緒に流す。ドアの開く +z の側にある。
  // 1両目の真ん中を x = 0 にして組む。approach() で駅名を貼り替えて出し、alignStop() で止まる場所へ寄せる
  const stop = new THREE.Group()
  stop.visible = false
  group.add(stop)
  const pm = {
    concrete: new THREE.MeshStandardMaterial({ color: 0x75746f, roughness: 0.95 }),
    edge: new THREE.MeshStandardMaterial({ color: 0xd8d5cc, roughness: 0.7 }),
    tactile: new THREE.MeshStandardMaterial({ color: 0xd4a91c, roughness: 0.7 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x5c6066, roughness: 0.5, metalness: 0.5 }),
    tube: new THREE.MeshBasicMaterial({ color: 0xf2f6ff }),
    bench: new THREE.MeshStandardMaterial({ color: 0x3c6e9e, roughness: 0.5 }),
    vend: new THREE.MeshBasicMaterial({ color: 0xdfe8ee }),
    vendBody: new THREE.MeshStandardMaterial({ color: 0xb8262a, roughness: 0.5 }),
  }
  const sb = makeBuilder()
  box(sb, pm.concrete, -45, 45, -1.2, 0, 1.5, 6.5)
  box(sb, pm.edge, -45, 45, -0.02, 0.012, 1.5, 1.62)
  flat(sb, pm.tactile, 0.006, -45, 45, 1.95, 2.25, 1)
  box(sb, pm.steel, -20, 20, 3.2, 3.32, 1.8, 6.5)
  ;[-15, -5, 5, 15].forEach((x) => box(sb, pm.steel, x - 0.08, x + 0.08, 0, 3.2, 5.5, 5.66))
  for (let x = -14; x <= 14; x += 4) box(sb, pm.tube, x - 0.6, x + 0.6, 3.14, 3.19, 4.1, 4.2)
  ;[-6, 9].forEach((x) => {
    box(sb, pm.bench, x - 0.9, x + 0.9, 0.42, 0.47, 5.3, 5.75)
    box(sb, pm.bench, x - 0.9, x + 0.9, 0.47, 0.85, 5.72, 5.78)
    ;[-0.8, 0.8].forEach((d) => box(sb, pm.steel, x + d - 0.03, x + d + 0.03, 0, 0.42, 5.4, 5.6))
  })
  box(sb, pm.vendBody, 12, 12.95, 0, 1.83, 5.75, 6.4)
  wallZ(sb, pm.vend, 5.745, 12.08, 12.87, 0.75, 1.75, -1)
  wallZ(sb, dark, 6.5, -45, 45, 0, 1.6, -1)
  ;[1.65, 3.35].forEach((x) => box(sb, pm.steel, x - 0.03, x + 0.03, 0, 2.3, 3.87, 3.93))
  sb.build(stop)
  const boardMats = new Map()
  const board = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.63))
  board.position.set(2.5, 1.95, 3.86)
  board.rotation.y = Math.PI
  stop.add(board)
  const stopLights = [-12, -4, 4, 12].map((x) => {
    const f = {
      pos: new THREE.Vector3(),
      local: new THREE.Vector3(x, 2.9, 4.15),
      color: new THREE.Color(0xeef3ff),
      power: 4.5,
      dist: 9,
      glow: null,
      base: null,
      on: false,
      level: 1,
      stutter: 0,
      faulty: false,
      outdoor: true,
    }
    shared.fixtures.push(f)
    return f
  })
  let stopFree = false

  /**
   * 途中の駅のホームの照明の場所を、ホームの今の場所に合わせる
   */
  const placeStopLights = () => {
    stopLights.forEach((f) => {
      f.pos.copy(f.local).add(stop.position).add(group.position)
      f.on = stop.visible
    })
  }

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
    if (stop.visible && stopFree) {
      stop.position.x -= speed * dt
      if (stop.position.x < -120) stop.visible = false
    }
    placeStopLights()
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

  /**
   * 途中の駅のホームを、止まる前に出す。駅名標を、その駅のものに貼り替える
   * @param o - { name, kana, roman, prev, next } (prev / next は [ひらがな, 漢字])
   */
  const approach = (o) => {
    if (!boardMats.has(o.name)) {
      const map = stationBoardTexture({ color: '#2e8b57', ...o })
      boardMats.set(o.name, new THREE.MeshStandardMaterial({ map, roughness: 0.5 }))
    }
    board.material = boardMats.get(o.name)
    stop.visible = true
    stopFree = false
    placeStopLights()
  }

  /**
   * 止まるまでの残りの長さ (m) に合わせて、ホームを寄せる。0 で、ドアの前にホームが来る
   */
  const alignStop = (rest) => {
    stop.position.x = rest
    placeStopLights()
  }

  /**
   * 走り出したので、ホームを景色と一緒に流す
   */
  const leaveStop = () => {
    stopFree = true
  }

  return { group, update, cross, crossingNear, stop, approach, alignStop, leaveStop }
}
