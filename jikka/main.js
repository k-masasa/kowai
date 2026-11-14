import * as THREE from 'three'
import './style.css'
import { buildHouse } from './house.js'
import { createLightPool } from './lights.js'
import { makeMaterials } from './materials.js'
import { buildSite } from './site.js'
import { createSound } from './sound.js'
import { skyTexture } from './textures.js'
import { createWalker } from './walk.js'

// じっか
// 田んぼの中の古い家と、そのまわりを歩く。いまは間取りを確かめるための形だけで、怖いことはまだ起きない。
// 操作と歩き心地は、あしおとと同じにしている。
// 単位は m。x は東西 (東が +)、z は南北 (南が +)、y は高さ。家の東を、南北に道が通っている

const EYE = 1.55
const WALK = 1.15
const STRIDE = 0.68
// Shift を押している間の速さと歩幅
const RUN = 2.3
const RUN_STRIDE = 0.86
// 始めの場所。玄関の前の砂利の道から、玄関の方を向く
const START = { x: 12.8, z: -2.27, yaw: Math.PI / 2 }
// 日の光の来る向き。午後の、南西からの光
const SUN_DIR = new THREE.Vector3(-0.55, 0.62, 0.56).normalize()
// 地平線の色。霧の色もこれにする
const HORIZON = 0xd3d9de
// 風の音の大きさ (外と、家の中)
const WIND_OUT = 0.05
const WIND_IN = 0.012

/**
 * id で要素を取る
 */
const $ = (id) => document.getElementById(id)

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
renderer.setSize(innerWidth, innerHeight)
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.0
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
document.body.prepend(renderer.domElement)

const scene = new THREE.Scene()
const sky = skyTexture()
sky.mapping = THREE.EquirectangularReflectionMapping
scene.background = sky
scene.fog = new THREE.Fog(HORIZON, 90, 3800)

const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.05, 5000)
scene.add(camera)

scene.add(new THREE.HemisphereLight(0xcdd7e4, 0x6a604c, 0.9))
// 日の光。影を作る範囲は、いる場所のまわりだけにして、歩くのに合わせて動かす
const sun = new THREE.DirectionalLight(0xfff1dc, 2.6)
sun.castShadow = true
sun.shadow.mapSize.set(2048, 2048)
Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 170 })
sun.shadow.bias = -0.0004
sun.shadow.normalBias = 0.03
scene.add(sun, sun.target)

const mats = makeMaterials()
const site = buildSite(scene, mats)
const house = buildHouse(scene, mats)
const walker = createWalker([...site.walls, ...house.walls], [...site.floors, ...house.floors])
const places = [...house.places, ...site.places]
const pool = createLightPool(scene, [...house.fixtures, ...site.fixtures], 8)
const sound = createSound()

const S = {
  mode: 'title',
  pos: new THREE.Vector3(START.x, 0, START.z),
  feet: 0,
  // カメラの足元の高さ。段差では、少しかけて追いつく
  eyeFeet: 0,
  yaw: START.yaw,
  pitch: -0.04,
  stride: 0,
  bob: 0,
  walking: false,
  running: false,
  locked: false,
  place: '',
  inside: false,
}

const keys = new Set()

/**
 * どれかのキーが押されていれば 1、なければ 0
 */
const pressed = (...codes) => (codes.some((code) => keys.has(code)) ? 1 : 0)

const forward = new THREE.Vector3()
const side = new THREE.Vector3()
const velocity = new THREE.Vector3()

/**
 * キーの入力から、進む向きと速さを velocity に入れる
 */
const keyVelocity = (dt) => {
  S.yaw += (pressed('ArrowLeft') - pressed('ArrowRight')) * 1.8 * dt
  const f = pressed('KeyW', 'ArrowUp') - pressed('KeyS', 'ArrowDown')
  const s = pressed('KeyD') - pressed('KeyA')
  forward.set(-Math.sin(S.yaw), 0, -Math.cos(S.yaw))
  side.set(Math.cos(S.yaw), 0, -Math.sin(S.yaw))
  velocity.set(0, 0, 0).addScaledVector(forward, f).addScaledVector(side, s)
  if (velocity.lengthSq() > 1) {
    velocity.normalize()
  }
  S.running = f >= 0 && pressed('ShiftLeft', 'ShiftRight') === 1
  let speed = S.running ? RUN : WALK
  if (f < 0) {
    speed = WALK * 0.65
  }
  velocity.multiplyScalar(speed)
}

/**
 * 歩いた距離に合わせて、床に合った足音を鳴らす。S.stride は、何歩進んだか
 */
const walkSounds = (dist, surface) => {
  if (dist < 0.0005) {
    S.walking = false
    return
  }
  S.walking = true
  const prev = Math.floor(S.stride)
  S.stride += dist / (S.running ? RUN_STRIDE : STRIDE)
  if (Math.floor(S.stride) !== prev) {
    sound.step(surface, S.running ? 0.75 : 0.5)
  }
}

