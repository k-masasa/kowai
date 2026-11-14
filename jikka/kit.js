import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

// 家や敷地を組むための共通の部品。単位は m。x は東西 (東が +)、z は南北 (南が +)、y は高さ
// あしおとの kit.js をもとにして、壁を開口ごと組む部品と、ぶつかる線を足した

/**
 * 同じマテリアルの形をまとめて1つにして、描く回数を減らす。壁や床のテクスチャは、置いた場所の座標で貼る
 */
export const makeBuilder = () => {
  const parts = new Map()

  /**
   * 形を1つ足す。material.userData.tile があれば、その長さ (m) ごとにテクスチャを繰り返す
   */
  const add = (geometry, material, matrix) => {
    const g = geometry.index ? geometry.toNonIndexed() : geometry.clone()
    g.applyMatrix4(matrix)
    if (material.userData.tile) {
      worldUV(g, material.userData.tile)
    }
    if (!parts.has(material)) {
      parts.set(material, [])
    }
    parts.get(material).push(g)
  }

  /**
   * まとめた形を、マテリアルごとに1つのメッシュにして parent に足す。
   * material.userData.noShadow があれば、影を落とさない (ガラスやビニールなど)
   */
  const build = (parent) => {
    parts.forEach((list, material) => {
      const mesh = new THREE.Mesh(mergeGeometries(list), material)
      mesh.receiveShadow = !material.userData.noShadow
      mesh.castShadow = !material.userData.noShadow
      mesh.matrixAutoUpdate = false
      parent.add(mesh)
    })
    parts.clear()
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
const S = new THREE.Vector3()
const ONE = new THREE.Vector3(1, 1, 1)

/**
 * 置く場所と向きの行列を作る
 */
export const at = (x, y, z, rx = 0, ry = 0, rz = 0) =>
  M.compose(V.set(x, y, z), Q.setFromEuler(E.set(rx, ry, rz)), ONE)

/**
 * 置く場所と向きに、大きさも付けた行列を作る
 */
export const atScaled = (x, y, z, rx, ry, rz, sx, sy, sz) =>
  M.compose(V.set(x, y, z), Q.setFromEuler(E.set(rx, ry, rz)), S.set(sx, sy, sz))

/**
 * 角の座標で箱を置く
 */
export const box = (b, mat, x0, x1, y0, y1, z0, z1) => {
  b.add(
    new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0),
    mat,
    at((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2),
  )
}

/**
 * 箱を、穴と重ならない箱いくつかに分ける。どれも [x0, x1, y0, y1, z0, z1] の形
 */
const splitBox = (outer, hole) => {
  const [x0, x1, y0, y1, z0, z1] = outer
  const hx0 = Math.max(hole[0], x0)
  const hx1 = Math.min(hole[1], x1)
  const hy0 = Math.max(hole[2], y0)
  const hy1 = Math.min(hole[3], y1)
  const cz0 = Math.max(z0, hole[4])
  const cz1 = Math.min(z1, hole[5])
  if (hx0 >= hx1 || hy0 >= hy1 || cz0 >= cz1) return [outer]
  const pieces = [
    [x0, hx0, y0, y1, z0, z1],
    [hx1, x1, y0, y1, z0, z1],
    [hx0, hx1, y0, hy0, z0, z1],
    [hx0, hx1, hy1, y1, z0, z1],
    [hx0, hx1, hy0, hy1, z0, cz0],
    [hx0, hx1, hy0, hy1, cz1, z1],
  ]
  return pieces.filter(([a, b2, c, d, e, f]) => b2 > a && d > c && f > e)
}

/**
 * 箱から、穴の部分をくり抜いて置く
 * @param outer - 箱の [x0, x1, y0, y1, z0, z1]
 * @param holes - くり抜く部分の並び。それぞれ [x0, x1, y0, y1, z0, z1]
 */
export const boxWithout = (b, mat, outer, holes) => {
  let pieces = [outer]
  holes.forEach((hole) => {
    pieces = pieces.flatMap((piece) => splitBox(piece, hole))
  })
  pieces.forEach((p) => box(b, mat, ...p))
}

/**
 * x が一定の壁の面を置く
 * @param dir - +x を向くなら 1、-x を向くなら -1
 */
export const wallX = (b, mat, x, z0, z1, y0, y1, dir) => {
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
export const wallZ = (b, mat, z, x0, x1, y0, y1, dir) => {
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
export const flat = (b, mat, y, x0, x1, z0, z1, dir) => {
  b.add(
    new THREE.PlaneGeometry(x1 - x0, z1 - z0),
    mat,
    at((x0 + x1) / 2, y, (z0 + z1) / 2, (-dir * Math.PI) / 2),
  )
}

const Y_AXIS = new THREE.Vector3(0, 1, 0)

/**
 * 2点を結ぶ細い管を置く
 */
export const tube = (b, mat, p0, p1, r = 0.012) => {
  const d = new THREE.Vector3().subVectors(p1, p0)
  const len = d.length()
  Q.setFromUnitVectors(Y_AXIS, d.divideScalar(len))
  const mid = new THREE.Vector3().addVectors(p0, p1).multiplyScalar(0.5)
  b.add(new THREE.CylinderGeometry(r, r, len, 6), mat, M.compose(mid, Q, ONE))
}

/**
 * 切妻の屋根を、2枚の板で置く
 * @param y - 軒の高さ
 * @param rise - 軒から棟までの高さ
 * @param axis - 棟の向き。'x' か 'z'
 */
export const gableRoof = (b, mat, x0, x1, z0, z1, y, rise, axis) => {
  if (axis === 'x') {
    const half = (z1 - z0) / 2
    const len = Math.hypot(half, rise) + 0.04
    const a = Math.atan2(rise, half)
    const g = new THREE.BoxGeometry(x1 - x0, 0.08, len)
    b.add(g, mat, at((x0 + x1) / 2, y + rise / 2, z1 - half / 2, a))
    b.add(g, mat, at((x0 + x1) / 2, y + rise / 2, z0 + half / 2, -a))
    return
  }
  const half = (x1 - x0) / 2
  const len = Math.hypot(half, rise) + 0.04
  const a = Math.atan2(rise, half)
  const g = new THREE.BoxGeometry(len, 0.08, z1 - z0)
  b.add(g, mat, at(x1 - half / 2, y + rise / 2, (z0 + z1) / 2, 0, 0, -a))
  b.add(g, mat, at(x0 + half / 2, y + rise / 2, (z0 + z1) / 2, 0, 0, a))
}

/**
 * 切妻の妻側の三角の壁。中から見ても見えるように、裏にも面を張る
 * @param axis - 棟の向き。三角は棟の両端に立つ
 * @param pos - 三角を置く場所。axis が 'x' なら x、'z' なら z
 * @param a0 - 底辺の始まり。axis が 'x' なら z、'z' なら x
 * @param a1 - 底辺の終わり
 * @param y - 底辺の高さ
 * @param rise - 底辺から頂点までの高さ
 * @param dir - 外を向く向き。+ なら 1、- なら -1
 */
export const gableEnd = (b, mat, axis, pos, a0, a1, y, rise, dir) => {
  const am = (a0 + a1) / 2
  // 外向きの面と、内向きの面。どちらも、向いた側から見て左回りに並べる
  const [p0, p1] = (axis === 'x') === dir > 0 ? [a1, a0] : [a0, a1]
  const faces = [
    [p0, p1, dir],
    [p1, p0, -dir],
  ]
  faces.forEach(([pa, pb, d]) => {
    const g = new THREE.BufferGeometry()
    const points =
      axis === 'x' ? [0, 0, pa, 0, 0, pb, 0, rise, am] : [pa, 0, 0, pb, 0, 0, am, rise, 0]
    const normal = axis === 'x' ? [d, 0, 0] : [0, 0, d]
    g.setAttribute('position', new THREE.Float32BufferAttribute(points, 3))
    g.setAttribute('normal', new THREE.Float32BufferAttribute([...normal, ...normal, ...normal], 3))
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0.5, 1], 2))
    b.add(g, mat, axis === 'x' ? at(pos, y, 0) : at(0, y, pos))
  })
}

/**
 * 上の辺が斜めの壁の面。屋根の下のすき間をふさぐ。表と裏の両方に張る
 * @param axis - 'x' なら z = pos の面に、'z' なら x = pos の面に張る
 * @param ya - a0 の所の上の高さ
 * @param yb - a1 の所の上の高さ
 */
export const slantWall = (b, mat, axis, pos, a0, a1, y0, ya, yb) => {
  /**
   * 壁の面の上の点を、x, y, z の並びにする
   */
  const p = (a, y) => (axis === 'x' ? [a, y, pos] : [pos, y, a])
  const [q0, q1, q2, q3] = [p(a0, y0), p(a1, y0), p(a1, Math.max(y0, yb)), p(a0, Math.max(y0, ya))]
  const g = new THREE.BufferGeometry()
  g.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      [...q0, ...q1, ...q2, ...q0, ...q2, ...q3, ...q0, ...q2, ...q1, ...q0, ...q3, ...q2],
      3,
    ),
  )
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(24).fill(0), 2))
  g.computeVertexNormals()
  b.add(g, mat, at(0, 0, 0))
}

