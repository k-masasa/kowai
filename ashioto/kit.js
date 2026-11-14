import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

// 建物や町を組むための共通の部品。単位は m。x は東西 (東が +)、z は南北 (南が +)、y は高さ

/**
 * 区画を作る。足元の高さを返す関数 h を持つ
 */
export const zone = (tag, x0, x1, z0, z1, h) => ({ tag, x0, x1, z0, z1, h, on: true })

/**
 * 同じ形の物をまとめて1つにして、描く回数を減らす。壁や床のテクスチャは、置いた場所の座標で貼る
 */
export const makeBuilder = () => {
  const parts = new Map()

  /**
   * 形を1つ足す。material.userData.tile があれば、その長さ (m) ごとにテクスチャを繰り返す
   */
  const add = (geometry, material, matrix) => {
    const g = geometry.index ? geometry.toNonIndexed() : geometry.clone()
    g.applyMatrix4(matrix)
    if (material.userData.tile) worldUV(g, material.userData.tile)
    if (!parts.has(material)) parts.set(material, [])
    parts.get(material).push(g)
  }

  /**
   * まとめた形を、マテリアルごとに1つのメッシュにして parent に足す
   */
  const build = (parent) => {
    parts.forEach((list, material) => {
      const mesh = new THREE.Mesh(mergeGeometries(list), material)
      mesh.receiveShadow = true
      mesh.matrixAutoUpdate = false
      parent.add(mesh)
    })
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
const ONE = new THREE.Vector3(1, 1, 1)

/**
 * 置く場所と向きの行列を作る
 */
export const at = (x, y, z, rx = 0, ry = 0, rz = 0) =>
  M.compose(V.set(x, y, z), Q.setFromEuler(E.set(rx, ry, rz)), ONE)

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
 * 箱から、穴の部分をくり抜いて置く。穴の内側の面は描かないので、中から見る壁は別に置く
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

// 鎖の輪。向きを90度ずつ変えて、交互につなぐ
const LINK_A = new THREE.TorusGeometry(0.009, 0.0025, 5, 10).scale(1.5, 1, 1)
const LINK_B = LINK_A.clone().rotateX(Math.PI / 2)
const X_AXIS = new THREE.Vector3(1, 0, 0)

/**
 * 輪を1つ、中心の点と、つながる向きで置く
 */
export const link = (b, mat, k, center, dir) => {
  Q.setFromUnitVectors(X_AXIS, dir)
  b.add(k % 2 ? LINK_B : LINK_A, mat, M.compose(center, Q, ONE))
}

/**
 * 2点の間に、たるんだ鎖を下げる
 * @param sag - 真ん中で、まっすぐな線から下がる長さ (m)
 */
export const chain = (b, mat, from, to, sag) => {
  const n = Math.max(2, Math.round(from.distanceTo(to) / 0.022))
  const point = (t) => {
    const p = new THREE.Vector3().lerpVectors(from, to, t)
    p.y -= sag * 4 * t * (1 - t)
    return p
  }
  for (let k = 0; k < n; k++) {
    const p0 = point(k / n)
    const p1 = point((k + 1) / n)
    const dir = p1.clone().sub(p0).normalize()
    link(b, mat, k, p0.add(p1).multiplyScalar(0.5), dir)
  }
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
 * 切妻の屋根を、2枚の板で置く。棟は x の向き
 * @param y - 軒の高さ
 * @param rise - 軒から棟までの高さ
 */
export const gable = (b, mat, x0, x1, z0, z1, y, rise) => {
  const half = (z1 - z0) / 2
  const len = Math.hypot(half, rise) + 0.05
  const a = Math.atan2(rise, half)
  const roof = new THREE.BoxGeometry(x1 - x0, 0.1, len)
  b.add(roof, mat, at((x0 + x1) / 2, y + rise / 2, z1 - half / 2, a))
  b.add(roof, mat, at((x0 + x1) / 2, y + rise / 2, z0 + half / 2, -a))
}

/**
 * 切妻の妻側の三角の壁
 * @param dir - 外を向く向き。+x なら 1、-x なら -1
 */
export const gableEnd = (b, mat, x, z0, z1, y, rise, dir) => {
  const zm = (z0 + z1) / 2
  const [za, zb] = dir > 0 ? [z1, z0] : [z0, z1]
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, za, 0, 0, zb, 0, rise, zm], 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute([dir, 0, 0, dir, 0, 0, dir, 0, 0], 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0.5, 1], 2))
  b.add(g, mat, at(x, y, 0))
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
