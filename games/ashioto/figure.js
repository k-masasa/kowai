import * as THREE from 'three'

/**
 * 黒いコートを着た、顔の無い人を作る。足元が原点で、正面は +z
 */
export const createFigure = () => {
  const dark = new THREE.MeshStandardMaterial({
    color: 0x0b0b0c,
    roughness: 0.95,
    side: THREE.DoubleSide,
  })
  const pale = new THREE.MeshStandardMaterial({ color: 0xb4ada2, roughness: 0.88 })
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

  const profile = [
    [0, 0.4],
    [0.23, 0.42],
    [0.21, 0.8],
    [0.19, 1.2],
    [0.22, 1.36],
    [0.13, 1.44],
    [0, 1.46],
  ].map(([r, y]) => new THREE.Vector2(r, y))
  const coat = part(new THREE.LatheGeometry(profile, 24), dark)
  coat.scale.set(1, 1, 0.68)

  ;[-0.08, 0.08].forEach((x) => {
    const leg = part(new THREE.CylinderGeometry(0.05, 0.045, 0.44, 10), dark)
    leg.position.set(x, 0.22, 0)
  })

  const neck = part(new THREE.CylinderGeometry(0.042, 0.048, 0.14, 12), pale)
  neck.position.y = 1.5

  const head = new THREE.Group()
  head.position.y = 1.56
  group.add(head)
  const skin = part(new THREE.SphereGeometry(0.11, 32, 24), pale, head)
  skin.scale.set(0.9, 1.16, 0.96)
  skin.position.y = 0.08
  const hair = part(new THREE.SphereGeometry(0.117, 32, 24, 0, Math.PI * 2, 0, 1.3), dark, head)
  hair.scale.set(0.92, 1.12, 0.98)
  hair.position.set(0, 0.085, -0.008)
  hair.rotation.x = -0.55

  // 腕は少しだけ長い
  const arms = [-1, 1].map((side) => {
    const shoulder = new THREE.Group()
    shoulder.position.set(side * 0.215, 1.37, 0)
    group.add(shoulder)
    const sleeve = part(new THREE.CapsuleGeometry(0.048, 0.6, 4, 10), dark, shoulder)
    sleeve.position.y = -0.34
    const hand = part(new THREE.SphereGeometry(0.042, 14, 10), pale, shoulder)
    hand.scale.set(0.75, 1.35, 0.6)
    hand.position.y = -0.72
    return shoulder
  })

  /**
   * 首のかしげ方と腕の位置を、ばらばらに変える
   * @param reach - 0 から 1。近いほど、腕をこちらへのばす
   */
  const randomPose = (reach = 0) => {
    head.rotation.z = (Math.random() - 0.5) * 0.9
    head.rotation.x = Math.random() * 0.25 - 0.05
    arms[0].rotation.x = -reach * (0.6 + Math.random() * 0.6)
    arms[1].rotation.x = -reach * Math.random() * 0.4
  }

  /**
   * つかまえた時の姿勢。首を大きくかしげて、両腕をのばす
   */
  const scarePose = () => {
    head.rotation.z = 0.55
    head.rotation.x = 0.1
    arms[0].rotation.x = -1.3
    arms[1].rotation.x = -1.2
  }

  /**
   * 正面を target の方へ向ける
   * @param away - true なら、背中を向ける
   */
  const face = (target, away = false) => {
    const angle = Math.atan2(target.x - group.position.x, target.z - group.position.z)
    group.rotation.y = away ? angle + Math.PI : angle
  }

  return { group, randomPose, scarePose, face }
}
