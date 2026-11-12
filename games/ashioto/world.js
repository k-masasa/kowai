import * as THREE from 'three'
import {
  ceilingTexture,
  clockFace,
  doorTexture,
  floorTexture,
  labelTexture,
  noticePaper,
  plateTexture,
  wallTexture,
} from './textures.js'

// 廊下の幅、天井の高さ、1区間の長さ (m)。z が 0 から -SEG までが1区間
export const W = 1.9
export const H = 2.45
export const SEG = 20.4

const DOORS = [
  { num: '201', z: -1.9, side: -1 },
  { num: '202', z: -5.0, side: 1 },
  { num: '203', z: -8.1, side: -1 },
  { num: '204', z: -11.2, side: 1 },
  { num: '205', z: -14.3, side: -1 },
  { num: '206', z: -17.4, side: 1 },
]
const LAMP_Z = [-3.4, -10.2, -17.0]
const LAMP_POWER = 6
const TUBE_GLOW = 1.6

/**
 * 廊下で使い回すマテリアルを作る
 */
const makeMaterials = () => {
  const floorMap = floorTexture()
  floorMap.repeat.set(1, SEG / 2)
  const wallMap = wallTexture()
  wallMap.repeat.set(SEG / 2.04, 1)
  const ceilingMap = ceilingTexture()
  ceilingMap.repeat.set(1, SEG / 2)
  return {
    floor: new THREE.MeshStandardMaterial({ map: floorMap, roughness: 0.62 }),
    wall: new THREE.MeshStandardMaterial({ map: wallMap, roughness: 0.92 }),
    ceiling: new THREE.MeshStandardMaterial({ map: ceilingMap, roughness: 1 }),
    base: new THREE.MeshStandardMaterial({ color: 0x2c2722, roughness: 0.8 }),
    door: new THREE.MeshStandardMaterial({ map: doorTexture(), roughness: 0.55, metalness: 0.15 }),
    doorEdge: new THREE.MeshStandardMaterial({ color: 0x3a322b, roughness: 0.6 }),
    frame: new THREE.MeshStandardMaterial({ color: 0x5b534a, roughness: 0.7 }),
    metal: new THREE.MeshStandardMaterial({ color: 0xa29d93, roughness: 0.35, metalness: 0.3 }),
    black: new THREE.MeshBasicMaterial({ color: 0x000000 }),
    lampBody: new THREE.MeshStandardMaterial({ color: 0xd8d6cf, roughness: 0.6 }),
    red: new THREE.MeshStandardMaterial({ color: 0xa8211b, roughness: 0.6 }),
  }
}

/**
 * 正面が +z の物を、左右の壁に貼る
 * @param side - 左の壁なら -1、右の壁なら 1
 * @param depth - 壁から手前に出す量
 */
const onWall = (obj, side, z, y, depth = 0) => {
  obj.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2
  obj.position.set(side * (W / 2 - depth), y, z)
}

/**
 * 部屋のドアを1枚作る。正面は +z で、左側にちょうつがいがある
 * @param plate - 部屋番号の札のテクスチャ
 * @param hole - ドアを開けた時に、奥を真っ暗に見せる板を置くか
 */
const makeDoor = (mats, plate, { hole = true } = {}) => {
  const group = new THREE.Group()

  if (hole) {
    const dark = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 2.0), mats.black)
    dark.position.set(0, 1.0, 0.004)
    group.add(dark)
  }

  ;[
    [0.05, 2.08, -0.455, 1.04],
    [0.05, 2.08, 0.455, 1.04],
    [0.96, 0.05, 0, 2.055],
  ].forEach(([w, h, x, y]) => {
    const part = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.07), mats.frame)
    part.position.set(x, y, 0)
    group.add(part)
  })

  const hinge = new THREE.Group()
  hinge.position.set(-0.43, 0, 0)
  group.add(hinge)

  const edge = mats.doorEdge
  const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.86, 2.0, 0.045), [
    edge,
    edge,
    edge,
    edge,
    mats.door,
    edge,
  ])
  leaf.position.set(0.43, 1.0, 0)
  leaf.receiveShadow = true

  const lever = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.022, 0.022), mats.metal)
  lever.position.set(0.68, 1.0, 0.055)
  const rose = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.012, 16), mats.metal)
  rose.rotation.x = Math.PI / 2
  rose.position.set(0.73, 1.0, 0.028)
  const peep = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.01, 12), mats.metal)
  peep.rotation.x = Math.PI / 2
  peep.position.set(0.43, 1.48, 0.025)
  const slot = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.012), mats.metal)
  slot.position.set(0.43, 0.82, 0.026)
  hinge.add(leaf, lever, rose, peep, slot)

  const tag = new THREE.Mesh(
    new THREE.PlaneGeometry(0.19, 0.08),
    new THREE.MeshStandardMaterial({ map: plate, roughness: 0.5 }),
  )
  tag.position.set(0.63, 1.58, 0.003)
  group.add(tag)

  return { group, hinge }
}