/**
 * 段を積んだ階段を置く。上る向きに、段の箱を1つずつ重ねる
 * @param dir - 上る向き。'+x' / '-x' / '+z' / '-z'
 * @param n - 段の数
 */
export const stairs = (b, mat, x0, x1, z0, z1, y0, y1, n, dir) => {
  for (let i = 0; i < n; i++) {
    const top = y0 + ((i + 1) * (y1 - y0)) / n
    const f = i / n
    if (dir === '+x') {
      box(b, mat, x0 + f * (x1 - x0), x1, y0, top, z0, z1)
    } else if (dir === '-x') {
      box(b, mat, x0, x1 - f * (x1 - x0), y0, top, z0, z1)
    } else if (dir === '+z') {
      box(b, mat, x0, x1, y0, top, z0 + f * (z1 - z0), z1)
    } else {
      box(b, mat, x0, x1, y0, top, z0, z1 - f * (z1 - z0))
    }
  }
}

/**
 * 繰り返し貼るテクスチャのマテリアル
 * @param tile - テクスチャ1枚の長さ (m)
 */
export const tiled = (map, tile, opts = {}) => {
  const m = new THREE.MeshStandardMaterial({ map, roughness: 0.9, ...opts })
  m.userData.tile = tile
  return m
}

/**
 * 区間から、あいている所を除いた、残りの区間を返す
 * @param gaps - あいている所の並び。それぞれ [始まり, 終わり]
 */