/**
 * キーで動かす。壁で止まり、足元の高さに合わせる
 */
const move = (dt) => {
  keyVelocity(dt)
  const r = walker.move(S.pos, S.feet, velocity.x * dt, velocity.z * dt)
  const dist = Math.hypot(r.x - S.pos.x, r.z - S.pos.z)
  S.pos.x = r.x
  S.pos.z = r.z
  S.feet = r.h
  walkSounds(dist, r.s)
}

/**
 * いる場所の名前を、左下に小さく出す。家の中にいる間は、風の音を小さくする
 */
const updatePlace = () => {
  const at = places.find(
    (p) => S.pos.x >= p.x0 && S.pos.x <= p.x1 && S.pos.z >= p.z0 && S.pos.z <= p.z1,
  )
  const name = at ? at.name : ''
  const inside = house.places.includes(at)
  if (inside !== S.inside) {
    S.inside = inside
    sound.setWind(inside ? WIND_IN : WIND_OUT)
  }
  if (name === S.place) return
  S.place = name
  const el = $('place')
  if (!name) {
    el.classList.remove('shown')
    return
  }
  el.textContent = name
  el.classList.add('shown')
}

/**
 * カメラを目の高さに置く。歩いている間は、少し頭が揺れる
 */
const placeCamera = (dt) => {
  S.eyeFeet += (S.feet - S.eyeFeet) * Math.min(1, dt * 10)
  const sway = S.running ? 0.04 : 0.026
  const target = S.walking ? -Math.abs(Math.sin(S.stride * Math.PI)) * sway : 0
  S.bob += (target - S.bob) * Math.min(1, dt * 12)
  camera.position.set(S.pos.x, S.eyeFeet + EYE + S.bob, S.pos.z)
  camera.rotation.set(S.pitch, S.yaw, 0, 'YXZ')
}

/**
 * 影を作る範囲を、いる場所に合わせて動かす
 */
const followSun = () => {
  sun.target.position.set(S.pos.x, 0, S.pos.z)
  sun.position.copy(sun.target.position).addScaledVector(SUN_DIR, 90)
}

/**
 * マウスを画面にロックする。できなくても、ドラッグで見回せる
 */
const lockPointer = () => {
  const result = renderer.domElement.requestPointerLock?.()
  if (result?.catch) {
    result.catch(() => {})
  }
}

/**
 * タイトルを消して、歩き始める
 * @param lock - マウスをロックするか
 */
const begin = (lock = true) => {
  if (S.mode !== 'title') return
  $('title').classList.add('hidden')
  S.mode = 'play'
  S.locked = lock
  sound.start()
  sound.setWind(WIND_OUT)
  if (lock) {
    lockPointer()
  }
}

/**
 * 一時停止する。マウスのロックが外れた時に呼ぶ
 */
const pause = () => {
  S.mode = 'paused'
  keys.clear()
  $('pause').classList.remove('hidden')
}

/**
 * 一時停止から戻る
 */
const resume = () => {
  if (S.mode !== 'paused') return
  S.mode = 'play'
  $('pause').classList.add('hidden')
  if (S.locked) {
    lockPointer()
  }
}

const timer = new THREE.Timer()

/**
 * 毎フレームの処理
 */
const tick = (time) => {
  timer.update(time)
  const dt = Math.min(timer.getDelta(), 0.05)
  if (S.mode === 'play') {
    move(dt)
    updatePlace()
  } else {
    S.walking = false
  }
  placeCamera(dt)
  followSun()
  pool.update(camera.position)
  renderer.render(scene, camera)
}

addEventListener('keydown', (e) => keys.add(e.code))
addEventListener('keyup', (e) => keys.delete(e.code))
addEventListener('blur', () => keys.clear())

document.addEventListener('mousemove', (e) => {
  if (S.mode !== 'play') return
  const locked = document.pointerLockElement === renderer.domElement
  if (!locked && !(e.buttons & 1)) return
  S.yaw -= e.movementX * 0.0022
  S.pitch = THREE.MathUtils.clamp(S.pitch - e.movementY * 0.0022, -1.2, 1.2)
})

document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement) return
  if (S.mode === 'play' && S.locked) {
    pause()
  }
})

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(innerWidth, innerHeight)
})

$('start').addEventListener('click', () => begin())
$('pause').addEventListener('click', resume)
renderer.setAnimationLoop(tick)

// 開発中だけ、確かめるための入口を置く
if (import.meta.env.DEV) {
  window.__jikka = {
    S,
    places,
    renderer,
    scene,
    camera,
    start: () => begin(false),
    tp: (x, z, yaw = S.yaw) => {
      S.pos.x = x
      S.pos.z = z
      S.feet = walker.heightAt(x, z)
      S.eyeFeet = S.feet
      S.yaw = yaw
      updatePlace()
    },
    look: (yaw, pitch = 0) => {
      S.yaw = yaw
      S.pitch = pitch
    },
  }
}