/**
 * 天井の蛍光灯を1本作る
 */
const makeLamp = (mats, z) => {
  const group = new THREE.Group()
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.05, 1.32), mats.lampBody)
  body.position.set(0, H - 0.025, z)
  const tubeMat = new THREE.MeshStandardMaterial({
    color: 0xe6ebf2,
    emissive: 0xf2f6ff,
    emissiveIntensity: TUBE_GLOW,
  })
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 1.2, 10), tubeMat)
  tube.rotation.x = Math.PI / 2
  tube.position.set(0, H - 0.07, z)
  const light = new THREE.PointLight(0xe8eeff, LAMP_POWER, 9, 2)
  light.position.set(0, H - 0.18, z)
  group.add(body, tube, light)
  return { group, z, light, tubeMat, level: 1, target: 1, dying: 0, stutter: 0, faulty: false }
}

/**
 * 蛍光灯の明るさを変える。0 で消える
 */
const setLamp = (lamp, level) => {
  lamp.level = level
  lamp.light.intensity = LAMP_POWER * level
  lamp.tubeMat.emissiveIntensity = TUBE_GLOW * level
}

/**
 * 蛍光灯1本の、このフレームの明るさ。消えかけと、調子の悪い蛍光灯はちらつく
 * @param onLampOff - 消えかけの蛍光灯が消えきった時に呼ぶ
 */
const lampLevel = (lamp, dt, onLampOff) => {
  if (lamp.dying > 0) {
    lamp.dying -= dt
    if (lamp.dying <= 0) onLampOff(lamp)
    return Math.random() < 0.55 ? 0.08 : 1
  }
  if (lamp.stutter > 0) {
    lamp.stutter -= dt
    return Math.random() < 0.6 ? 0.05 : 1
  }
  if (lamp.faulty && lamp.target > 0 && Math.random() < dt * 0.12) {
    lamp.stutter = 0.15 + Math.random() * 0.3
  }
  return lamp.target
}

/**
 * 廊下を1区間作る
 */
const buildSegment = (mats, shared) => {
  const group = new THREE.Group()

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, SEG), mats.floor)
  floor.rotation.x = -Math.PI / 2
  floor.position.set(0, 0, -SEG / 2)
  floor.receiveShadow = true
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(W, SEG), mats.ceiling)
  ceiling.rotation.x = Math.PI / 2
  ceiling.position.set(0, H, -SEG / 2)
  group.add(floor, ceiling)

  ;[-1, 1].forEach((side) => {
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(SEG, H), mats.wall)
    wall.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2
    wall.position.set((side * W) / 2, H / 2, -SEG / 2)
    wall.receiveShadow = true
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.08, SEG), mats.base)
    base.position.set(side * (W / 2 - 0.006), 0.04, -SEG / 2)
    group.add(wall, base)
  })

  const doors = DOORS.map((d) => {
    const door = makeDoor(mats, shared.plates[d.num])
    onWall(door.group, d.side, d.z, 0)
    group.add(door.group)
    return { ...door, z: d.z }
  })

  const lamps = LAMP_Z.map((z) => {
    const lamp = makeLamp(mats, z)
    group.add(lamp.group)
    return lamp
  })

  const clock = new THREE.Group()
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.045, 40), mats.frame)
  rim.rotation.x = Math.PI / 2
  const face = new THREE.Mesh(
    new THREE.CircleGeometry(0.155, 40),
    new THREE.MeshStandardMaterial({ map: shared.clock.tex, roughness: 0.6 }),
  )
  face.position.z = 0.024
  clock.add(rim, face)
  onWall(clock, -1, -19.6, 2.0, 0.025)

  const notice = new THREE.Mesh(
    new THREE.PlaneGeometry(0.33, 0.44),
    new THREE.MeshStandardMaterial({ map: shared.notice.tex, roughness: 0.9 }),
  )
  onWall(notice, -1, -18.55, 1.5, 0.004)
  notice.rotation.z = 0.025

  const ext = new THREE.Group()
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.5, 0.16), mats.red)
  box.position.z = 0.08
  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(0.24, 0.09),
    new THREE.MeshStandardMaterial({ map: shared.extLabel, roughness: 0.6 }),
  )
  label.position.set(0, 0.12, 0.161)
  ext.add(box, label)
  onWall(ext, 1, -19.4, 0.42)

  group.add(clock, notice, ext)
  return { group, doors, lamps }
}

/**
 * 廊下の突き当たりと、207号室のドアを作る。最後の周回でだけ出す
 */
