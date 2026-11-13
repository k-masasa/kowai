import * as THREE from 'three'
import './style.css'
import { FH, FLOORS, buildBuilding, floorY } from './building.js'
import { createLightPool } from './lights.js'
import { createFigure } from './figure.js'
import { createSound } from './sound.js'

// あしおと
// 夜、マンションの前の道から歩いて帰る。階段を上がって、4階の廊下の一番奥の412号室に入れば終わり。
// ふつう以上では、3階から4階へ上がったはずなのに、また3階に出ることがある。最後は4階の廊下で、
// 見ていない間だけ近づく顔の無い人から逃げる。時刻、遊んだ回数、タブを離れていた時間を使う。データは外に出さない。

const EYE = 1.55
const WALK = 1.15
const STRIDE = 0.68
const STORE = 'kowai.ashioto'
// 階段でこれだけ下りると死ぬ (m)
const BACK_LIMIT = 6
// 4階の廊下でここを過ぎたら、追いかけが始まる (x)
const CHASE_X = 24

// 難しさごとの設定
// start: 追いかけの最初の距離、walk: 見ていない間の速さ、rush: 停電の間の速さ
// gap: 停電の間隔 (遠い時、近い時)、dark: 停電の長さ (最短、ばらつき)、flash: 懐中電灯の明るさ
// strict: 階段を下り続けると死ぬか、repeat: 3階が続く回数
// events: たまに起こる出来事。torch (懐中電灯が切れる) と peek (窓から覗く) は間隔 (最短、ばらつき) の秒数、
// knob (ドアノブが鳴る) は、ドアの目の前まで来た時に鳴る確率
const LEVELS = {
  easy: {
    start: 11.5,
    walk: 2.0,
    rush: 4.2,
    gap: [4.2, 1.5],
    dark: [0.18, 0.32],
    flash: 8,
    strict: false,
    repeat: 0,
    events: null,
  },
  normal: {
    start: 10.5,
    walk: 2.2,
    rush: 4.4,
    gap: [4.0, 1.4],
    dark: [0.18, 0.3],
    flash: 7,
    strict: true,
    repeat: 3,
    events: { torch: [25, 20], knob: 0.1, peek: [16, 12] },
  },
  hard: {
    start: 9.5,
    walk: 2.45,
    rush: 4.6,
    gap: [3.6, 1.3],
    dark: [0.2, 0.28],
    flash: 5.5,
    strict: true,
    repeat: 4,
    events: { torch: [15, 15], knob: 0.1, peek: [10, 10] },
  },
}

// ドアノブが鳴ったあと、次に鳴れるようになるまでの秒数
const KNOB_REST = 40
// ドアノブを押し下げる時刻 (秒)。1回試して、少し間を空けて何度か
const KNOB_BEATS = [0, 0.5, 0.64, 0.78, 1.3, 1.44]
const KNOB_LEN = 1.6

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
  level: LEVELS.easy,
  memory,
  // 前に遊んだことがあると、1段早く怖くなる
  head: memory.visits > 0 ? 1 : 0,
  pos: new THREE.Vector3(-8, 0, 2.0),
  feet: 0,
  yaw: -1.33,
  pitch: 0.08,
  tag: 'S',
  prevTag: 'S',
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
  inside: false,
  onFourth: false,
  loops: 0,
  repeatLeft: 0,
  looping: false,
  ahead: false,
  vanishIn: 0,
  final: false,
  flickerIn: 0,
  darkFor: 0,
  beatIn: 0,
  moved: 0,
  back: 0,
  hum: 0,
  slamFor: 0,
  awayAt: 0,
  awayPending: false,
  whisperTimer: 0,
  torchIn: 0,
  torchWarn: 0,
  torchOff: 0,
  knobIn: 0,
  peekIn: 0,
  peekFor: 0,
  peekSeen: 0,
  peekWin: null,
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
renderer.toneMappingExposure = 1.0
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
document.body.prepend(renderer.domElement)

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x05070b)
scene.fog = new THREE.FogExp2(0x05070b, 0.05)

const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.05, 140)
scene.add(camera)