const remain = (from, to, gaps) => {
  const out = []
  let cur = from
  ;[...gaps]
    .sort((p, q) => p[0] - q[0])
    .forEach(([a0, a1]) => {
      if (a0 > cur) {
        out.push([cur, a0])
      }
      cur = Math.max(cur, a1)
    })
  if (to > cur) {
    out.push([cur, to])
  }
  return out
}

/**
 * 壁を組む部品。見た目の箱と、ぶつかる線を一緒に足す
 * @param mats - plaster / fusuma / shoji / frame / post / glass / sash / siding を持つマテリアルの入れ物
 * @param segs - ぶつかる線を入れる並び。{ ax, az, bx, bz }
 */
export const makeWalls = (b, mats, segs) => {
  /**
   * 線にそった箱を置く
   * @param axis - 'x' なら z = c の線上を x の向きに、'z' なら x = c の線上を z の向きに走る
   */
  const slab = (mat, axis, c, a0, a1, y0, y1, t) => {
    if (a1 - a0 < 0.002 || y1 - y0 < 0.002) return
    if (axis === 'x') {
      box(b, mat, a0, a1, y0, y1, c - t / 2, c + t / 2)
      return
    }
    box(b, mat, c - t / 2, c + t / 2, y0, y1, a0, a1)
  }

  /**
   * ぶつかる線を1本足す
   * @param y0 - 壁の下の高さ。y0 と y1 を渡すと、その高さにいる時だけ当たる (上の階の壁など)
   * @param y1 - 壁の上の高さ
   */
  const seg = (axis, c, a0, a1, y0, y1) => {
    const span = y0 === undefined ? {} : { y0, y1 }
    if (axis === 'x') {
      segs.push({ ax: a0, az: c, bx: a1, bz: c, ...span })
      return
    }
    segs.push({ ax: c, az: a0, bx: c, bz: a1, ...span })
  }

  /**
   * 四角の物 (家具や柱) にぶつかるように、まわりに線を4本足す
   */
  const rect = (x0, x1, z0, z1) => {
    seg('x', z0, x0, x1)
    seg('x', z1, x0, x1)
    seg('z', x0, z0, z1)
    seg('z', x1, z0, z1)
  }

  /**
   * 柱を1本置く
   */
  const post = (axis, c, a, y0, y1) => {
    if (axis === 'x') {
      box(b, mats.post, a - 0.055, a + 0.055, y0, y1, c - 0.055, c + 0.055)
      return
    }
    box(b, mats.post, c - 0.055, c + 0.055, y0, y1, a - 0.055, a + 0.055)
  }

  /**
   * ふすまや障子を、1枚ずつ幅に合わせて並べる
   */
  const panels = (mat, axis, c, a0, a1, y0, y1) => {
    const n = Math.max(1, Math.round((a1 - a0) / 0.91))
    const w = (a1 - a0) / n
    for (let i = 0; i < n; i++) {
      slab(mat, axis, c, a0 + i * w + 0.004, a0 + (i + 1) * w - 0.004, y0, y1, 0.03)
    }
  }

  /**
   * ガラス戸を、1枚ずつ幅に合わせて並べる。2本の溝に、互い違いに入っている
   * @param pane - ガラスのマテリアル (すりガラスなど)
   */
  const glassDoors = (axis, c, a0, a1, y0, y1, pane) => {
    const n = Math.max(1, Math.round((a1 - a0) / 0.91))
    const w = (a1 - a0) / n
    for (let i = 0; i < n; i++) {
      const p0 = a0 + i * w
      const p1 = p0 + w
      const cc = c + (i % 2 ? 0.02 : -0.02)
      slab(mats.frame, axis, cc, p0, p0 + 0.045, y0, y1, 0.032)
      slab(mats.frame, axis, cc, p1 - 0.045, p1, y0, y1, 0.032)
      slab(mats.frame, axis, cc, p0, p1, y0, y0 + 0.08, 0.032)
      slab(mats.frame, axis, cc, p0, p1, y1 - 0.05, y1, 0.032)
      slab(mats.frame, axis, cc, p0, p1, y0 + 0.82, y0 + 0.85, 0.028)
      slab(pane, axis, cc, p0 + 0.04, p1 - 0.04, y0 + 0.08, y1 - 0.05, 0.006)
    }
  }

  /**
   * 家の中の壁。鴨居より下を、ふすま・障子・ガラス戸・土壁のどれかにし、上は土壁の小壁にする
   * @param spec.kind - 'fusuma' / 'shoji' / 'glass' / 'plaster'
   * @param spec.doors - 戸があいている所の並び。それぞれ [始まり, 終わり]
   * @param spec.head - 鴨居の高さ。y0 からの長さ (m)
   * @param spec.mat - kind が 'plaster' の時の壁のマテリアル。無ければ土壁
   * @param spec.pane - kind が 'glass' の時のガラスのマテリアル。無ければ透明なガラス
   */
  const inner = (spec) => {
    const { axis, at: c, from, to, y0, y1, kind, doors = [] } = spec
    const head = y0 + (spec.head ?? 1.8)
    const wallMat = spec.mat ?? mats.plaster
    remain(from, to, doors).forEach(([a0, a1]) => {
      if (kind === 'fusuma') {
        panels(mats.fusuma, axis, c, a0, a1, y0, head)
      } else if (kind === 'shoji') {
        panels(mats.shoji, axis, c, a0, a1, y0, head)
      } else if (kind === 'glass') {
        glassDoors(axis, c, a0, a1, y0, head, spec.pane ?? mats.glass)
      } else {
        slab(wallMat, axis, c, a0, a1, y0, head, 0.1)
      }
      seg(axis, c, a0, a1, y0, y1)
    })
    slab(wallMat, axis, c, from, to, head + 0.04, y1, kind === 'plaster' ? 0.1 : 0.07)
    slab(mats.frame, axis, c, from, to, head, head + 0.04, 0.1)
    if (kind !== 'plaster') {
      slab(mats.frame, axis, c, from, to, y0, y0 + 0.012, 0.1)
    }
    post(axis, c, from, y0, y1)
    post(axis, c, to, y0, y1)
    if (kind === 'plaster') {
      doors.forEach(([a0, a1]) => {
        post(axis, c, a0, y0, head)
        post(axis, c, a1, y0, head)
      })
    }
  }

  /**
   * 開口のまわりの枠と、窓ならガラスを入れる
   */
  const opening = (axis, c, h, t) => {
    const mat = h.door ? mats.frame : mats.sash
    slab(mat, axis, c, h.from - 0.04, h.from, h.y0, h.y1, t)
    slab(mat, axis, c, h.to, h.to + 0.04, h.y0, h.y1, t)
    slab(mat, axis, c, h.from - 0.04, h.to + 0.04, h.y1, h.y1 + 0.04, t)
    if (h.door) return
    slab(mat, axis, c, h.from - 0.04, h.to + 0.04, h.y0 - 0.03, h.y0, t + 0.04)
    if (h.glass === false) return
    const mid = (h.from + h.to) / 2
    slab(mats.sash, axis, c, mid - 0.02, mid + 0.02, h.y0, h.y1, 0.04)
    slab(mats.glass, axis, c, h.from, h.to, h.y0, h.y1, 0.006)
  }

  /**
   * 1枚の材料の壁を、穴をあけて置く
   */
  const layer = (mat, axis, c, from, to, y0, y1, t, holes) => {
    if (axis === 'x') {
      boxWithout(
        b,
        mat,
        [from, to, y0, y1, c - t / 2, c + t / 2],
        holes.map((h) => [h.from, h.to, h.y0, h.y1, c - 1, c + 1]),
      )
      return
    }
    boxWithout(
      b,
      mat,
      [c - t / 2, c + t / 2, y0, y1, from, to],
      holes.map((h) => [c - 1, c + 1, h.y0, h.y1, h.from, h.to]),
    )
  }

  /**
   * 外壁。外側の板と、内側の土壁の2枚で組む。窓と戸口をあける
   * @param spec.out - 外を向く向き。+ なら 1、- なら -1
   * @param spec.holes - 開口の並び。{ from, to, y0, y1, door, glass }。door なら通れる。glass が false なら、ガラスを入れない
   * @param spec.mat - 外側のマテリアル。無ければ下見板
   * @param spec.inner - 内側のマテリアル。無ければ土壁
   */
  const outer = (spec) => {
    const { axis, at: c, from, to, y0, y1, out, holes = [] } = spec
    layer(spec.mat ?? mats.siding, axis, c + out * 0.035, from, to, y0, y1, 0.07, holes)
    layer(spec.inner ?? mats.plaster, axis, c - out * 0.035, from, to, y0, y1, 0.07, holes)
    holes.forEach((h) => opening(axis, c, h, 0.16))
    collide(axis, c, from, to, holes, y0, y1)
  }

  /**
   * 1枚の材料だけの壁 (小屋の板壁やトタン、ブロック)。穴をあけられる
   * @param spec.collide - false なら、ぶつかる線を足さない (同じ所に重ねる時)
   */
  const solid = (spec) => {
    const { axis, at: c, from, to, y0, y1, mat, holes = [] } = spec
    layer(mat, axis, c, from, to, y0, y1, spec.t ?? 0.08, holes)
    if (spec.collide === false) return
    collide(axis, c, from, to, holes, y0, y1)
  }

  /**
   * 壁にぶつかる線を足す。戸口 (door) の所だけ通れる
   */
  const collide = (axis, c, from, to, holes, y0, y1) => {
    const doors = holes.filter((h) => h.door).map((h) => [h.from, h.to])
    remain(from, to, doors).forEach(([a0, a1]) => seg(axis, c, a0, a1, y0, y1))
  }

  return { inner, outer, solid, slab, seg, rect, post }
}
