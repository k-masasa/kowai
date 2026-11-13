import * as THREE from 'three'
import './style.css'
import { W, SEG, buildWorld } from './world.js'
import { createFigure } from './figure.js'
import { createSound } from './sound.js'

// あしおと
// 夜のマンションの内廊下を歩いて、207号室に帰る。廊下はループしていて、周回するたびに
// 自分の足音が増え、明かりが消え、最後は「見ていない間だけ近づく」顔の無い人に追われる。
// 時刻、遊んだ回数、タブを離れていた時間を使う。データはブラウザの外に出さない。

const EYE = 1.55
const WALK = 1.45
const STRIDE = 0.72
const FLASH = 8
const STORE = 'kowai.ashioto'

/**
 * id で要素を取る
 */
const $ = (id) => document.getElementById(id)

/**
 * 前に遊んだ記録を、localStorage から読む
 */
const loadMemory = () => {
  try {
    return { visits: 0, last: null, ...JSON.parse(localStorage.getItem(STORE) || '{}') }
  } catch {
    return { visits: 0, last: null }
  }
}

const memory = loadMemory()
const S = {
  mode: 'title',
  memory,
  // 前に遊んだことがあると、1段早く進む
  head: memory.visits > 0 ? 1 : 0,
  lap: 0,
  pos: new THREE.Vector3(0, EYE, -2),
  yaw: 0,
  pitch: 0,
  stride: 0,
  bob: 0,
  walking: false,
  idle: 0,
  locked: false,
  dark: false,
  startedAt: new Date(),
  clockFrozen: false,
  lastSecond: -1,
  noticeStage: -1,
  darkened: false,
  ahead: false,
  aheadDone: false,
  vanishIn: 0,
  final: false,
  flickerIn: 0,
  darkFor: 0,
  beatIn: 0,
  moved: 0,
  hum: 0,
  awayAt: 0,
  awayPending: false,
  whisperTimer: 0,
  cine: 0,
  timeline: [],
  homeFrom: null,
  homeYaw: 0,
}

/**
 * 遊んだ記録を、localStorage に書く
 */
const saveMemory = () => {
  try {
    localStorage.setItem(STORE, JSON.stringify(S.memory))
  } catch {
    // 書けなくても遊べるので、何もしない
  }
}

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
renderer.setSize(innerWidth, innerHeight)
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 0.95
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
document.body.prepend(renderer.domElement)

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x000000)
scene.fog = new THREE.FogExp2(0x000000, 0.11)

const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.05, 60)
scene.add(camera)

const flashlight = new THREE.SpotLight(0xfff1dc, FLASH, 22, Math.PI / 7, 0.5, 2)
flashlight.position.set(0.12, -0.12, 0.05)
flashlight.target.position.set(0, -0.05, -1)
flashlight.castShadow = true
flashlight.shadow.mapSize.set(1024, 1024)
flashlight.shadow.camera.near = 0.1
flashlight.shadow.camera.far = 20
flashlight.shadow.bias = -0.0005
camera.add(flashlight, flashlight.target)
scene.add(new THREE.HemisphereLight(0x8a90a0, 0x1a1612, 0.06))

const world = buildWorld(scene)
const figure = createFigure()
figure.group.visible = false
scene.add(figure.group)
const sound = createSound()

/**
 * 今の怖さの段階
 */
const level = () => S.lap + S.head

/**
 * xz 平面での距離
 */
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z)

/**
 * 時刻を「21:47」の形にする
 */
const clockText = (date) => `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`

/**
 * 日付を「11月13日 (金)」の形にする
 */
const dateText = (date) =>
  `${date.getMonth() + 1}月${date.getDate()}日 (${'日月火水木金土'[date.getDay()]})`

/**
 * 角度を、近い回り方で補間する
 */
const lerpAngle = (a, b, t) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t

/**
 * タイトルに出す一言。前に遊んだ記録と、今の時刻で変える
 */
