import * as THREE from 'three'

/**
 * 照明は数が多いので、目に近いものにだけ本物の光を割り当てる。光る部分の見た目は、全部に付けてある
 * @param fixtures - 照明の並び。{ pos, color, power, dist }
 * @param count - 同時に点ける光の数。途中で変えると描き直しが重くなるので、決めた数のまま使い回す
 */
export const createLightPool = (scene, fixtures, count = 8) => {
  const lights = Array.from({ length: count }, () => {
    const light = new THREE.PointLight(0xffffff, 0, 6, 2)
    scene.add(light)
    return light
  })
  const scored = fixtures.map((f) => ({ f, d: 0 }))

  /**
   * 目に近い照明から順に、光を割り当てる
   * @param eye - カメラの位置
   */
  const update = (eye) => {
    scored.forEach((s) => {
      s.d = s.f.pos.distanceTo(eye)
    })
    scored.sort((a, b) => a.d - b.d)
    lights.forEach((light, i) => {
      const pick = scored[i]
      if (!pick || pick.d > 30) {
        light.intensity = 0
        return
      }
      light.position.copy(pick.f.pos)
      light.color.copy(pick.f.color)
      light.intensity = pick.f.power
      light.distance = pick.f.dist
    })
  }

  return { update }
}