const flashlight = new THREE.SpotLight(0xfff1dc, LEVELS.easy.flash, 22, Math.PI / 7, 0.5, 2)
flashlight.position.set(0.12, -0.12, 0.05)
flashlight.target.position.set(0, -0.05, -1)
flashlight.castShadow = true
flashlight.shadow.mapSize.set(1024, 1024)
flashlight.shadow.camera.near = 0.1
flashlight.shadow.camera.far = 20
flashlight.shadow.bias = -0.0005
camera.add(flashlight, flashlight.target)
scene.add(new THREE.HemisphereLight(0x3a4458, 0x0c0c0f, 0.35))
const moon = new THREE.DirectionalLight(0x8090b0, 0.25)
moon.position.set(-20, 40, 30)
scene.add(moon)

const building = buildBuilding(scene)
const pool = createLightPool(scene, building.fixtures, 10)
const figure = createFigure()
figure.group.visible = false
scene.add(figure.group)
const sound = createSound()
const homeDoor = building.doors.find((d) => d.home)
const eye = new THREE.Vector3()

/**
 * 今の怖さの段階
 */
const level = () => S.loops + S.head

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
 * 出来事の次の間隔を決める
 * @param range - [最短, ばらつき] (秒)
 */
const nextIn = ([min, spread]) => min + Math.random() * spread

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
 * 段階ごとの、エントランスの貼り紙の文面
 */