const greetingText = () => {
  if (S.memory.last === 'caught') return '前は、つかまりましたね。'
  if (S.memory.visits > 0) return 'また来たんですね。'
  const hour = new Date().getHours()
  if (hour < 5) return 'こんな時間に、まだ起きてるんですね。'
  if (hour < 11) return '朝から、こんなところに。'
  if (hour < 17) return 'まだ明るいのに。'
  return 'おかえりなさい。'
}

/**
 * 段階ごとの、貼り紙の文面
 */
const noticeLines = (stage) => {
  if (stage === 2) return ['207号室の方へ', '', '足音が、', 'ふたり分します。']
  if (stage === 1) {
    return ['207号室の方へ', '', '夜中の足音が', 'ひびいています。', '静かに歩いて', 'ください。']
  }
  return [
    'お知らせ',
    '',
    `${dateText(S.startedAt)}の夜、`,
    '共用廊下の照明を',
    '点検します。',
    '',
    '管理会社',
  ]
}

/**
 * 貼り紙の文面を、段階に合わせて書き換える
 */
const updateNotice = () => {
  const L = level()
  let stage = 0
  if (L >= 3) {
    stage = 2
  } else if (L >= 2) {
    stage = 1
  }
  if (stage === S.noticeStage) return
  S.noticeStage = stage
  world.notice.draw(noticeLines(stage))
}

/**
 * 画面の下に、ささやきの文字を少しだけ出す
 */
const whisper = (text) => {
  const el = $('whisper')
  el.textContent = text
  el.style.opacity = 1
  clearTimeout(S.whisperTimer)
  S.whisperTimer = setTimeout(() => {
    el.style.opacity = 0
  }, 2600)
}

/**
 * エンディングの文を出す
 */
const showEnding = (lines) => {
  $('ending').classList.remove('hidden')
  $('ending-text').textContent = lines.join('\n')
}

/**
 * エンディングの最後に「Enter でタイトルへ」を出す。マウスのロックもここで外す
 */
const showNext = () => {
  document.exitPointerLock?.()
  $('ending-next').classList.remove('hidden')
}

/**
 * エンディングからタイトルに戻る。まだ戻れない間は何もしない
 */
const backToTitle = () => {
  if ($('ending-next').classList.contains('hidden')) return
  location.reload()
}

/**
 * 画面を黒くする
 * @param seconds - 黒くなるまでの時間。0 ならすぐ
 */
const fadeOut = (seconds) => {
  const el = $('fade')
  el.style.transition = seconds > 0 ? `opacity ${seconds}s` : 'none'
  el.style.opacity = 1
}

/**
 * マウスを画面にロックする。できなくても、ドラッグで見回せる
 */
const lockPointer = () => {
  const result = renderer.domElement.requestPointerLock?.()
  if (result?.catch) result.catch(() => {})
}

/**
 * タイトルから遊び始める
 * @param lock - マウスを画面にロックするか。ロックすると、マウスを動かすだけで見回せる
 */
const begin = (lock = true) => {
  if (S.mode !== 'title') return
  S.mode = 'play'
  S.locked = lock
  S.startedAt = new Date()
  S.memory.visits += 1
  saveMemory()
  $('title').classList.add('hidden')
  sound.start()
  sound.setDrone(0.15)
  updateNotice()
  if (lock) lockPointer()
  console.log('%cここも、見てるんですね。', 'color:#a33;font-size:13px')
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
  if (S.locked) lockPointer()
  if (S.awayPending) applyAway()
}

/**
 * 画面から離れていた分、何かが進んでいる
 */
const applyAway = () => {
  S.awayPending = false
  if (level() < 1) return
  whisper('どこに行ってたの？')
  sound.whisper()
  if (!S.final) {
    world.openDoorNear(S.pos.z)
    return
  }
  const fig = figure.group.position
  const d = flat(fig, S.pos)
  const pull = Math.min(4, Math.max(d - 2.2, 0))
  fig.x += ((S.pos.x - fig.x) / d) * pull
  fig.z += ((S.pos.z - fig.z) / d) * pull
}

