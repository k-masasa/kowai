import * as THREE from 'three'
import { CEIL, FLOOR, FLOOR_KINDS, LAYOUT_VERSION, WALL_KINDS } from './layout.js'
import { PALETTE, PROP_TYPES } from './props.js'

// いじるモード。E で切りかえ、目の前の家具・戸口・窓・壁・床をクリックで選んで、キーで変える。
// 変えた所は、もとの間取り (layout.js) との差 (edits) だけを、ブラウザの localStorage に残す。
// X で書き出した文字を Claude に貼ってもらい、layout.js に取りこむ

const STORE = 'kowai.jikka.edits'
// 1回で動かす長さ (m)。Shift を押していると大きく動かす
const STEP = 0.05
const BIG = 0.5
// 選べる遠さ (m)
const REACH = 12
// 1つ戻すために、前の状態をいくつ覚えておくか
const UNDO = 80

const ORDER_FLOOR = Object.keys(FLOOR_KINDS)
const ORDER_WALL = Object.keys(WALL_KINDS)

// 選んでいる物の種類ごとの、キーの説明
const HELP = {
  none: '1 箱 / 2 棚 / 3 台 / 4 たんす / 5 座卓 / 6 こたつ / 7 テレビ / 8 蛍光灯 / 9 電球 を、目の前に置く',
  prop: '矢印 動かす (Shift で大きく) / F・V 上げ下げ / R 回す (Shift で少し) / C 同じ物を足す / Delete 消す',
  hole: '← → ずらす / ↑ ↓ 幅を変える / F・V 上げ下げ / Delete ふさぐ',
  wall: 'T 戸口を足す / M 窓を足す / K 種類を変える',
  room: 'K 床の種類を変える',
}

/**
 * id で要素を取る
 */
const $ = (id) => document.getElementById(id)

/**
 * 小数を、mm で丸める
 */
const round = (v) => Math.round(v * 1000) / 1000

/**
 * 値を、下と上の間におさめる
 */
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

/**
 * 何も変えていない時の、変更の入れ物
 */
const emptyEdits = () => ({ props: {}, added: [], walls: {}, rooms: {} })

/**
 * もとの間取りに、変更を重ねた間取りを作る
 */
export const applyEdits = (base, edits) => ({
  rooms: base.rooms.map((r) => ({ ...r, ...(edits.rooms[r.id] ?? {}) })),
  walls: base.walls.map((w) => ({ ...w, ...(edits.walls[w.id] ?? {}) })),
  props: base.props
    .filter((p) => !edits.props[p.id]?.del)
    .map((p) => ({ ...p, ...(edits.props[p.id] ?? {}) }))
    .concat(edits.added),
})

/**
 * ブラウザに残した変更を読む。間取りの版が変わっていたら (取りこみ済みなので) 捨てる
 */
const load = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) ?? 'null')
    if (saved?.version === LAYOUT_VERSION && saved.edits) {
      return { ...emptyEdits(), ...saved.edits }
    }
  } catch {
    // 読めなくても、変更なしで始める
  }
  return emptyEdits()
}

/**
 * 選んだ所を囲む、枠の線を作る
 */
const makeFrame = (scene, color, opacity) => {
  const frame = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthTest: false }),
  )
  frame.renderOrder = 10
  frame.visible = false
  scene.add(frame)
  return frame
}

/**
 * いじるモードを作る
 * @param ctx.layout - いまの間取り (変更を重ねたもの) を返す関数
 * @param ctx.items - いま組んである家具 (createProps の items) を返す関数
 * @param ctx.heightAt - (x, z) の床の高さを返す関数
 * @param ctx.rebuild - 変えたあとに呼ぶ。{ house, props } のうち、組み直すものを渡す
 * @param ctx.suspend - 書き出しの画面を出す前に呼ぶ (マウスのロックを外す)
 * @param ctx.resume - 書き出しの画面を閉じたあとに呼ぶ
 */
