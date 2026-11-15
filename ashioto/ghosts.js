import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

// 人の形をしていない、お化け。這うもの (四つ足で這ってくる、細長いもの) と、よじ登る時に腰壁をつかむ手

const UP = new THREE.Vector3(0, 1, 0)
const A = new THREE.Vector3()
const B = new THREE.Vector3()
const D = new THREE.Vector3()

/**
 * 2点のあいだに、細長い形 (高さ 1 の円柱やカプセル) を置き直す
 */
const span = (mesh, a, b) => {
  D.subVectors(b, a)
  const len = D.length()
  mesh.position.addVectors(a, b).multiplyScalar(0.5)
  mesh.scale.set(1, Math.max(len, 0.0001), 1)
  mesh.quaternion.setFromUnitVectors(UP, D.divideScalar(Math.max(len, 0.0001)))
}

/**
 * 這うもの。灰色の細長い体に、関節が上へ突き出た長い手足が4本。頭はたれ下がっていて、目は無く、口だけが開いている。
 * 足元のうしろ (うしろ足のあいだ) が原点で、頭の向きは +z
 */
export const createCrawler = () => {
  const skin = new THREE.MeshStandardMaterial({
    color: 0xbdb6aa,
    emissive: 0x2b2824,
    roughness: 0.85,
  })
  const mouth = new THREE.MeshBasicMaterial({ color: 0x050404 })
  const group = new THREE.Group()
  group.rotation.order = 'YXZ'
  // 体。立ち上がる時は、腰を軸に前を持ち上げる
  const body = new THREE.Group()
  group.add(body)

  /**
   * 部品を1つ足す
   */
  const part = (geometry, material = skin, parent = body) => {
    const mesh = new THREE.Mesh(geometry, material)
    mesh.castShadow = true
    parent.add(mesh)
    return mesh
  }

  const hips = new THREE.Vector3(0, 0.78, 0)
  const shoulders = new THREE.Vector3(0, 0.86, 1.02)
  const torso = part(new THREE.CapsuleGeometry(0.12, 1, 4, 12))
  torso.geometry.scale(1, 1, 0.8)
  span(torso, hips, shoulders)
  // 背骨の出っぱり
  for (let k = 0; k < 6; k++) {
    const bump = part(new THREE.SphereGeometry(0.035, 8, 6))
    bump.position.lerpVectors(hips, shoulders, (k + 0.5) / 6)
    bump.position.y += 0.1
  }
  const neckBase = new THREE.Vector3(0, 0.7, 1.3)
  const neck = part(new THREE.CapsuleGeometry(0.045, 1, 4, 8))
  span(neck, shoulders, neckBase)
  // 頭。たれ下がっていて、口が縦に開いている
  const head = new THREE.Group()
  head.position.copy(neckBase)
  body.add(head)
  const skull = part(new THREE.SphereGeometry(0.13, 20, 14), skin, head)
  skull.scale.set(0.85, 1.05, 1.3)
  skull.position.set(0, -0.02, 0.1)
  // 口は、頭に半分うまった黒いたまご。外に出た所が、穴に見える
  const gape = part(new THREE.SphereGeometry(1, 16, 12), mouth, head)
  gape.position.set(0, -0.08, 0.235)
  gape.scale.set(0.035, 0.06, 0.03)
  head.rotation.x = 0.7

  // 手足。付け根、ひじ (ひざ)、手先 (足先) の3点で決めて、毎回置き直す
  const limbs = [
    { root: new THREE.Vector3(-0.13, 0.84, 0.98), foot: new THREE.Vector3(-0.42, 0, 1.45), t: 0 },
    { root: new THREE.Vector3(0.13, 0.84, 0.98), foot: new THREE.Vector3(0.42, 0, 1.45), t: 0.5 },
    {
      root: new THREE.Vector3(-0.12, 0.76, 0.05),
      foot: new THREE.Vector3(-0.45, 0, -0.25),
      t: 0.5,
    },
    { root: new THREE.Vector3(0.12, 0.76, 0.05), foot: new THREE.Vector3(0.45, 0, -0.25), t: 0 },
  ].map((l) => ({
    ...l,
    upper: part(new THREE.CylinderGeometry(0.035, 0.03, 1, 8)),
    lower: part(new THREE.CylinderGeometry(0.028, 0.02, 1, 8)),
    hand: part(new THREE.SphereGeometry(0.05, 10, 8)),
    at: new THREE.Vector3(),
  }))
  limbs.forEach((l) => {
    l.hand.scale.set(1, 0.3, 1.8)
  })

  // ひじとひざの曲げ方。外へ張り出す幅、上へ突き出す高さ、前へずらす長さ (体の中の座標)
  const BEND = { side: 0.26, up: 0.42, ahead: 0 }

  /**
   * 手足を、手先 (足先) の場所に合わせて置き直す。ひじとひざは、外へ張り出して上へ突き出す
   * @param front - 前の手足のひじの曲げ方。うしろ足は、いつも BEND
   */
  const placeLimbs = (front = BEND) => {
    limbs.forEach((l, k) => {
      const bend = k < 2 ? front : BEND
      const side = Math.sign(l.root.x)
      A.addVectors(l.root, l.at).multiplyScalar(0.5)
      A.x += side * bend.side
      A.y += bend.up
      A.z += bend.ahead
      span(l.upper, l.root, A)
      span(l.lower, A, l.at)
      l.hand.position.copy(l.at)
    })
  }

  /**
   * 這う動き。phase は歩数で、1 で手足がひとまわりする
   * @param stride - 手足を前後に動かす幅 (m)。止まっている時は 0
   */
  const crawl = (phase, stride = 0.3) => {
    limbs.forEach((l) => {
      const p = (phase + l.t) * Math.PI * 2
      l.at.copy(l.foot)
      l.at.z += Math.sin(p) * stride
      l.at.y += Math.max(0, Math.cos(p)) * stride * 0.5
    })
    body.position.y = Math.sin(phase * Math.PI * 4) * 0.02 * (stride > 0 ? 1 : 0)
    placeLimbs()
  }

  /**
   * 止まった時の姿勢を、ばらばらに変える。首の向きと、手足の位置
   * @param reach - 0 から 1。近いほど、前の手をこちらへのばす
   */
  const randomPose = (reach = 0) => {
    body.rotation.x = 0
    head.rotation.set(
      0.5 + Math.random() * 0.4,
      (Math.random() - 0.5) * 0.8,
      (Math.random() - 0.5) * 1.6,
    )
    limbs.forEach((l, k) => {
      l.at.copy(l.foot)
      l.at.z += (Math.random() - 0.5) * 0.3
      if (k < 2) {
        l.at.z += reach * (0.3 + Math.random() * 0.3)
        l.at.y += reach * Math.random() * 0.5
      }
    })
    body.position.y = 0
    placeLimbs()
  }

  /**
   * つかまえた時の姿勢。前を持ち上げて立ち上がり、前の手をこちらへのばす。口が大きく開く
   */
  const scarePose = () => {
    body.rotation.x = -0.95
    body.position.y = 0
    // 体を起こした分、首を前へ倒して、こちらを見る
    head.rotation.set(0.8, 0, 0.45)
    gape.scale.set(0.05, 0.1, 0.034)
    limbs.forEach((l, k) => {
      l.at.copy(l.foot)
      if (k < 2) {
        l.at.x *= 1.3
        l.at.y = 0.55
        l.at.z += 0.25
      }
    })
    placeLimbs()
  }

  /**
   * 壁にしがみつく姿勢。腹側を壁に向けて、前の手先を grips の所に置き、うしろ足の先は壁に付ける。
   * 前の手は隠す (腰壁をつかむ手は、createHand で別に置く)
   * @param grips - 前の左右の手先の位置 (体の中の座標)
   * @param wall - 壁の面の高さ (体の中の y)。腹のすぐ下に壁がある
   */
  const cling = (grips, wall) => {
    body.rotation.x = 0
    body.position.y = 0
    limbs.forEach((l, k) => {
      if (k < 2) {
        l.at.copy(grips[k])
      } else {
        l.at.copy(l.foot)
        l.at.y = wall
      }
      l.hand.visible = k >= 2
    })
    // 前のひじは、壁から離さずに、横へ張って下へ曲げる。腕が、腰壁のふちに引っかかる
    placeLimbs({ side: 0.3, up: 0.1, ahead: -0.3 })
  }

  /**
   * 首だけ曲げて、target (世界の座標) を見る
   * @param tilt - 首をかしげる角度
   */
  const look = (target, tilt = 0) => {
    head.lookAt(target)
    head.rotateZ(tilt)
  }

  /**
   * 四つ足に戻す。口も戻す
   */
  const reset = () => {
    body.rotation.x = 0
    head.rotation.set(0.7, 0, 0)
    gape.scale.set(0.035, 0.06, 0.03)
    limbs.forEach((l) => {
      l.hand.visible = true
    })
    crawl(0, 0)
  }

  /**
   * 頭を target の方へ向ける (体ごと回す)
   */
  const face = (target) => {
    group.rotation.y = Math.atan2(target.x - group.position.x, target.z - group.position.z)
  }

  reset()
  return { group, body, head, skin, crawl, randomPose, scarePose, cling, look, reset, face }
}