/**
 * 明かりを全部消す / 付ける
 */
const setDark = (dark) => {
  S.dark = dark
  flashlight.intensity = dark ? 0 : FLASH
}

/**
 * 先の方に、背中を向けて立たせる
 */
const showAhead = () => {
  S.ahead = true
  S.aheadDone = true
  S.clockFrozen = true
  figure.group.position.set(0.28, 0, -18.3)
  figure.randomPose(0)
  figure.face(S.pos, true)
  figure.group.visible = true
}

/**
 * 先に立っている人を消す
 */
const hideAhead = () => {
  S.ahead = false
  S.vanishIn = 0
  figure.group.visible = false
}

/**
 * 最後の周回。うしろの暗がりに立たせて、見ていない間だけ近づかせる
 */
const startChase = () => {
  S.final = true
  world.setFinal()
  figure.group.position.set(0, 0, S.pos.z + 11.5)
  figure.randomPose(0)
  figure.face(S.pos)
  figure.group.visible = true
  S.flickerIn = 3
  S.darkFor = 0
  sound.slam(0.45)
  console.log('%cうしろ', 'color:#a33;font-size:13px')
}

/**
 * 周回が変わった時に、廊下の様子を段階に合わせて変える
 * @param dir - 前に進んで越えたら 'forward'、うしろに下がって越えたら 'back'
 */
const applyLap = (dir) => {
  const L = level()
  world.resetLamps(L >= 2)
  if (S.ahead) hideAhead()
  if (L >= 2 && !S.darkened) {
    S.darkened = true
    sound.clunk()
  }
  updateNotice()
  if (dir !== 'forward') return
  if (L >= 3 && !S.aheadDone) {
    showAhead()
    return
  }
  if (L >= 4) startChase()
}

/**
 * 廊下の反対の端へ移す。顔の無い人も一緒に動かすので、見た目は変わらない
 */
const wrap = (dz, dir) => {
  S.pos.z += dz
  figure.group.position.z += dz
  S.lap += 1
  applyLap(dir)
}

/**
 * 自分の足音と、少し遅れて鳴る、もう1人の足音の大きさ
 */
const echoVolume = () => {
  const L = level()
  if (L < 1 || S.final) return 0
  return Math.min(0.08 + 0.07 * (L - 1), 0.3)
}

/**
 * 1歩分の足音を鳴らす
 */
const footstep = () => {
  sound.step(0.5)
  const echo = echoVolume()
  if (echo > 0) sound.step(echo, { muffle: 0.65, when: 0.31 + Math.random() * 0.03 })
}

/**
 * 立ち止まった時。段階が進んでいると、もう1人の足音が1歩だけ多い
 */
const onStop = () => {
  if (level() < 2) return
  const echo = echoVolume()
  if (echo > 0) sound.step(echo, { muffle: 0.65, when: 0.62 })
}

/**
 * 207号室に入った。ドアを開けて中に入り、暗転のあとにノックを鳴らす
 */
const goHome = () => {
  S.mode = 'home'
  S.cine = 0
  S.memory.last = 'home'
  saveMemory()
  S.homeFrom = S.pos.clone()
  S.homeYaw = S.yaw
  setDark(false)
  sound.creak()
  sound.setDrone(0)
  const time = clockText(new Date())
  const lines = [time, '部屋に、帰ってきました。']
  S.timeline = [
    [0.9, () => fadeOut(0.7)],
    [1.8, () => sound.slam(0.8)],
    [3.2, () => showEnding(lines)],
    [5.4, () => sound.knock(3)],
    [7.2, () => showEnding([...lines, '', 'ドアの前で、足音が止まりました。'])],
    [8.6, () => showNext()],
  ]
}

