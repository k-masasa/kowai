import * as THREE from 'three'
import { canvasTexture, wallTexture } from './textures.js'

// 階段室の寸法 (m)。1階分の高さ FH の中に、上り2本と踊り場がある
// z が 0 から LAND までが各階の踊り場、LAND から MID までが階段、MID から END までが中間の踊り場
// 右の列 (x > 0) を奥へ上り、中間の踊り場で折り返して、左の列 (x < 0) を手前へ上る
export const FH = 2.9
const HALF = FH / 2
const SW = 1.2
const LAND = -1.3
export const MID = -3.4
const END = -4.6
const RUN = LAND - MID
const STEPS = 8
const DIVIDER = 0.06
export const STAIR_DOOR_X = -0.55

/**
 * 階の名前。0階より下は地下にする
 */
export const floorName = (n) => (n >= 1 ? `${n}F` : `B${1 - n}`)

/**
 * 階の札。draw(name) で書き直す
 */
const floorSign = () => {
  let ctx = null
  const tex = canvasTexture(256, 160, (c) => {
    ctx = c
  })

  /**
   * 札に階の名前を書く
   */
  const draw = (name) => {
    ctx.fillStyle = '#d9d4c7'
    ctx.fillRect(0, 0, 256, 160)
    ctx.fillStyle = '#1f1d1a'
    ctx.font = '700 104px "Hiragino Sans", "Yu Gothic", sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(name, 128, 86)
    tex.needsUpdate = true
  }

  return { tex, draw }
}

/**
 * 箱を1つ置く
 */
const box = (group, mat, w, h, d, x, y, z) => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
  mesh.position.set(x, y, z)
  mesh.receiveShadow = true
  group.add(mesh)
  return mesh
}

/**
 * 階段室を1階分作る。足元が y = 0
 * @param makeDoor - 廊下と同じ作りのドアを作る関数
 */
const buildFloor = (mats, makeDoor, plate) => {
  const group = new THREE.Group()
  const lane = SW - DIVIDER
  const laneX = (SW + DIVIDER) / 2
  const rise = HALF / STEPS
  const run = RUN / STEPS

  box(group, mats.concrete, SW * 2, 0.15, -LAND, 0, -0.075, LAND / 2)
  box(group, mats.concrete, SW * 2, 0.15, MID - END, 0, HALF - 0.075, (MID + END) / 2)
  for (let i = 0; i < STEPS; i++) {
    box(group, mats.concrete, lane, 0.22, run, laneX, (i + 1) * rise - 0.11, LAND - (i + 0.5) * run)
    box(
      group,
      mats.concrete,
      lane,
      0.22,
      run,
      -laneX,
      HALF + (i + 1) * rise - 0.11,
      MID + (i + 0.5) * run,
    )
  }
  box(group, mats.divider, DIVIDER * 2, FH, RUN, 0, FH / 2, (LAND + MID) / 2)

  ;[-1, 1].forEach((side) => {
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(-END, FH), mats.stairWall)
    wall.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2
    wall.position.set(side * SW, FH / 2, END / 2)
    wall.receiveShadow = true
    group.add(wall)
  })
  const back = new THREE.Mesh(new THREE.PlaneGeometry(SW * 2, FH), mats.stairWall)
  back.rotation.y = Math.PI
  back.position.set(0, FH / 2, 0)
  const front = new THREE.Mesh(new THREE.PlaneGeometry(SW * 2, FH), mats.stairWall)
  front.position.set(0, FH / 2, END)
  group.add(back, front)

  const door = makeDoor(mats, plate)
  door.group.rotation.y = Math.PI
  door.group.position.set(STAIR_DOOR_X, 0, 0)
  group.add(door.group)
  const hole = door.group.children[0]

  const sign = floorSign()
  const plaque = new THREE.Mesh(
    new THREE.PlaneGeometry(0.42, 0.26),
    new THREE.MeshStandardMaterial({ map: sign.tex, roughness: 0.6 }),
  )
  plaque.rotation.y = Math.PI
  plaque.position.set(0.5, 1.7, -0.006)
  group.add(plaque)

  ;[
    [0.3, FH - 0.35, LAND / 2],
    [0, HALF + 2.4, (MID + END) / 2],
  ].forEach(([x, y, z]) => {
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), mats.bulb)
    bulb.position.set(x, y + 0.08, z)
    const light = new THREE.PointLight(0xffe6cc, 1.8, 6, 2)
    light.position.set(x, y, z)
    group.add(bulb, light)
  })

  return { group, door, hole, sign }
}

/**
 * 階段室を組み立てる。同じ1階分を縦に積んで、上にも下にも続いて見えるようにする
 */
export const buildStairs = (scene, baseMats, makeDoor, plate) => {
  const stairMap = wallTexture()
  stairMap.repeat.set(2, 1)
  const mats = {
    ...baseMats,
    concrete: new THREE.MeshStandardMaterial({ color: 0x74716a, roughness: 0.95 }),
    divider: new THREE.MeshStandardMaterial({ color: 0x8e887d, roughness: 0.95 }),
    stairWall: new THREE.MeshStandardMaterial({ map: stairMap, roughness: 0.95 }),
    bulb: new THREE.MeshStandardMaterial({
      color: 0xfff1d6,
      emissive: 0xffd7a0,
      emissiveIntensity: 2,
    }),
    glow: new THREE.MeshBasicMaterial({ color: 0xc9d2d8 }),
  }
  const root = new THREE.Group()
  scene.add(root)
  const floors = [-1, 0, 1, 2].map((k) => {
    const floor = buildFloor(mats, makeDoor, plate)
    floor.group.position.y = k * FH
    root.add(floor.group)
    return { ...floor, k }
  })

  /**
   * 各階の札とドアを、今いる階に合わせて書き換える
   * @param next - 1つ上に見せる階。同じ階を続けたい時は、今の階と同じにする
   * @param goal - ドアが開いている階
   */
  const setFloors = (now, next, goal) => {
    floors.forEach((f) => {
      let n = now + f.k
      if (f.k >= 1) n = next + f.k - 1
      f.sign.draw(floorName(n))
      const open = n === goal
      f.door.hinge.rotation.y = open ? -0.55 : 0
      f.hole.material = open ? mats.glow : mats.black
    })
  }

  /**
   * 足元の高さ。いくつか考えられる高さのうち、今の高さに一番近いものを返す
   */
  const heightAt = (x, z, prev) => {
    let offset = 0
    if (z < MID) {
      offset = HALF
    } else if (z < LAND) {
      const t = (LAND - z) / RUN
      offset = x >= 0 ? t * HALF : HALF + (1 - t) * HALF
    }
    const k = Math.round((prev - offset) / FH)
    return k * FH + offset
  }

  /**
   * 壁と、階段の間の仕切りにめり込まないようにする
   * @param prevX - 動く前の x。仕切りに当たった時に、どちら側にいたかを見る
   */
  const clamp = (pos, prevX) => {
    const r = 0.25
    pos.x = THREE.MathUtils.clamp(pos.x, -SW + r, SW - r)
    pos.z = THREE.MathUtils.clamp(pos.z, END + r, -r)
    const inFlight = pos.z < LAND + r && pos.z > MID - r
    if (!inFlight || Math.abs(pos.x) > DIVIDER + r) return
    pos.x = Math.sign(prevX || pos.x || 1) * (DIVIDER + r)
  }

  return { group: root, floors, setFloors, heightAt, clamp }
}