const noticeLines = (stage) => {
  if (stage === 2) return ['412号室の方へ', '', '足音が、', 'ふたり分します。']
  if (stage === 1) {
    return ['412号室の方へ', '', '夜中の足音が', 'ひびいています。', '静かに歩いて', 'ください。']
  }
  return [
    'お知らせ',
    '',
    `${dateText(S.startedAt)}の夜、`,
    '共用部の照明を',
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
  building.notice.draw(noticeLines(stage))
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
 * @param levelName - 'easy' / 'normal' / 'hard'
 * @param lock - マウスを画面にロックするか。ロックすると、マウスを動かすだけで見回せる
 */
const begin = (levelName = 'easy', lock = true) => {
  if (S.mode !== 'title') return
  S.mode = 'play'
  S.level = LEVELS[levelName] || LEVELS.easy
  S.repeatLeft = S.level.repeat
  flashlight.intensity = S.level.flash
  S.locked = lock
  S.startedAt = new Date()
  S.memory.visits += 1
  saveMemory()
  $('title').classList.add('hidden')
  sound.start()
  sound.setDrone(0.12)
  updateNotice()
  if (S.level.events) {
    S.torchIn = nextIn(S.level.events.torch)
    S.knobIn = 0
    S.peekIn = nextIn(S.level.events.peek)
  }
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
  if (S.final) {
    const fig = figure.group.position
    const d = flat(fig, S.pos)
    const pull = Math.min(4, Math.max(d - 2.2, 0))
    fig.x += ((S.pos.x - fig.x) / d) * pull
    fig.z += ((S.pos.z - fig.z) / d) * pull
    return
  }
  const door = building.doors.find(
    (d) => !d.home && Math.abs(d.y - S.feet) < 1 && flat(d, S.pos) < 6 && d.hinge.rotation.y === 0,
  )
  if (door) door.hinge.rotation.y = -0.45
}

/**
 * 建物の中の明かりを全部消す / 付ける
 */
const setDark = (dark) => {
  S.dark = dark
}

/**
 * 3階と4階の間の踊り場に、背中を向けて立たせる
 */
const showAhead = () => {
  S.ahead = true
  figure.group.position.set(0.9, floorY(3) + FH / 2, -4.35)
  figure.randomPose(0)
  figure.group.rotation.y = Math.PI
  figure.group.visible = true
}

/**
 * 踊り場に立っている人を消す
 */
const hideAhead = () => {
  S.ahead = false
  S.vanishIn = 0
  figure.group.visible = false
}

/**
 * 踊り場の人に近づいたら、照明のちらつきの間に消す
 */
const updateAhead = (dt) => {
  if (!S.ahead) return
  if (S.vanishIn > 0) {
    S.vanishIn -= dt
    if (S.vanishIn <= 0) hideAhead()
    return
  }
  const fp = figure.group.position
  if (Math.abs(fp.y - S.feet) > 2.2 || flat(fp, S.pos) > 3.2) return
  const lamp = building.fixtures.find((f) => f.stair === 3.5)
  if (lamp) lamp.stutter = 0.5
  sound.flicker()
  S.vanishIn = 0.12
}

/**
 * 3階から4階へ上がったはずが、また3階に出た
 */
const onLoop = () => {
  S.loops += 1
  sound.whisper()
  updateNotice()
  if (S.loops >= 2) {
    S.clockFrozen = true
    building.fixtures.forEach((f) => {
      if (f.stair && f.stair < 3) f.on = false
    })
  }
  if (S.loops === 2) showAhead()
  if (S.loops >= 3) {
    building.fixtures.forEach((f) => {
      if (f.stair === 3 || f.stair === 3.5) f.faulty = true
    })
  }
}

/**
 * 階段の場所が変わった時の出来事。3階と4階の間の踊り場で、次に着く階を決める
 */
const onStairs = () => {
  if (S.tag === 'M3' && S.prevTag === 'A3' && !S.looping && S.repeatLeft > 0) {
    S.looping = true
    building.signs.find((s) => s.floor === 4).draw('3F')
  }
  if (S.tag !== 'L4' || !S.looping) return
  // 4階に着いた瞬間に、そっくりな3階へ移す
  S.feet -= FH
  if (S.ahead) figure.group.position.y -= FH
  S.looping = false
  S.repeatLeft -= 1
  building.signs.find((s) => s.floor === 4).draw('4F')
  S.tag = 'L3'
  onLoop()
}

/**
 * 4階に着いた。412号室のドアが少し開いて、明かりが漏れている
 */
const reachFourth = () => {
  S.onFourth = true
  homeDoor.hinge.rotation.y = -0.6
  building.room.visible = true
  building.homeLamps.forEach((lamp) => {
    lamp.on = true
  })
}

/**
 * 最後の追いかけ。うしろの階段の扉が閉まり、廊下の入口に顔の無い人が立つ
 */
const startChase = () => {
  S.final = true
  building.zones.find((z) => z.tag === 'D4').on = false
  S.slamFor = 0.35
  sound.slam(0.6)
  const x = Math.max(7.3, S.pos.x - S.level.start)
  figure.group.position.set(x, floorY(4), -0.7)
  figure.randomPose(0)
  figure.face(S.pos)
  figure.group.visible = true
  S.flickerIn = 3
  S.darkFor = 0
  console.log('%cうしろ', 'color:#a33;font-size:13px')
}

/**
 * 4階の防火扉を閉める動き
 */
const updateSlam = (dt) => {
  if (S.slamFor <= 0) return
  S.slamFor = Math.max(0, S.slamFor - dt)
  const door = building.fireDoors.find((d) => d.floor === 4)
  door.group.rotation.y = Math.PI * (S.slamFor / 0.35)
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
 * 412号室に入った。ドアを開けて中に入り、暗転のあとにノックを鳴らす
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
 * 死んだ時の共通の処理。記録を残して、暗転とエンディングの予定を組む
 * @param line - エンディングに出す一文
 * @param at - 暗転するまでの秒数
 */
const die = (line, at) => {
  S.mode = 'caught'
  S.cine = 0
  S.memory.last = 'caught'
  saveMemory()
  setDark(false)
  S.ahead = false
  sound.setDrone(0)
  const time = clockText(new Date())
  S.timeline = [
    [at, () => fadeOut(0)],
    [at + 1.1, () => showEnding([time, line])],
    [at + 3.1, () => showNext()],
  ]
}

/**
 * 目の前に顔の無い人を立たせる
 */
const faceToFace = () => {
  figure.group.position.set(
    S.pos.x - Math.sin(S.yaw) * 0.42,
    S.feet,
    S.pos.z - Math.cos(S.yaw) * 0.42,
  )
  figure.face(S.pos)
  figure.scarePose()
  figure.group.visible = true
  sound.scare()
}

/**
 * つかまった。振り向かせて、目の前に顔を出す
 */
const caught = () => {
  const fig = figure.group.position
  S.yaw = Math.atan2(-(fig.x - S.pos.x), -(fig.z - S.pos.z))
  S.pitch = 0.04
  die('あなたの歩き方を、おぼえました。', 0.9)
  faceToFace()
}

/**
 * 階段を下りすぎた。目の前に立っている
 */
const downDeath = () => {
  die('下には、もう戻れません。', 0.9)
  faceToFace()
}

/**
 * 階段で、下りた高さを数える。上ると減る
 */
const trackDown = (dy) => {
  if (!S.level.strict || !S.inside) return
  S.back = Math.max(0, S.back - dy * 1.45)
  if (S.back > BACK_LIMIT) downDeath()
}

const keys = new Set()

/**
 * どれかのキーが押されていれば 1
 */
const pressed = (...codes) => (codes.some((code) => keys.has(code)) ? 1 : 0)

const forward = new THREE.Vector3()
const side = new THREE.Vector3()
const velocity = new THREE.Vector3()
const before = new THREE.Vector3()

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
  const prev = Math.floor(S.stride / STRIDE)
  S.stride += dist
  if (Math.floor(S.stride / STRIDE) !== prev) footstep()
}

/**
 * 場所に応じた出来事。建物に入る、階段、4階、追いかけ、412号室
 */
const onPlace = () => {
  if (!S.inside && S.tag === 'H1' && S.pos.z < -0.8) {
    S.inside = true
    building.zones.find((z) => z.tag === 'E').on = false
    sound.slam(0.25)
  }
  onStairs()
  if (!S.onFourth && !S.looping && (S.tag === 'H4' || S.tag === 'C4')) reachFourth()
  if (S.onFourth && !S.final && S.tag === 'C4' && S.pos.x > CHASE_X) startChase()
  const atHome = S.tag === 'C4' && Math.abs(S.pos.x - homeDoor.x) < 0.45 && S.pos.z < -0.95
  if (S.onFourth && atHome) goHome()
}

/**
 * キーでプレイヤーを動かす。歩ける区画からはみ出さないようにして、足元の高さも決める
 */
const move = (dt) => {
  S.yaw += (pressed('ArrowLeft') - pressed('ArrowRight')) * 1.8 * dt
  const f = pressed('KeyW', 'ArrowUp') - pressed('KeyS', 'ArrowDown')
  const s = pressed('KeyD') - pressed('KeyA')
  forward.set(-Math.sin(S.yaw), 0, -Math.cos(S.yaw))
  side.set(Math.cos(S.yaw), 0, -Math.sin(S.yaw))
  velocity.set(0, 0, 0).addScaledVector(forward, f).addScaledVector(side, s)
  if (velocity.lengthSq() > 1) velocity.normalize()
  velocity.multiplyScalar(f < 0 ? WALK * 0.65 : WALK)
  before.copy(S.pos)
  const feet = S.feet
  S.pos.addScaledVector(velocity, dt)
  const r = building.resolve(S.pos, S.feet)
  S.feet = r.feet
  if (r.zone && r.zone.tag !== S.tag) {
    S.prevTag = S.tag
    S.tag = r.zone.tag
  }
  walkSounds(flat(before, S.pos))
  trackDown(S.feet - feet)
  if (S.mode !== 'play') return
  onPlace()
}

const frustum = new THREE.Frustum()
const projView = new THREE.Matrix4()
const sphere = new THREE.Sphere(new THREE.Vector3(), 0.45)

/**
 * 今のカメラに写る範囲を計算し直す
 */
const updateFrustum = () => {
  camera.updateMatrixWorld()
  projView.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
  frustum.setFromProjectionMatrix(projView)
}

/**
 * 顔の無い人が、画面に写っているか
 */
const inView = () => {
  updateFrustum()
  sphere.center.copy(figure.group.position)
  sphere.center.y += 1.0
  return frustum.intersectsSphere(sphere)
}

/**
 * 顔の無い人の、今の速さ。明かりが消えている間は速く、見られている間は止まる
 */
const chaseSpeed = () => {
  if (S.dark) return S.level.rush
  if (inView()) return 0
  return S.level.walk
}

/**
 * 最後の追いかけの、停電のようなちらつき。近づかれているほど間隔が短い
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
  S.darkFor = S.level.dark[0] + Math.random() * S.level.dark[1]
  S.flickerIn = THREE.MathUtils.lerp(S.level.gap[0], S.level.gap[1], near) + Math.random() * 1.6
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
 * 追いかけの1フレーム分
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
 * 懐中電灯の明るさを決める。ふつう以上では、たまにちらついてから数秒切れる
 */
const updateTorch = (dt) => {
  const ev = S.level.events
  if (ev && S.torchWarn <= 0 && S.torchOff <= 0) {
    S.torchIn -= dt
    if (S.torchIn <= 0) S.torchWarn = 0.9
  }
  if (S.torchWarn > 0) {
    S.torchWarn -= dt
    if (S.torchWarn <= 0) {
      S.torchOff = 2.5 + Math.random() * 2
      sound.click()
    }
  } else if (S.torchOff > 0) {
    S.torchOff -= dt
    if (S.torchOff <= 0) {
      S.torchIn = nextIn(ev.torch)
      sound.click()
    }
  }
  let power = S.level.flash
  if (S.dark || S.torchOff > 0) {
    power = 0
  } else if (S.torchWarn > 0) {
    power = Math.random() < 0.5 ? 0 : S.level.flash
  }
  flashlight.intensity = power
}

const knobPoint = new THREE.Vector3()

/**
 * ふつう以上では、目の前まで来たドアのノブが、たまにガチャガチャ回る。
 * 1つのドアで試すのは、前に来るたびに1回だけ。鳴ったあとは、しばらく鳴らない
 */
const updateKnob = (dt) => {
  const ev = S.level.events
  if (!ev) return
  S.knobIn -= dt
  updateFrustum()
  building.doors.forEach((d) => {
    const near =
      !d.home && Math.abs(d.y - S.feet) < 1 && Math.abs(S.pos.x - d.x) < 0.7 && S.pos.z - d.z < 1.3
    if (!near) {
      d.tried = false
      return
    }
    if (d.tried) return
    knobPoint.set(d.x + 0.33, d.y + 1.0, d.z)
    if (!frustum.containsPoint(knobPoint)) return
    d.tried = true
    if (S.knobIn > 0 || d.hinge.rotation.y !== 0 || Math.random() > ev.knob) return
    d.rattle = KNOB_LEN
    sound.rattle(KNOB_BEATS)
    S.knobIn = KNOB_REST
  })
}

/**
 * ふつう以上では、見ていない間に窓の向こうに人が立つ。見つかると少しして消える
 */
const updatePeek = (dt) => {
  const ev = S.level.events
  if (!ev) return
  updateFrustum()
  if (S.peekWin) {
    const p = S.peekWin.pos
    S.peekFor -= dt
    if (frustum.containsPoint(p) && p.distanceTo(eye) < 14) S.peekSeen += dt
    const close = p.distanceTo(eye) < 2.2
    if (S.peekFor > 0 && S.peekSeen < 1.2 && !close) return
    S.peekWin.mesh.material = S.peekWin.normal
    S.peekWin = null
    sound.flicker()
    S.peekIn = nextIn(ev.peek)
    return
  }
  S.peekIn -= dt
  if (S.peekIn > 0) return
  const win = building.windows.find((w) => {
    const d = w.pos.distanceTo(eye)
    if (Math.abs(w.pos.y - eye.y) > 1.6) return false
    return d > 3 && d < 11 && !frustum.containsPoint(w.pos)
  })
  if (!win) {
    S.peekIn = 1.5
    return
  }
  win.mesh.material = win.peek
  S.peekWin = win
  S.peekFor = 14
  S.peekSeen = 0
}

/**
 * エントランスの自動ドアを開け閉めする。中に入った後は、もう開かない
 */
const updateEntrance = (dt) => {
  const near = !S.inside && Math.hypot(S.pos.x - 5.0, S.pos.z) < 2.2
  building.entrance.forEach((g) => {
    const target = g.userData.home + g.userData.side * (near ? 0.85 : 0)
    g.position.x += (target - g.position.x) * Math.min(1, dt * 4)
  })
}

/**
 * ドアノブのガチャガチャの動き。鳴る時刻に合わせて、レバーを押し下げる
 */
const updateRattle = (dt) => {
  building.doors.forEach((d) => {
    if (d.rattle <= 0) return
    d.rattle = Math.max(0, d.rattle - dt)
    const t = KNOB_LEN - d.rattle
    const beat = KNOB_BEATS.find((b) => t >= b && t < b + 0.12)
    d.lever.rotation.z = beat === undefined ? 0 : Math.sin(((t - beat) / 0.12) * Math.PI) * 0.5
  })
}

/**
 * 遊んでいる間の1フレーム分
 */
const updatePlay = (dt) => {
  move(dt)
  if (S.mode !== 'play') return
  updateAhead(dt)
  updateChase(dt)
  if (S.mode !== 'play') return
  updateIdle(dt)
  updateTorch(dt)
  updateKnob(dt)
  updatePeek(dt)
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
 * 死んだ直後の演出。懐中電灯がちらつく
 */
const updateCaught = (dt) => {
  S.cine += dt
  if (S.cine < 0.9) flashlight.intensity = Math.random() < 0.4 ? 0 : S.level.flash * 1.3
  runTimeline()
}

/**
 * 412号室に入る演出。ドアを開けて、中へ進む
 */
const updateHome = (dt) => {
  S.cine += dt
  const k = Math.min(S.cine / 1.5, 1)
  const e = k * k * (3 - 2 * k)
  homeDoor.hinge.rotation.y = -0.6 - e * 0.9
  S.pos.x = THREE.MathUtils.lerp(S.homeFrom.x, homeDoor.x + 0.1, e)
  S.pos.z = THREE.MathUtils.lerp(S.homeFrom.z, homeDoor.z - 1.0, e)
  S.yaw = lerpAngle(S.homeYaw, 0, e)
  S.pitch *= 0.9
  runTimeline()
}

/**
 * エントランスの時計を、秒が変わった時だけ描き直す。途中からは、遊び始めた時刻で止まる
 */
const updateClock = () => {
  const now = S.clockFrozen ? S.startedAt : new Date()
  const second = now.getMinutes() * 60 + now.getSeconds()
  if (second === S.lastSecond) return
  S.lastSecond = second
  building.clock.draw(now)
}

/**
 * 蛍光灯のうなりを、大きさが変わった時だけ伝える
 */
const updateHum = (hum) => {
  const target = S.mode === 'title' ? 0 : hum
  if (Math.abs(target - S.hum) < 0.03) return
  S.hum = target
  sound.setHum(target)
}

/**
 * カメラをプレイヤーの目の位置に置く。歩いている間は、少し頭が揺れる
 */
const placeCamera = (dt) => {
  const target = S.walking ? -Math.abs(Math.sin((S.stride / STRIDE) * Math.PI)) * 0.026 : 0
  S.bob += (target - S.bob) * Math.min(1, dt * 12)
  camera.position.set(S.pos.x, S.feet + EYE + S.bob, S.pos.z)
  camera.rotation.set(S.pitch, S.yaw, 0, 'YXZ')
  eye.copy(camera.position)
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
  updateSlam(dt)
  updateRattle(dt)
  updateEntrance(dt)
  updateClock()
  placeCamera(dt)
  updateHum(pool.update(eye, S.dark, dt))
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

document.querySelectorAll('#levels button').forEach((button) => {
  button.addEventListener('click', () => begin(button.dataset.level))
})
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
    building,
    floors: FLOORS,
    pick: (nx, ny) => {
      const ray = new THREE.Raycaster()
      ray.setFromCamera(new THREE.Vector2(nx, ny), camera)
      return ray
        .intersectObjects(scene.children, true)
        .slice(0, 4)
        .map((h) => ({
          d: h.distance.toFixed(2),
          p: h.point.toArray().map((v) => v.toFixed(2)),
          color: h.object.material.color?.getHexString(),
          tile: h.object.material.userData?.tile,
          n: h.face?.normal.toArray().map((v) => v.toFixed(2)),
        }))
    },
    start: (levelName = 'easy') => begin(levelName, false),
    tp: (x, floor, z, yaw = S.yaw) => {
      S.pos.set(x, 0, z)
      S.feet = floorY(floor)
      S.yaw = yaw
      if (floor === 1 && z > -0.8) return
      S.inside = true
      building.zones.find((zz) => zz.tag === 'E').on = false
    },
    look: (yaw, pitch = 0) => {
      S.yaw = yaw
      S.pitch = pitch
    },
  }
}