/**
 * つかまった。振り向かせて、目の前に顔を出す
 */
const caught = () => {
  S.mode = 'caught'
  S.cine = 0
  S.memory.last = 'caught'
  saveMemory()
  setDark(false)
  const fig = figure.group.position
  S.yaw = Math.atan2(-(fig.x - S.pos.x), -(fig.z - S.pos.z))
  S.pitch = 0.04
  fig.set(S.pos.x - Math.sin(S.yaw) * 0.42, 0, S.pos.z - Math.cos(S.yaw) * 0.42)
  figure.face(S.pos)
  figure.scarePose()
  sound.setDrone(0)
  sound.scare()
  const time = clockText(new Date())
  S.timeline = [
    [0.9, () => fadeOut(0)],
    [2.0, () => showEnding([time, 'あなたの歩き方を、おぼえました。'])],
    [4.0, () => showNext()],
  ]
}

/**
 * 廊下の端の処理。最後の周回の前はループさせ、最後の周回では突き当たりで止める
 */
const bounds = () => {
  if (S.final) {
    S.pos.z = Math.min(S.pos.z, SEG - 1)
    if (S.pos.z > -SEG + 0.9) return
    if (Math.abs(S.pos.x) < 0.42) {
      goHome()
      return
    }
    S.pos.z = -SEG + 0.9
    return
  }
  if (S.pos.z < -SEG) {
    wrap(SEG, 'forward')
    return
  }
  if (S.pos.z > 0) wrap(-SEG, 'back')
}

const keys = new Set()

/**
 * どれかのキーが押されていれば 1
 */
const pressed = (...codes) => (codes.some((code) => keys.has(code)) ? 1 : 0)

const forward = new THREE.Vector3()
const side = new THREE.Vector3()
const velocity = new THREE.Vector3()

/**
 * 歩いた距離に合わせて、足音を鳴らす
 */
const walkSounds = (dist) => {
  if (dist < 0.0005) {
    if (S.walking) onStop()
    S.walking = false
    return
  }
  S.walking = true
  S.idle = 0
  const before = Math.floor(S.stride / STRIDE)
  S.stride += dist
  if (Math.floor(S.stride / STRIDE) !== before) footstep()
}

/**
 * キーでプレイヤーを動かす
 */
const move = (dt) => {
  S.yaw += (pressed('ArrowLeft') - pressed('ArrowRight')) * 1.9 * dt
  const f = pressed('KeyW', 'ArrowUp') - pressed('KeyS', 'ArrowDown')
  const s = pressed('KeyD') - pressed('KeyA')
  forward.set(-Math.sin(S.yaw), 0, -Math.cos(S.yaw))
  side.set(Math.cos(S.yaw), 0, -Math.sin(S.yaw))
  velocity.set(0, 0, 0).addScaledVector(forward, f).addScaledVector(side, s)
  if (velocity.lengthSq() > 1) velocity.normalize()
  velocity.multiplyScalar(f < 0 ? WALK * 0.65 : WALK)
  S.pos.addScaledVector(velocity, dt)
  S.pos.x = THREE.MathUtils.clamp(S.pos.x, -W / 2 + 0.28, W / 2 - 0.28)
  walkSounds(velocity.length() * dt)
  bounds()
}

/**
 * 通り過ぎた蛍光灯を、うしろから消していく
 */
const updatePassedLamps = () => {
  if (level() < 2 || S.final) return
  world.here.lamps.forEach((lamp) => {
    if (lamp.target === 0 || lamp.dying > 0) return
    if (S.pos.z < lamp.z - 1.6) world.killLamp(lamp)
  })
}

/**
 * 先に立っている人に近づいたら、蛍光灯のちらつきの間に消す
 */
