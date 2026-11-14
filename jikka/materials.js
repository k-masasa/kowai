import * as THREE from 'three'
import { tiled } from './kit.js'
import {
  asphaltTexture,
  bathTileTexture,
  blockTexture,
  boardTexture,
  ceilingTexture,
  concreteTexture,
  corrugatedTexture,
  dirtTexture,
  fusumaTexture,
  gravelTexture,
  grassTexture,
  kakejikuTexture,
  logEndTexture,
  paddyTexture,
  plasterTexture,
  roofTexture,
  sidingTexture,
  shedBoardTexture,
  shojiTexture,
  soilTexture,
  tatamiTexture,
} from './textures.js'

/**
 * 色だけのマテリアル
 */
const plain = (color, opts = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...opts })

/**
 * 影を落とさない、透けるマテリアル (ガラスやビニール)
 */
const clear = (color, opacity, opts = {}) => {
  const m = new THREE.MeshStandardMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    side: THREE.DoubleSide,
    roughness: 0.1,
    ...opts,
  })
  m.userData.noShadow = true
  return m
}

/**
 * 光っている物 (蛍光灯や電球)。影は落とさない
 */
const glow = (color) => {
  const m = new THREE.MeshBasicMaterial({ color })
  m.userData.noShadow = true
  return m
}

/**
 * 池や用水路の水。少し透けて、つやがある。影は落とさない
 */
const still = () => {
  const m = plain(0x5d6d72, { roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.9 })
  m.userData.noShadow = true
  return m
}

/**
 * トタン屋根。棟が z の向きの屋根は、瓦棒が x の向きに走るように絵を回す
 * @param axis - 棟の向き
 */
const roof = (rgb, axis) => {
  const map = roofTexture(rgb)
  if (axis === 'z') {
    map.center.set(0.5, 0.5)
    map.rotation = Math.PI / 2
  }
  return tiled(map, 1.82, { roughness: 0.6, metalness: 0.05 })
}

/**
 * 家と敷地で使うマテリアルを、まとめて作る
 */
export const makeMaterials = () => {
  const shoji = shojiTexture()
  const grass = grassTexture()
  return {
    // 家の中
    tatami: tiled(tatamiTexture(), 1.82, { roughness: 0.95 }),
    board: tiled(boardTexture([142, 102, 64]), 1.82, { roughness: 0.6 }),
    attic: tiled(boardTexture([92, 70, 50]), 1.82),
    flooring: tiled(boardTexture([178, 132, 86]), 1.82, { roughness: 0.38 }),
    ceiling: tiled(ceilingTexture(), 1.82),
    plaster: tiled(plasterTexture([205, 190, 156]), 1.2),
    fusuma: plain(0xffffff, { map: fusumaTexture(), roughness: 0.9 }),
    shoji: plain(0xffffff, {
      map: shoji,
      emissive: 0xfff6e6,
      emissiveMap: shoji,
      emissiveIntensity: 0.16,
      roughness: 0.9,
    }),
    frame: plain(0x6b4a2e, { roughness: 0.6 }),
    post: plain(0x5a3d26, { roughness: 0.6 }),
    tokobashira: plain(0x8a6844, { roughness: 0.4 }),
    glass: clear(0xcfe0e4, 0.14, { metalness: 0 }),
    frosted: clear(0xeef1ee, 0.72, { roughness: 0.6 }),
    sash: plain(0xa9adb0, { roughness: 0.4, metalness: 0.5 }),
    kakejiku: plain(0xffffff, { map: kakejikuTexture() }),
    furniture: plain(0x7a5434, { roughness: 0.55 }),
    darkWood: plain(0x4a3322, { roughness: 0.6 }),
    lacquer: plain(0x15110e, { roughness: 0.25 }),
    gold: plain(0xc9a24a, { metalness: 0.8, roughness: 0.35 }),
    cream: plain(0xe9e1cd, { roughness: 0.6 }),
    white: plain(0xe8e6e0, { roughness: 0.45 }),
    gray: plain(0x8e9090, { roughness: 0.6 }),
    black: plain(0x141414, { roughness: 0.8 }),
    stainless: plain(0xc8cacc, { metalness: 0.7, roughness: 0.3 }),
    iron: plain(0x2c2a28, { metalness: 0.6, roughness: 0.5 }),
    tv: plain(0x6a5440, { roughness: 0.5 }),
    screen: plain(0x1d2224, { roughness: 0.15, metalness: 0.3 }),
    mirror: plain(0xa7b6bb, { roughness: 0.12, metalness: 0 }),
    cardboard: plain(0xb08a5a, { roughness: 0.9 }),
    stove: plain(0x3a3a3a, { roughness: 0.5, metalness: 0.4 }),
    phone: plain(0x3e7d4f, { roughness: 0.3 }),
    kotatsu: plain(0x84402f, { roughness: 0.95 }),
    cord: plain(0x202020),
    lampShade: plain(0xf4f1ea, { roughness: 0.5 }),
    lampGlow: glow(0xf6f8ff),
    bulbGlow: glow(0xffe2b0),
    // 家の外側
    siding: tiled(sidingTexture(), 1.82, { roughness: 0.85 }),
    shedBoard: tiled(shedBoardTexture(), 1.82, { roughness: 0.9 }),
    base: tiled(concreteTexture([128, 124, 116]), 1.2),
    doma: tiled(concreteTexture([170, 165, 155]), 2),
    stone: tiled(concreteTexture([140, 136, 128]), 0.8),
    roofMain: roof([116, 120, 122], 'z'),
    roofRed: roof([132, 62, 42], 'x'),
    roofShed: roof([108, 110, 110], 'z'),
    roofRust: roof([128, 78, 52], 'z'),
    roofBrown: roof([98, 72, 54], 'z'),
    metalBlue: tiled(corrugatedTexture([150, 178, 170], 0.35), 1.82, {
      roughness: 0.6,
      metalness: 0.05,
    }),
    block: tiled(blockTexture(), 1.6),
    bathTile: tiled(bathTileTexture(), 0.9, { roughness: 0.3 }),
    logs: tiled(logEndTexture(), 0.6),
    // 地面
    grass: tiled(grass, 3),
    levee: tiled(grass, 2),
    dirt: tiled(dirtTexture(), 3),
    soil: tiled(soilTexture(), 2),
    gravel: tiled(gravelTexture(), 1.5),
    asphalt: tiled(asphaltTexture(), 4),
    paddy: tiled(paddyTexture(), 6),
    concrete: tiled(concreteTexture([160, 160, 155]), 2),
    water: still(),
    vinyl: clear(0xf2f4f0, 0.3, { roughness: 0.4 }),
    pipe: plain(0x9aa0a2, { metalness: 0.5, roughness: 0.4 }),
    pole: plain(0x9c9a94, { roughness: 0.8 }),
    rail: plain(0x6e5a44, { roughness: 0.8 }),
    // 遠くの家
    farWall: plain(0x6b5a48),
    farWhite: plain(0xb8b2a6),
    farRoofs: [plain(0x6f7476), plain(0x7a3a2a), plain(0x44586a), plain(0x4f5e48)],
  }
}
