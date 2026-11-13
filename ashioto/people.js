import * as THREE from 'three'

// 上着の色。住人ごとに変える
const COATS = [0x3b4252, 0x5a4c3e, 0x2c3a2e, 0x6b6f75, 0x4a2f2c, 0x1e2228]

/**
 * 顔の絵。球に貼ると、正面 (+z) に目と眉と口がくる。陰はぼかして描く
 * @param plain - 目も口も無い顔にするなら true
 */
const faceTexture = (plain) => {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 128
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#c4a488'
  ctx.fillRect(0, 0, 256, 128)
  if (!plain) {
    const cx = 64
    ctx.filter = 'blur(1.2px)'
    ;[-1, 1].forEach((side) => {
      const x = cx + side * 12
      ctx.fillStyle = 'rgba(80, 55, 40, 0.35)'
      ctx.beginPath()
      ctx.ellipse(x, 58, 7, 4, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#1a1310'
      ctx.beginPath()
      ctx.ellipse(x, 58, 3.6, 2.2, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = 'rgba(40, 28, 20, 0.8)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(x - 6, 50 - side * 0.5)
      ctx.lineTo(x + 6, 49 + side * 0.5)
      ctx.stroke()
    })
    ctx.fillStyle = 'rgba(110, 75, 55, 0.35)'
    ctx.fillRect(cx - 2, 60, 4, 12)
    ctx.strokeStyle = 'rgba(90, 50, 40, 0.75)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(cx - 6, 80)
    ctx.lineTo(cx + 6, 80)
    ctx.stroke()
    ctx.filter = 'none'
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/**
 * マンションの住人を1人作る。足元が原点で、正面は +z。
 * 顔には目と眉がある。おかしな人 (strange) は、顔が無く、手足を動かさずにすべるように歩く
 */
export const createPerson = () => {
  const coat = new THREE.MeshStandardMaterial({ color: COATS[0], roughness: 0.85 })
  const pants = new THREE.MeshStandardMaterial({ color: 0x23252a, roughness: 0.9 })
  const skin = new THREE.MeshStandardMaterial({ color: 0xc4a488, roughness: 0.8 })
  const faces = {
    plain: new THREE.MeshStandardMaterial({ map: faceTexture(true), roughness: 0.8 }),
    face: new THREE.MeshStandardMaterial({ map: faceTexture(false), roughness: 0.8 }),
  }
  const dark = new THREE.MeshStandardMaterial({ color: 0x15120f, roughness: 0.9 })
  const bagMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1e, roughness: 0.7 })
  const screen = new THREE.MeshBasicMaterial({ color: 0xcfe3ff })
  const group = new THREE.Group()

  /**
   * 部品を1つ足す。懐中電灯の光で影を落とすようにしておく
   */
  const part = (geometry, material, parent = group) => {
    const mesh = new THREE.Mesh(geometry, material)
    mesh.castShadow = true
    parent.add(mesh)
    return mesh
  }

  // 脚は腰で回る
  const legs = [-1, 1].map((side) => {
    const hip = new THREE.Group()
    hip.position.set(side * 0.09, 0.86, 0)
    group.add(hip)
    const leg = part(new THREE.CapsuleGeometry(0.06, 0.68, 4, 8), pants, hip)
    leg.position.y = -0.41
    const foot = part(new THREE.BoxGeometry(0.1, 0.06, 0.24), dark, hip)
    foot.position.set(0, -0.83, 0.05)
    return hip
  })
  // 上着。肩が張って、腰へ向かって細くなる
  const profile = [
    [0, 0.82],
    [0.17, 0.84],
    [0.16, 1.0],
    [0.19, 1.25],
    [0.2, 1.38],
    [0.12, 1.47],
    [0, 1.48],
  ].map(([r, y]) => new THREE.Vector2(r, y))
  const torso = part(new THREE.LatheGeometry(profile, 20), coat)
  torso.scale.set(1, 1, 0.62)

  const head = new THREE.Group()
  head.position.y = 1.56
  group.add(head)
  const neck = part(new THREE.CylinderGeometry(0.045, 0.05, 0.12, 10), skin)
  neck.position.y = 1.52
  const skull = part(new THREE.SphereGeometry(0.108, 24, 16), faces.face, head)
  skull.scale.set(0.9, 1.15, 0.95)
  skull.position.y = 0.07
  const hair = part(new THREE.SphereGeometry(0.112, 24, 16, 0, Math.PI * 2, 0, 1.35), dark, head)
  hair.scale.set(0.93, 1.1, 0.98)
  hair.position.set(0, 0.08, -0.01)
  hair.rotation.x = -0.5
  // 腕は肩で回る。右手にスマホ、左手にかばんを持つことがある
  const arms = [-1, 1].map((side) => {
    const shoulder = new THREE.Group()
    shoulder.position.set(side * 0.21, 1.4, 0)
    group.add(shoulder)
    const sleeve = part(new THREE.CapsuleGeometry(0.045, 0.5, 4, 8), coat, shoulder)
    sleeve.position.y = -0.3
    const hand = part(new THREE.SphereGeometry(0.04, 10, 8), skin, shoulder)
    hand.position.y = -0.6
    return shoulder
  })
  const phone = part(new THREE.PlaneGeometry(0.07, 0.13), screen, arms[1])
  phone.position.set(-0.02, -0.64, 0.05)
  phone.rotation.x = 1.9
  const bag = part(new THREE.BoxGeometry(0.1, 0.28, 0.34), bagMat, arms[0])
  bag.position.set(0, -0.78, 0)

  let stiff = false

  /**
   * 見た目を決める
   * @param seed - 上着の色と、スマホとかばんのどちらを持つか
   * @param strange - おかしな人なら true
   */
  const dress = (seed, strange) => {
    stiff = strange
    coat.color.setHex(strange ? 0x16171a : COATS[seed % COATS.length])
    skull.material = strange ? faces.plain : faces.face
    phone.visible = !strange && seed % 2 === 0
    bag.visible = !strange && seed % 2 === 1
    head.rotation.set(phone.visible ? 0.35 : 0, 0, strange ? 0.3 : 0)
    arms[1].rotation.x = phone.visible ? -1.15 : 0
    arms[0].rotation.x = 0
    legs.forEach((leg) => {
      leg.rotation.x = 0
    })
  }

  /**
   * 歩く動き。phase は歩数で、1歩で 1 進む。おかしな人は手足を動かさない
   */
  const walk = (phase) => {
    if (stiff) return
    const swing = Math.sin(phase * Math.PI) * 0.42
    legs[0].rotation.x = swing
    legs[1].rotation.x = -swing
    arms[0].rotation.x = -swing * 0.6
    if (!phone.visible) arms[1].rotation.x = swing * 0.6
  }

  /**
   * 正面を target の方へ向ける
   */
  const face = (target) => {
    group.rotation.y = Math.atan2(target.x - group.position.x, target.z - group.position.z)
  }

  return { group, head, dress, walk, face }
}