// 手の形は1つ作って、みんなで使う
let handGeometry = null

/**
 * 廊下の腰壁の上をつかむ手の形。原点は腰壁の上の外の角 (手首) で、+z が外。指は内側 (-z) へ向けて、腰壁の上にかかる。
 * 腕は付けない (這うものの前の手足が、手首につながる)
 */
const buildHandGeometry = () => {
  const parts = []
  const add = (geometry, a, b) => {
    const mesh = new THREE.Mesh(geometry)
    span(mesh, a, b)
    mesh.updateMatrix()
    const g = geometry.index ? geometry.toNonIndexed() : geometry.clone()
    g.applyMatrix4(mesh.matrix)
    g.deleteAttribute('uv')
    parts.push(g)
  }
  const v = (x, y, z) => new THREE.Vector3(x, y, z)
  // 手のひら
  const palm = new THREE.BoxGeometry(0.085, 0.024, 0.09).toNonIndexed()
  palm.translate(0, 0.012, -0.01)
  palm.deleteAttribute('uv')
  parts.push(palm)
  // 指4本。腰壁の上を内へのびて、内の角で下へ曲がる
  ;[-1.5, -0.5, 0.5, 1.5].forEach((k) => {
    const x = k * 0.02
    const len = 0.12 - Math.abs(k) * 0.015
    add(new THREE.CapsuleGeometry(0.0095, 1, 3, 6), v(x, 0.014, -0.05), v(x, 0.014, -0.05 - len))
    add(
      new THREE.CapsuleGeometry(0.0085, 1, 3, 6),
      v(x, 0.014, -0.05 - len),
      v(x, -0.035, -0.06 - len),
    )
  })
  // 親指
  add(new THREE.CapsuleGeometry(0.011, 1, 3, 6), v(0.045, 0.012, 0.0), v(0.055, 0.004, -0.06))
  const merged = mergeGeometries(parts)
  merged.computeVertexNormals()
  return merged
}

/**
 * 廊下の腰壁をつかむ手を1つ作る。這うものが、外から腰壁をよじ登ってくる時の手
 * @param material - 肌のマテリアル (這うものと同じ)
 */
export const createHand = (material) => {
  if (!handGeometry) handGeometry = buildHandGeometry()
  const mesh = new THREE.Mesh(handGeometry, material)
  mesh.castShadow = true
  return mesh
}