const updateAhead = (dt) => {
  if (!S.ahead) return
  if (S.vanishIn > 0) {
    S.vanishIn -= dt
    if (S.vanishIn <= 0) hideAhead()
    return
  }
  if (flat(S.pos, figure.group.position) > 7.8) return
  world.here.lamps[2].stutter = 0.45
  sound.flicker()
  S.vanishIn = 0.12
}

const frustum = new THREE.Frustum()
const projView = new THREE.Matrix4()
const sphere = new THREE.Sphere(new THREE.Vector3(), 0.45)

/**
 * 顔の無い人が、画面に写っているか
 */
const inView = () => {
  camera.updateMatrixWorld()
  projView.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
  frustum.setFromProjectionMatrix(projView)
  sphere.center.copy(figure.group.position).setY(1.0)
  return frustum.intersectsSphere(sphere)
}

/**
 * 顔の無い人の、今の速さ。明かりが消えている間は速く、見られている間は止まる
 */
const chaseSpeed = () => {
  if (S.dark) return 4.2
  if (inView()) return 0
  return 2.05
}

/**
 * 最後の周回の、停電のようなちらつき。近づかれているほど間隔が短い
 * @param near - 0 から 1。近いほど大きい
 */
const flickers = (dt, near) => {
  if (S.darkFor > 0) {
    S.darkFor -= dt
    if (S.darkFor > 0) return
    setDark(false)
    figure.randomPose(near)
    return
  }
  S.flickerIn -= dt
  if (S.flickerIn > 0) return
  S.darkFor = 0.18 + Math.random() * 0.32
  S.flickerIn = THREE.MathUtils.lerp(4.2, 1.5, near) + Math.random() * 1.6
  setDark(true)
  sound.flicker()
}

/**
 * 近づかれているほど、心臓の音を速く鳴らす
 */
const heartbeat = (dt, near) => {
  if (near < 0.35) return
  S.beatIn -= dt
  if (S.beatIn > 0) return
  S.beatIn = THREE.MathUtils.lerp(1.1, 0.42, near)
  sound.heartbeat(0.25 + near * 0.5)
}

/**
 * 追いかけっこの1フレーム分
 */
const updateChase = (dt) => {
  if (!S.final) return
  const fig = figure.group.position
  const d = flat(fig, S.pos)
  if (d < 0.75) {
    caught()
    return
  }
  const near = THREE.MathUtils.clamp(1 - d / 12, 0, 1)
  flickers(dt, near)
  const speed = chaseSpeed()
  if (speed > 0) {
    const stepLen = Math.min(speed * dt, d - 0.3)
    fig.x += ((S.pos.x - fig.x) / d) * stepLen
    fig.z += ((S.pos.z - fig.z) / d) * stepLen
    S.moved += stepLen
    if (S.moved > 0.75) {
      S.moved = 0
      sound.step(THREE.MathUtils.clamp(2.4 / (d + 1), 0.08, 0.8), { muffle: 0.3 })
    }
  }
  figure.face(S.pos)
  heartbeat(dt, near)
  sound.setDrone(0.25 + near * 0.75)
}

/**
 * しばらく立ち止まっていると、うしろから足音が近づいてくる
 */
const updateIdle = (dt) => {
  if (S.final || level() < 1 || S.walking) return
  S.idle += dt
  if (S.idle < 22) return
  S.idle = -40
  sound.approach()
}

/**
 * 遊んでいる間の1フレーム分
 */
const updatePlay = (dt) => {
  move(dt)
  if (S.mode !== 'play') return
  updatePassedLamps()
  updateAhead(dt)
  updateChase(dt)
  if (S.mode !== 'play') return
  updateIdle(dt)
}

/**
 * 演出の予定のうち、時間が来たものを実行する
 */
const runTimeline = () => {
  while (S.timeline.length > 0 && S.timeline[0][0] <= S.cine) {
    const [, action] = S.timeline.shift()
    action()
  }
}

/**
 * つかまった直後の演出。懐中電灯がちらつく
 */
