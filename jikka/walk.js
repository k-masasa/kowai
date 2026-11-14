// 歩ける所を決める。壁は線、床は高さと足音の種類を持った四角の並び

// プレイヤーの体の太さ (半径 m)
const RADIUS = 0.22
// これより高い段は上れない (m)。家の床 (地面から 50 cm) には、石段や踏み台を使って上がる
const STEP = 0.45
// 体の、ひざと頭の高さ (足元から m)。高さの範囲を持った壁は、この間にかかる時だけ当たる
const KNEE = 0.3
const HEAD = 1.6

/**
 * 点が多角形の中にあるか
 * @param poly - 角の並び。それぞれ [x, z]
 */
const inPoly = (poly, x, z) => {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i]
    const [xj, zj] = poly[j]
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) {
      inside = !inside
    }
  }
  return inside
}

/**
 * 多角形の床を、床の並びに入れられる形にする。まわりの四角 (x0, x1, z0, z1) も付ける
 * @param poly - 角の並び。それぞれ [x, z]
 */
export const polyFloor = (poly, h, s) => {
  const xs = poly.map((p) => p[0])
  const zs = poly.map((p) => p[1])
  return {
    x0: Math.min(...xs),
    x1: Math.max(...xs),
    z0: Math.min(...zs),
    z1: Math.max(...zs),
    poly,
    h,
    s,
  }
}

/**
 * 当たる線と床から、プレイヤーの動きを決める
 * @param walls - 当たる線の並び。{ ax, az, bx, bz, y0, y1 }。y0 と y1 (壁の下と上) があれば、その高さにいる時だけ当たる
 * @param floors - 床の四角の並び。{ x0, x1, z0, z1, h, s }。h は高さ (階段のように、(x, z) から高さを返す関数でもよい)、s は足音の種類。poly があれば、四角の中でも、その多角形の中だけ。重なる所では、あとにある方を使う
 */
export const createWalker = (walls, floors) => {
  /**
   * その場所の床を返す
   */
  const floorAt = (x, z) => {
    for (let i = floors.length - 1; i >= 0; i--) {
      const f = floors[i]
      if (x < f.x0 || x > f.x1 || z < f.z0 || z > f.z1) continue
      if (f.poly && !inPoly(f.poly, x, z)) continue
      return f
    }
    return null
  }

  /**
   * 床の四角の、その場所の高さ
   */
  const heightOf = (f, x, z) => (typeof f.h === 'function' ? f.h(x, z) : f.h)

  /**
   * その場所の床の高さ
   */
  const heightAt = (x, z) => {
    const f = floorAt(x, z)
    return f ? heightOf(f, x, z) : 0
  }

  /**
   * 壁にめりこんでいたら、壁から体の太さの分だけ押し戻す。ほかの階の壁には当たらない
   * @param feet - 足元の高さ
   */
  const pushOut = (p, feet) => {
    for (let k = 0; k < 4; k++) {
      let moved = false
      walls.forEach((w) => {
        if (w.y0 !== undefined && (feet + HEAD < w.y0 || feet + KNEE > w.y1)) return
        const dx = w.bx - w.ax
        const dz = w.bz - w.az
        const len2 = dx * dx + dz * dz
        const t =
          len2 > 0 ? Math.max(0, Math.min(1, ((p.x - w.ax) * dx + (p.z - w.az) * dz) / len2)) : 0
        const ex = p.x - (w.ax + dx * t)
        const ez = p.z - (w.az + dz * t)
        const d = Math.hypot(ex, ez)
        if (d >= RADIUS || d === 0) return
        p.x += (ex / d) * (RADIUS - d)
        p.z += (ez / d) * (RADIUS - d)
        moved = true
      })
      if (!moved) return
    }
  }

  /**
   * その場所へ行けるなら、行った先を返す。段が高すぎる時は null
   */
  const reach = (x, z, feet) => {
    const p = { x, z }
    pushOut(p, feet)
    const f = floorAt(p.x, p.z)
    const h = f ? heightOf(f, p.x, p.z) : 0
    if (h - feet > STEP) return null
    return { x: p.x, z: p.z, h, s: f?.s ?? 'ground' }
  }

  /**
   * いまの場所から dx, dz だけ動いた先を返す。壁や高い段では、その向きの分だけ止まって、すべるように動く
   */
  const move = (pos, feet, dx, dz) =>
    reach(pos.x + dx, pos.z + dz, feet) ??
    reach(pos.x + dx, pos.z, feet) ??
    reach(pos.x, pos.z + dz, feet) ?? {
      x: pos.x,
      z: pos.z,
      h: heightAt(pos.x, pos.z),
      s: floorAt(pos.x, pos.z)?.s ?? 'ground',
    }

  return { move, heightAt }
}
