import * as THREE from 'three'

/**
 * 照明1つの、このフレームの明るさ (0 から 1)。消えかけや、調子の悪い照明はちらつく
 * @param dark - 停電のように、建物の中の明かりが全部消えている間か
 */
const levelOf = (f, dark, dt) => {
  if (!f.on) return 0
  if (dark && !f.outdoor) return 0
  if (f.stutter > 0) {
    f.stutter -= dt
    return Math.random() < 0.6 ? 0.05 : 1
  }
  if (f.faulty && Math.random() < dt * 0.15) f.stutter = 0.15 + Math.random() * 0.3
  return 1
}

/**
 * 建物の照明は数が多いので、近いものにだけ本物の光を割り当てる。光る部分の見た目は全部に付ける
 * @param count - 同時に点ける光の数。途中で変えると描き直しが重くなるので、決めた数のまま使い回す
 */
export const createLightPool = (scene, fixtures, count = 10) => {
  const lights = Array.from({ length: count }, () => {
    const light = new THREE.PointLight(0xffffff, 0, 6, 2)
    scene.add(light)
    return light
  })
  const scored = []

  /**
   * 照明の明るさを決めて、目に近い照明に光を割り当てる。返り値は、蛍光灯のうなりの大きさ (0 から 1)
   * @param eye - カメラの位置
   */
  const update = (eye, dark, dt) => {
    scored.length = 0
    let hum = 0
    fixtures.forEach((f) => {
      f.level = levelOf(f, dark, dt)
      if (f.glow) f.glow.material.color.copy(f.base).multiplyScalar(f.level)
      if (f.level <= 0) return
      const dx = f.pos.x - eye.x
      const dz = f.pos.z - eye.z
      const dy = f.pos.y - eye.y
      const score = Math.hypot(dx, dz) + Math.max(0, Math.abs(dy) - 1.4) * 4
      if (score > 30) return
      scored.push({ f, score })
      if (!f.outdoor && f.glow && score < 5) hum = Math.max(hum, f.level * (1 - score / 5))
    })
    scored.sort((a, b) => a.score - b.score)
    lights.forEach((light, i) => {
      const pick = scored[i]
      if (!pick) {
        light.intensity = 0
        return
      }
      light.position.copy(pick.f.pos)
      light.color.copy(pick.f.color)
      light.intensity = pick.f.power * pick.f.level
      light.distance = pick.f.dist
    })
    return hum
  }

  return { update }
}
