// 歩ける所を決める。壁は線、床は高さと足音の種類を持った四角の並び

// プレイヤーの体の太さ (半径 m)
const RADIUS = 0.22
// これより高い段は上れない (m)。家の床 (地面から 50 cm) には、石段や踏み台を使って上がる
const STEP = 0.45

/**
 * 当たる線と床から、プレイヤーの動きを決める
 * @param walls - 当たる線の並び。{ ax, az, bx, bz }
 * @param floors - 床の四角の並び。{ x0, x1, z0, z1, h, s }。h は高さ、s は足音の種類。重なる所では、あとにある方を使う
 */
export const createWalker = (walls, floors) => {
  /**
   * その場所の床を返す
   */
  const floorAt = (x, z) => {
    for (let i = floors.length - 1; i >= 0; i--) {
      const f = floors[i]
      if (x >= f.x0 && x <= f.x1 && z >= f.z0 && z <= f.z1) {
        return f
      }
    }
    return null
  }

  /**
   * その場所の床の高さ
   */
  const heightAt = (x, z) => floorAt(x, z)?.h ?? 0

  /**
   * 壁にめりこんでいたら、壁から体の太さの分だけ押し戻す
   */
  const pushOut = (p) => {
    for (let k = 0; k < 4; k++) {
      let moved = false
      walls.forEach((w) => {
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
    pushOut(p)
    const f = floorAt(p.x, p.z)
    const h = f?.h ?? 0
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