export const createEditor = (ctx) => {
  let on = false
  let edits = load()
  let hover = null
  let selected = null
  let sayUntil = 0
  let counter = 0
  const undo = []
  const shown = {}
  const hoverFrame = makeFrame(ctx.scene, 0xffffff, 0.45)
  const selectFrame = makeFrame(ctx.scene, 0xffd34d, 0.95)
  const ray = new THREE.Ray()
  const local = new THREE.Ray()
  const hit = new THREE.Vector3()

  /**
   * 変更をブラウザに残す
   */
  const save = () => {
    try {
      localStorage.setItem(STORE, JSON.stringify({ version: LAYOUT_VERSION, edits }))
    } catch {
      // 残せなくても、いまの画面では使える
    }
  }

  /**
   * 下の行に、短い知らせを出す
   */
  const say = (text) => {
    $('edit-say').textContent = text
    sayUntil = performance.now() + 2500
  }

  /**
   * 間取りの中から、id の壁・部屋・家具を探す
   */
  const wallOf = (id) => ctx.layout().walls.find((w) => w.id === id)
  /**
   * id の部屋を探す
   */
  const roomOf = (id) => ctx.layout().rooms.find((r) => r.id === id)
  /**
   * id の家具を探す
   */
  const propOf = (id) => ctx.layout().props.find((p) => p.id === id)
  /**
   * id の家具の、組んである形を探す
   */
  const itemOf = (id) => ctx.items().find((it) => it.p.id === id)

  /**
   * 壁の、下と上の高さ
   */
  const wallSpan = (w) => [w.y0 ?? FLOOR, w.y1 ?? CEIL]

  /**
   * 開口の、下と上の高さ。家の中の壁の戸口は、壁の下から鴨居まで
   */
  const holeSpan = (w, h) => {
    if (w.type !== 'inner') return [h.y0, h.y1]
    const y0 = w.y0 ?? FLOOR
    return [y0, y0 + (w.head ?? 1.8)]
  }

  /**
   * 2つの選んだ所が、同じ物か
   */
  const same = (a, b) =>
    !!a && !!b && a.kind === b.kind && a.id === b.id && (a.index ?? -1) === (b.index ?? -1)

  /**
   * 選んだ所が、いまの間取りにまだあるか
   */
  const exists = (t) => {
    if (t.kind === 'prop') return !!propOf(t.id)
    if (t.kind === 'room') return !!roomOf(t.id)
    const w = wallOf(t.id)
    if (!w) return false
    return t.kind !== 'hole' || !!w.holes[t.index]
  }

  /**
   * 画面の真ん中に写っている、いちばん手前の物を探す
   */
  const pick = () => {
    ctx.camera.getWorldPosition(ray.origin)
    ctx.camera.getWorldDirection(ray.direction)
    const o = ray.origin
    const d = ray.direction
    let best = null
    /**
     * 見つけた物が、いままでよりも手前なら覚える
     */
    const consider = (t, target) => {
      if (t <= 0.05 || t > REACH) return
      if (best && best.t <= t) return
      best = { t, ...target }
    }
    ctx.items().forEach((it) => {
      local.copy(ray).applyMatrix4(it.inv)
      if (!local.intersectBox(it.box, hit)) return
      consider(hit.distanceTo(local.origin), { kind: 'prop', id: it.p.id })
    })
    ctx.layout().walls.forEach((w) => {
      const [y0, y1] = wallSpan(w)
      const along = w.axis === 'x' ? 'x' : 'z'
      const across = w.axis === 'x' ? 'z' : 'x'
      if (Math.abs(d[across]) < 1e-6) return
      const t = (w.at - o[across]) / d[across]
      const a = o[along] + d[along] * t
      const y = o.y + d.y * t
      if (a < w.from || a > w.to || y < y0 || y > y1) return
      consider(t, { kind: 'wall', id: w.id, a, y })
    })
    ctx.layout().rooms.forEach((r) => {
      if (d.y > -1e-6) return
      const t = ((r.y ?? FLOOR) - o.y) / d.y
      const x = o.x + d.x * t
      const z = o.z + d.z * t
      if (x < r.x[0] || x > r.x[1] || z < r.z[0] || z > r.z[1]) return
      consider(t, { kind: 'room', id: r.id })
    })
    if (best?.kind !== 'wall') return best
    const w = wallOf(best.id)
    const index = w.holes.findIndex((h) => {
      const [hy0, hy1] = holeSpan(w, h)
      return best.a >= h.from && best.a <= h.to && best.y >= hy0 && best.y <= hy1
    })
    if (index < 0) return best
    return { ...best, kind: 'hole', index }
  }

  /**
   * 選んだ所を囲む箱 (真ん中、向き、大きさ)
   */
  const targetBox = (t) => {
    if (t.kind === 'prop') {
      const it = itemOf(t.id)
      if (!it) return null
      const s = it.size
      const center = new THREE.Vector3(0, s.y0 + s.h / 2, s.front / 2).applyMatrix4(
        it.group.matrixWorld,
      )
      const size = new THREE.Vector3(s.w + 0.04, s.h + 0.04, s.d + s.front + 0.04)
      return { center, rot: it.group.rotation.y, size }
    }
    if (t.kind === 'room') {
      const r = roomOf(t.id)
      if (!r) return null
      return {
        center: new THREE.Vector3(
          (r.x[0] + r.x[1]) / 2,
          (r.y ?? FLOOR) + 0.02,
          (r.z[0] + r.z[1]) / 2,
        ),
        rot: 0,
        size: new THREE.Vector3(r.x[1] - r.x[0], 0.04, r.z[1] - r.z[0]),
      }
    }
    const w = wallOf(t.id)
    if (!w) return null
    let [a0, a1] = [w.from, w.to]
    let [y0, y1] = wallSpan(w)
    if (t.kind === 'hole') {
      const h = w.holes[t.index]
      if (!h) return null
      const span = holeSpan(w, h)
      a0 = h.from
      a1 = h.to
      y0 = span[0]
      y1 = span[1]
    }
    const mid = (a0 + a1) / 2
    const ym = (y0 + y1) / 2
    if (w.axis === 'x') {
      return {
        center: new THREE.Vector3(mid, ym, w.at),
        rot: 0,
        size: new THREE.Vector3(a1 - a0, y1 - y0, 0.22),
      }
    }
    return {
      center: new THREE.Vector3(w.at, ym, mid),
      rot: 0,
      size: new THREE.Vector3(0.22, y1 - y0, a1 - a0),
    }
  }

  /**
   * 枠を、選んだ所に合わせて置く。選んでいなければ隠す
   */
  const placeFrame = (frame, t) => {
    const b = t ? targetBox(t) : null
    if (!b) {
      frame.visible = false
      return
    }
    frame.visible = true
    frame.position.copy(b.center)
    frame.rotation.set(0, b.rot, 0)
    frame.scale.copy(b.size)
  }

  /**
   * 選んだ所の名前
   */
  const label = (t) => {
    if (!t) return ''
    if (t.kind === 'prop') {
      const p = propOf(t.id)
      return p ? (p.name ?? PROP_TYPES[p.type].label) : ''
    }
    if (t.kind === 'room') {
      const r = roomOf(t.id)
      return r ? `${r.name}の床 (${FLOOR_KINDS[r.floor]?.label ?? ''})` : ''
    }
    const w = wallOf(t.id)
    if (!w) return ''
    if (t.kind === 'hole') {
      const h = w.holes[t.index]
      return `${w.name}の${w.type === 'inner' || h?.door ? '戸口' : '窓'}`
    }
    return w.type === 'inner' ? `${w.name} (${WALL_KINDS[w.kind]})` : w.name
  }

  /**
   * 画面の左上の説明を、変わった所だけ書きかえる
   */
  const panel = () => {
    const lines = {
      'edit-target': selected ? `選んでいる所: ${label(selected)}` : 'クリックで選ぶ',
      'edit-hover': hover && !same(hover, selected) ? `見ている所: ${label(hover)}` : '',
      'edit-help': HELP[selected?.kind ?? 'none'],
    }
    Object.entries(lines).forEach(([id, text]) => {
      if (shown[id] === text) return
      shown[id] = text
      $(id).textContent = text
    })
    if (sayUntil && performance.now() > sayUntil) {
      sayUntil = 0
      $('edit-say').textContent = ''
    }
  }

  /**
   * 変更を1つ行う。前の状態を覚えて、ブラウザに残し、組み直しを頼む
   * @param what - { house, props } のうち、組み直すもの
   * @param fn - 変更を行う関数。false を返したら、何もしなかったことにする
   */
  const change = (what, fn) => {
    const before = JSON.stringify(edits)
    if (fn() === false) return
    undo.push(before)
    if (undo.length > UNDO) {
      undo.shift()
    }
    save()
    ctx.rebuild(what)
  }

  /**
   * 前の状態に1つ戻す
   */
  const back = () => {
    const prev = undo.pop()
    if (!prev) {
      say('もう戻せない')
      return
    }
    edits = JSON.parse(prev)
    save()
    selected = null
    ctx.rebuild({ house: true, props: true })
    say('1つ戻した')
  }

  /**
   * 画面の向きに近い、東西南北の向き (前と右)
   */
  const axes = () => {
    const e = new THREE.Euler().setFromQuaternion(ctx.camera.quaternion, 'YXZ')
    const fx = -Math.sin(e.y)
    const fz = -Math.cos(e.y)
    const [sx, sz] = Math.abs(fx) > Math.abs(fz) ? [Math.sign(fx), 0] : [0, Math.sign(fz)]
    return { fx, fz, sx, sz, rx: -sz, rz: sx, yaw: e.y }
  }

  /**
   * 家具の変更を書く。足した家具なら、その物を直接書きかえる
   */
  const setProp = (id, changes) => {
    const added = edits.added.find((p) => p.id === id)
    if (added) {
      Object.assign(added, changes)
      return
    }
    edits.props[id] = { ...(edits.props[id] ?? {}), ...changes }
  }

  /**
   * 家具を動かす。床に置いてある物は、動かした先の床の高さに合わせる
   */
  const moveProp = (id, dx, dz) => {
    const p = propOf(id)
    if (!p) return
    const x = round(p.x + dx)
    const z = round(p.z + dz)
    const changes = { x, z }
    const onFloor = !PROP_TYPES[p.type].fixture && Math.abs(p.y - ctx.heightAt(p.x, p.z)) < 0.02
    if (onFloor) {
      changes.y = round(ctx.heightAt(x, z))
    }
    change({ props: true }, () => setProp(id, changes))
  }

  /**
   * 新しい家具の id
   */
  const newId = () => {
    counter += 1
    return `n${Date.now().toString(36)}${counter.toString(36)}`
  }

  /**
   * 選んだ家具を、横にもう1つ足す
   */
  const duplicate = (t) => {
    const p = propOf(t.id)
    const { rx, rz } = axes()
    const copy = { ...p, id: newId(), x: round(p.x + rx * 0.3), z: round(p.z + rz * 0.3) }
    delete copy.del
    change({ props: true }, () => {
      edits.added.push(copy)
    })
    selected = { kind: 'prop', id: copy.id }
    say('同じ物を足した')
  }

  /**
   * 1 から 9 の物を、目の前の床に置く。前はこちらを向ける
   */
  const addFromPalette = (n) => {
    const item = PALETTE[n]
    if (!item) return
    const { fx, fz, yaw } = axes()
    const cam = ctx.camera.position
    const x = round(cam.x + fx * 1.3)
    const z = round(cam.z + fz * 1.3)
    const floor = ctx.heightAt(x, z)
    const { ceiling, ...rest } = item
    const rot = (((Math.round(THREE.MathUtils.radToDeg(yaw) / 90) * 90) % 360) + 360) % 360
    const p = { ...rest, id: newId(), x, z, y: round(ceiling ? floor + 2.4 : floor), rot }
    change({ props: true }, () => {
      edits.added.push(p)
    })
    selected = { kind: 'prop', id: p.id }
    say(`${item.name}を置いた`)
  }

  /**
   * 選んだ物を消す。開口なら、ふさぐ
   */
  const remove = (t) => {
    if (t.kind === 'prop') {
      change({ props: true }, () => {
        const i = edits.added.findIndex((p) => p.id === t.id)
        if (i >= 0) {
          edits.added.splice(i, 1)
          return
        }
        edits.props[t.id] = { ...(edits.props[t.id] ?? {}), del: true }
      })
      selected = null
      say('消した')
      return
    }
    if (t.kind !== 'hole') return
    const w = wallOf(t.id)
    change({ house: true }, () =>
      setHoles(
        w,
        w.holes.filter((_, i) => i !== t.index),
      ),
    )
    selected = { kind: 'wall', id: t.id, a: t.a, y: t.y }
    say('ふさいだ')
  }

  /**
   * 壁の開口の並びを書く
   */
  const setHoles = (w, holes) => {
    edits.walls[w.id] = { ...(edits.walls[w.id] ?? {}), holes }
  }

  /**
   * 開口を1つ書きかえた並びを作る
   */
  const withHole = (w, index, changes) =>
    w.holes.map((h, i) => (i === index ? { ...h, ...changes } : h))

  /**
   * 開口を、壁にそってずらす
   */
  const moveHole = (t, delta) => {
    const w = wallOf(t.id)
    const h = w.holes[t.index]
    const width = h.to - h.from
    const from = round(clamp(h.from + delta, w.from + 0.02, w.to - 0.02 - width))
    change({ house: true }, () =>
      setHoles(w, withHole(w, t.index, { from, to: round(from + width) })),
    )
  }

  /**
   * 開口の幅を変える。真ん中は動かさない
   */
  const resizeHole = (t, delta) => {
    const w = wallOf(t.id)
    const h = w.holes[t.index]
    const from = round(clamp(h.from - delta / 2, w.from + 0.02, w.to - 0.32))
    const to = round(clamp(h.to + delta / 2, from + 0.3, w.to - 0.02))
    change({ house: true }, () => setHoles(w, withHole(w, t.index, { from, to })))
  }

  /**
   * 開口を上げ下げする。戸口は上の端だけ、窓は全体を動かす
   */
  const liftHole = (t, delta) => {
    const w = wallOf(t.id)
    if (w.type === 'inner') {
      say('家の中の戸口の高さは、変えられない')
      return
    }
    const h = w.holes[t.index]
    const [lo, hi] = wallSpan(w)
    if (h.door) {
      const y1 = round(clamp(h.y1 + delta, h.y0 + 1.0, hi - 0.05))
      change({ house: true }, () => setHoles(w, withHole(w, t.index, { y1 })))
      return
    }
    const size = h.y1 - h.y0
    const y0 = round(clamp(h.y0 + delta, lo + 0.05, hi - 0.05 - size))
    change({ house: true }, () => setHoles(w, withHole(w, t.index, { y0, y1: round(y0 + size) })))
  }

  /**
   * 壁の、こちら側 0.3 m の所の床の高さ
   */
  const floorNear = (w, t) => {
    const cam = ctx.camera.position
    const side = Math.sign(w.axis === 'x' ? cam.z - w.at : cam.x - w.at) || 1
    if (w.axis === 'x') return ctx.heightAt(t.a, w.at + side * 0.3)
    return ctx.heightAt(w.at + side * 0.3, t.a)
  }

  /**
   * 見ている所に、戸口か窓を足す
   * @param door - 戸口なら true、窓なら false
   */
  const addHole = (t, door) => {
    const w = wallOf(t.id)
    if (!door && w.type === 'inner') {
      say('家の中の壁には、窓は足せない')
      return
    }
    const width = door ? 0.85 : 1.0
    if (w.to - w.from < width + 0.04) {
      say('壁が短くて、足せない')
      return
    }
    const from = round(clamp(t.a - width / 2, w.from + 0.02, w.to - 0.02 - width))
    const to = round(from + width)
    if (w.holes.some((h) => h.from < to && h.to > from)) {
      say('ほかの戸口や窓と重なる')
      return
    }
    const [lo, hi] = wallSpan(w)
    const base = clamp(floorNear(w, t), lo, hi - 2)
    let hole = { from, to }
    if (w.type !== 'inner' && door) {
      hole = { from, to, y0: round(base), y1: round(Math.min(base + 1.85, hi - 0.05)), door: true }
    } else if (w.type !== 'inner') {
      hole = { from, to, y0: round(base + 0.9), y1: round(Math.min(base + 1.8, hi - 0.05)) }
    }
    change({ house: true }, () => setHoles(w, [...w.holes, hole]))
    selected = { kind: 'hole', id: w.id, index: w.holes.length, a: t.a, y: t.y }
    say(door ? '戸口を足した' : '窓を足した')
  }

  /**
   * 壁の種類か、床の種類を、次のものに変える
   */
  const cycle = (t) => {
    if (t.kind === 'room') {
      const r = roomOf(t.id)
      const next = ORDER_FLOOR[(ORDER_FLOOR.indexOf(r.floor) + 1) % ORDER_FLOOR.length]
      change({ house: true }, () => {
        edits.rooms[r.id] = { ...(edits.rooms[r.id] ?? {}), floor: next }
      })
      say(`床を${FLOOR_KINDS[next].label}にした`)
      return
    }
    const w = wallOf(t.id)
    if (w.type !== 'inner') {
      say('外の壁は、種類を変えられない')
      return
    }
    const next = ORDER_WALL[(ORDER_WALL.indexOf(w.kind) + 1) % ORDER_WALL.length]
    change({ house: true }, () => {
      edits.walls[w.id] = { ...(edits.walls[w.id] ?? {}), kind: next }
    })
    say(`${WALL_KINDS[next]}にした`)
  }

  /**
   * 家具を選んでいる時のキー
   */
  const propKey = (t, code, step, shift) => {
    const { sx, sz, rx, rz } = axes()
    const moves = {
      ArrowUp: [sx, sz],
      ArrowDown: [-sx, -sz],
      ArrowRight: [rx, rz],
      ArrowLeft: [-rx, -rz],
    }
    if (moves[code]) {
      moveProp(t.id, moves[code][0] * step, moves[code][1] * step)
      return true
    }
    if (code === 'KeyF' || code === 'KeyV') {
      const p = propOf(t.id)
      const y = round(p.y + (code === 'KeyF' ? step : -step))
      change({ props: true }, () => setProp(t.id, { y }))
      return true
    }
    if (code === 'KeyR') {
      const p = propOf(t.id)
      const rot = ((p.rot ?? 0) + (shift ? 15 : 90)) % 360
      change({ props: true }, () => setProp(t.id, { rot }))
      return true
    }
    if (code === 'KeyC') {
      duplicate(t)
      return true
    }
    if (code === 'Delete' || code === 'Backspace') {
      remove(t)
      return true
    }
    return false
  }

  /**
   * 戸口か窓を選んでいる時のキー
   */
  const holeKey = (t, code, step) => {
    const w = wallOf(t.id)
    const { fx, fz } = axes()
    // 壁の from から to の向きが、画面の右と同じなら +1
    const right = w.axis === 'x' ? -fz : fx
    const dir = right >= 0 ? 1 : -1
    if (code === 'ArrowRight' || code === 'ArrowLeft') {
      moveHole(t, (code === 'ArrowRight' ? dir : -dir) * step)
      return true
    }
    if (code === 'ArrowUp' || code === 'ArrowDown') {
      resizeHole(t, code === 'ArrowUp' ? step : -step)
      return true
    }
    if (code === 'KeyF' || code === 'KeyV') {
      liftHole(t, code === 'KeyF' ? step : -step)
      return true
    }
    if (code === 'Delete' || code === 'Backspace') {
      remove(t)
      return true
    }
    return wallKey(t, code)
  }

  /**
   * 壁を選んでいる時のキー
   */
  const wallKey = (t, code) => {
    if (code === 'KeyT' || code === 'KeyM') {
      addHole(t, code === 'KeyT')
      return true
    }
    if (code === 'KeyK') {
      cycle(t)
      return true
    }
    return false
  }

  /**
   * キーを受ける。いじるモードで使ったキーなら true を返す (歩く方には渡さない)
   */
  const key = (e) => {
    if (!on) return false
    const code = e.code
    const step = e.shiftKey ? BIG : STEP
    if (code === 'KeyZ') {
      back()
      return true
    }
    if (code === 'KeyX') {
      openExport()
      return true
    }
    if (code.startsWith('Digit')) {
      addFromPalette(Number(code.slice(5)) - 1)
      return true
    }
    const t = selected
    if (!t) {
      if (code.startsWith('Arrow')) {
        say('先に、クリックで選んでください')
        return true
      }
      return false
    }
    if (t.kind === 'prop') return propKey(t, code, step, e.shiftKey)
    if (t.kind === 'hole') return holeKey(t, code, step)
    if (t.kind === 'wall') return wallKey(t, code) || code.startsWith('Arrow')
    if (t.kind === 'room' && code === 'KeyK') {
      cycle(t)
      return true
    }
    return code.startsWith('Arrow')
  }

  /**
   * いま見ている物を選ぶ (何も見ていなければ、選ぶのをやめる)
   */
  const click = () => {
    if (!on) return
    selected = hover
  }

  /**
   * いじるモードを切りかえる
   */
  const toggle = () => {
    on = !on
    $('edit').classList.toggle('hidden', !on)
    $('cross').classList.toggle('hidden', !on)
    if (on) return
    selected = null
    hover = null
    hoverFrame.visible = false
    selectFrame.visible = false
  }

  /**
   * 書き出す文字。Claude に貼ってもらう
   */
  const exportText = () => JSON.stringify({ version: LAYOUT_VERSION, edits }, null, 2)

  /**
   * 書き出しの画面を出す。クリップボードにも写す
   */
  const openExport = () => {
    ctx.suspend()
    const text = exportText()
    $('export-text').value = text
    $('export').classList.remove('hidden')
    $('export-text').focus()
    $('export-text').select()
    navigator.clipboard
      ?.writeText(text)
      .then(() => {
        $('export-note').textContent = 'コピーしました。Claude に貼ってください。'
      })
      .catch(() => {
        $('export-note').textContent = '下の文字を全部コピーして、Claude に貼ってください。'
      })
  }

  /**
   * 書き出しの画面を閉じる
   */
  const closeExport = () => {
    $('export').classList.add('hidden')
    ctx.resume()
  }

  $('export-copy').addEventListener('click', () => {
    $('export-text').select()
    navigator.clipboard?.writeText(exportText()).then(() => {
      $('export-note').textContent = 'コピーしました。Claude に貼ってください。'
    })
  })
  $('export-close').addEventListener('click', closeExport)
  $('export-reset').addEventListener('click', () => {
    if (!window.confirm('変えた所を全部消して、元の間取りに戻します。いいですか？')) return
    change({ house: true, props: true }, () => {
      edits = emptyEdits()
    })
    selected = null
    $('export-text').value = exportText()
    $('export-note').textContent = '変えた所を、全部消しました。'
  })

  /**
   * 毎フレームの処理。見ている物を探して、枠と説明を出す
   */
  const update = () => {
    if (!on) return
    hover = pick()
    if (selected && !exists(selected)) {
      selected = null
    }
    placeFrame(hoverFrame, hover && !same(hover, selected) ? hover : null)
    placeFrame(selectFrame, selected)
    panel()
  }

  return {
    key,
    click,
    toggle,
    update,
    edits: () => edits,
    isOn: () => on,
    exportText,
  }
}
