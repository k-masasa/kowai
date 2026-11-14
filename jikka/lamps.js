import * as THREE from 'three'
import { at, box } from './kit.js'

// 家や小屋の明かり。光る部分の形を置き、本物の光を当てる場所を fixtures に覚える

const RING = new THREE.TorusGeometry(0.2, 0.025, 6, 20)
const SHADE = new THREE.CylinderGeometry(0.27, 0.3, 0.05, 20)
const BULB = new THREE.SphereGeometry(0.045, 10, 8)

/**
 * 天井から下げる、丸い蛍光灯
 * @param ceil - 天井の高さ
 */
export const ringLamp = (b, mats, fixtures, x, z, ceil) => {
  const y = ceil - 0.45
  b.add(SHADE, mats.lampShade, at(x, y + 0.05, z))
  b.add(RING, mats.lampGlow, at(x, y, z, Math.PI / 2))
  box(b, mats.cord, x - 0.006, x + 0.006, y + 0.07, ceil, z - 0.006, z + 0.006)
  fixtures.push({
    pos: new THREE.Vector3(x, y - 0.12, z),
    color: new THREE.Color(0xf1f4ff),
    power: 3.2,
    dist: 7,
  })
}

/**
 * 天井や梁から下げる、裸電球
 * @param ceil - 下げている所の高さ
 */
export const bulb = (b, mats, fixtures, x, z, ceil) => {
  const y = ceil - 0.35
  b.add(BULB, mats.bulbGlow, at(x, y, z))
  box(b, mats.cord, x - 0.006, x + 0.006, y + 0.04, ceil, z - 0.006, z + 0.006)
  fixtures.push({
    pos: new THREE.Vector3(x, y - 0.06, z),
    color: new THREE.Color(0xffd9a6),
    power: 1.6,
    dist: 5.5,
  })
}