const buildEnd = (mats, plate) => {
  const group = new THREE.Group()
  group.position.z = -SEG

  const map = wallTexture()
  map.repeat.set(0.5, 1)
  const wallMat = new THREE.MeshStandardMaterial({ map, roughness: 0.92 })
  const sideW = (W - 0.92) / 2
  ;[-1, 1].forEach((s) => {
    const piece = new THREE.Mesh(new THREE.PlaneGeometry(sideW, H), wallMat)
    piece.position.set(s * (0.46 + sideW / 2), H / 2, 0)
    group.add(piece)
  })
  const top = new THREE.Mesh(new THREE.PlaneGeometry(0.92, H - 2.08), wallMat)
  top.position.set(0, 2.08 + (H - 2.08) / 2, 0)
  group.add(top)

  const door = makeDoor(mats, plate, { hole: false })
  door.hinge.rotation.y = -0.62
  group.add(door.group)

  const room = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 2.3, 1.8),
    new THREE.MeshStandardMaterial({ color: 0x5e5044, roughness: 0.95, side: THREE.BackSide }),
  )
  room.position.set(0, 1.15, -0.92)
  const warm = new THREE.PointLight(0xffc285, 4, 4.2, 2)
  warm.position.set(0.2, 1.9, -1.1)
  group.add(room, warm)

  group.visible = false
  return { group, door }
}

/**
 * 廊下を組み立てる。同じ区間を3つ (後ろ / 今いる所 / 先) 並べて、端が見えないようにする
 */
export const buildWorld = (scene) => {
  const mats = makeMaterials()
  const clock = clockFace()
  const notice = noticePaper()
  const plates = Object.fromEntries(
    ['201', '202', '203', '204', '205', '206', '207'].map((n) => [n, plateTexture(n)]),
  )
  const shared = { clock, notice, plates, extLabel: labelTexture('消火器') }

  const [behind, here, ahead] = [SEG, 0, -SEG].map((offset) => {
    const seg = buildSegment(mats, shared)
    seg.group.position.z = offset
    seg.lamps.forEach((lamp) => {
      lamp.wz = lamp.z + offset
    })
    scene.add(seg.group)
    return seg
  })
  here.lamps[1].faulty = true
  const end = buildEnd(mats, plates['207'])
  scene.add(end.group)
  const allLamps = [...behind.lamps, ...here.lamps, ...ahead.lamps]

  /**
   * 周回が変わった時に、蛍光灯を付け直す
   * @param darkBehind - 後ろの区間の蛍光灯を消しておくか
   */
  const resetLamps = (darkBehind) => {
    here.lamps.forEach((lamp) => {
      lamp.target = 1
      lamp.dying = 0
    })
    behind.lamps.forEach((lamp) => {
      lamp.target = darkBehind ? 0 : 1
    })
  }

  /**
   * 通り過ぎた蛍光灯を、ちらつかせてから消す
   */
  const killLamp = (lamp) => {
    lamp.target = 0
    lamp.dying = 0.7
  }

  /**
   * 最後の周回にする。先の区間を消して、突き当たりに207号室を出す
   */
  const setFinal = () => {
    ahead.group.visible = false
    end.group.visible = true
  }

  /**
   * 今いる区間の、閉まっているドアを1枚だけ少し開ける。少し先のドアを選ぶ
   */
  const openDoorNear = (z) => {
    const closed = here.doors.filter((d) => d.hinge.rotation.y === 0)
    closed.sort((a, b) => Math.abs(a.z - (z - 3)) - Math.abs(b.z - (z - 3)))
    if (closed.length === 0) return
    closed[0].hinge.rotation.y = -0.45
  }

  /**
   * z の位置で聞こえる、蛍光灯のうなりの大きさ (0 から 1)
   */
  const humAt = (z) =>
    Math.max(
      0,
      ...allLamps.map(
        (lamp) => lamp.level * THREE.MathUtils.clamp(1 - Math.abs(lamp.wz - z) / 5, 0, 1),
      ),
    )

  /**
   * 毎フレーム、蛍光灯の明るさを決める
   * @param dark - 明かりが全部消えている間か
   * @param onLampOff - 蛍光灯が消えきった時に呼ぶ
   */
  const update = (dt, dark, onLampOff) => {
    here.lamps.forEach((lamp) => setLamp(lamp, dark ? 0 : lampLevel(lamp, dt, onLampOff)))
    behind.lamps.forEach((lamp) => setLamp(lamp, lamp.target))
    ahead.lamps.forEach((lamp) => setLamp(lamp, lamp.target))
  }

  return { here, end, clock, notice, resetLamps, killLamp, setFinal, openDoorNear, humAt, update }
}