const updateCaught = (dt) => {
  S.cine += dt
  if (S.cine < 0.9) flashlight.intensity = Math.random() < 0.4 ? 0 : FLASH * 1.3
  runTimeline()
}

/**
 * 207号室に入る演出。ドアを開けて、中へ進む
 */
const updateHome = (dt) => {
  S.cine += dt
  const k = Math.min(S.cine / 1.5, 1)
  const e = k * k * (3 - 2 * k)
  world.end.door.hinge.rotation.y = -0.62 - e * 0.9
  S.pos.z = THREE.MathUtils.lerp(S.homeFrom.z, -SEG - 0.9, e)
  S.pos.x = THREE.MathUtils.lerp(S.homeFrom.x, 0.1, e)
  S.yaw = lerpAngle(S.homeYaw, 0, e)
  S.pitch *= 0.9
  runTimeline()
}

/**
 * 壁の時計を、秒が変わった時だけ描き直す。途中からは、遊び始めた時刻で止まる
 */
const updateClock = () => {
  const now = S.clockFrozen ? S.startedAt : new Date()
  const second = now.getMinutes() * 60 + now.getSeconds()
  if (second === S.lastSecond) return
  S.lastSecond = second
  world.clock.draw(now)
}

/**
 * 近くの蛍光灯のうなりを、大きさが変わった時だけ伝える
 */
const updateHum = () => {
  const hum = S.dark || S.mode === 'title' ? 0 : world.humAt(S.pos.z)
  if (Math.abs(hum - S.hum) < 0.03) return
  S.hum = hum
  sound.setHum(hum)
}

/**
 * カメラをプレイヤーの目の位置に置く。歩いている間は、少し頭が揺れる
 */
const placeCamera = (dt) => {
  const target = S.walking ? -Math.abs(Math.sin((S.stride / STRIDE) * Math.PI)) * 0.028 : 0
  S.bob += (target - S.bob) * Math.min(1, dt * 12)
  camera.position.set(S.pos.x, EYE + S.bob, S.pos.z)
  camera.rotation.set(S.pitch, S.yaw, 0, 'YXZ')
}

const timer = new THREE.Timer()

/**
 * 毎フレームの処理
 */
const tick = (time) => {
  timer.update(time)
  const dt = Math.min(timer.getDelta(), 0.05)
  if (S.mode === 'play') updatePlay(dt)
  if (S.mode === 'caught') updateCaught(dt)
  if (S.mode === 'home') updateHome(dt)
  world.update(dt, S.dark, () => sound.clunk())
  updateClock()
  updateHum()
  placeCamera(dt)
  renderer.render(scene, camera)
}

addEventListener('keydown', (e) => {
  keys.add(e.code)
  if (e.code === 'Enter' || e.code === 'Space') backToTitle()
})
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
  if (S.mode === 'play' && S.locked) pause()
})

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    S.awayAt = performance.now()
    return
  }
  if (!S.awayAt) return
  const away = performance.now() - S.awayAt
  S.awayAt = 0
  if (away < 1500) return
  if (S.mode !== 'play' && S.mode !== 'paused') return
  S.awayPending = true
  if (S.mode === 'play') applyAway()
})

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(innerWidth, innerHeight)
})

$('title').addEventListener('click', () => begin(true))
$('pause').addEventListener('click', resume)
$('ending').addEventListener('click', backToTitle)

$('greeting').textContent = greetingText()
updateNotice()
renderer.setAnimationLoop(tick)

// 開発中だけ、確かめるための入口を置く
if (import.meta.env.DEV) {
  window.__ashioto = {
    S,
    figure,
    start: () => begin(false),
    lap: (n) => {
      S.lap = n - 1
      S.pos.z = -SEG - 0.01
      bounds()
    },
    look: (yaw, pitch = 0) => {
      S.yaw = yaw
      S.pitch = pitch
    },
  }
}
