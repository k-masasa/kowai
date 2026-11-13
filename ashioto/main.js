import * as THREE from 'three'
import './style.css'
import { FH, FLOORS, UNITS, buildBuilding, descentPath, doorX, floorY } from './building.js'
import { createLightPool } from './lights.js'
import { createFigure } from './figure.js'
import { createPerson } from './people.js'
import { createSound } from './sound.js'

// あしおと
// 夜、マンションの前の道から歩いて帰る。階段を上がって、4階の廊下の一番奥の412号室に入れば終わり。
// ふつう以上では、3階から4階へ上がったはずなのに、また3階に出ることがある。最後は4階の廊下で、
// 見ていない間だけ近づく顔の無い人から逃げる。時刻、遊んだ回数、タブを離れていた時間を使う。データは外に出さない。

const EYE = 1.55
const WALK = 1.15
const STRIDE = 0.68
// Shift を押している間の速さと歩幅
const RUN = 2.3
const RUN_STRIDE = 0.86
const STORE = 'kowai.ashioto'
// 階段でこれだけ下りると死ぬ (m)
const BACK_LIMIT = 6
// 4階の廊下でここを過ぎたら、追いかけが始まる (x)
const CHASE_X = 24
// 1階から3階の廊下で、ここを過ぎると奥から明かりが消え、ここを過ぎると襲われる (x)
const WRONG_WARN = 8.2
const WRONG_DEATH = 11.6
// 階段ですれ違う人が、次に出てくるまでの秒数 (最短、ばらつき)
const WALKER_GAP = [26, 22]

// 難しさごとの設定
// days: 何日続けて帰れたら終わりか。途中でつかまったら、1日目からやり直し
// start: 追いかけの最初の距離、walk: 見ていない間の速さ、rush: 停電の間の速さ
// gap: 停電の間隔 (遠い時、近い時)、dark: 停電の長さ (最短、ばらつき)、flash: 懐中電灯の明るさ
// strict: 階段を下り続けると死ぬか、repeat: 3階が続く回数
// events: たまに起こる出来事。torch (懐中電灯が切れる) と peek (窓から覗く) は間隔 (最短、ばらつき) の秒数、
// knob (ドアノブが鳴る) は、ドアの目の前まで来た時に鳴る確率
const NORMAL = {
  days: 3,
  start: 9.5,
  walk: 2.45,
  rush: 4.6,
  gap: [3.6, 1.3],
  dark: [0.2, 0.28],
  flash: 5.5,
  strict: true,
  repeat: 4,
  events: { torch: [15, 15], knob: 0.1, peek: [10, 10] },
}
const LEVELS = {
  easy: {
    days: 1,
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
  normal: NORMAL,
  // むずかしいは、ふつうを詰めてから決める。それまではタイトルで選べない
  hard: { ...NORMAL, days: 5 },
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

/**
 * 1日分の状態の、始めの値。日が変わるたびに、これで上書きする
 */
const dayState = () => ({
  pos: new THREE.Vector3(-8, 0, 2.0),
  feet: 0,
  yaw: -1.33,
  pitch: 0.08,
  tag: 'S',
  prevTag: 'S',
  stride: 0,
  bob: 0,
  walking: false,
  running: false,
  idle: 0,
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
  slamFor: 0,
  torchIn: 0,
  torchWarn: 0,
  torchOff: 0,
  knobIn: 0,
  peekIn: 0,
  peekFor: 0,
  peekSeen: 0,
  peekWin: null,
  wrong: null,
  walker: null,
  walkerIn: 0,
  lampFig: null,
  dropped: false,
  roofTime: 0,
  knocked: false,
  idleWarned: false,
  lift: null,
  liftDone: false,
  cine: 0,
  timeline: [],
  homeFrom: null,
  homeYaw: 0,
})

const S = {
  mode: 'title',
  level: LEVELS.easy,
  memory,
  // 前に遊んだことがあると、1段早く怖くなる
  head: memory.visits > 0 ? 1 : 0,
  // 何日目か。firstNight は1日目の夜
  day: 1,
  firstNight: new Date(),
  locked: false,
  hum: 0,
  awayAt: 0,
  awayPending: false,
  whisperTimer: 0,
  ...dayState(),
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
// 照明の、始めの点き方。日が変わったら、これに戻す
const lightsAtStart = building.fixtures.map((f) => ({ on: f.on, faulty: f.faulty }))
const pool = createLightPool(scene, building.fixtures, 10)
const figure = createFigure()
figure.group.visible = false
scene.add(figure.group)
const person = createPerson()
person.group.visible = false
scene.add(person.group)
const sound = createSound()
const homeDoor = building.doors.find((d) => d.home)
const eye = new THREE.Vector3()

/**
 * 今の怖さの段階。3階が繰り返すたび、日を重ねるたびに上がる
 */
const level = () => S.loops + S.head + (S.day - 1)

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
 * n 日目の夜の日付
 */
const dayDate = (n) => new Date(S.firstNight.getTime() + (n - 1) * 86400000)

/**
 * エンディングの最初の行。何日も続く時は、何日目かも出す
 */
const stamp = () => {
  const time = clockText(new Date())
  return S.level.days > 1 ? [`${S.day}日目`, time] : [time]
}

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
    `${dateText(dayDate(S.day))}の夜、`,
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
const whisper = (text, ms = 2600) => {
  const el = $('whisper')
  el.textContent = text
  el.style.opacity = 1
  clearTimeout(S.whisperTimer)
  S.whisperTimer = setTimeout(() => {
    el.style.opacity = 0
  }, ms)
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
 * 黒くした画面を、だんだん戻す
 */
const fadeIn = (seconds) => {
  const el = $('fade')
  el.style.transition = `opacity ${seconds}s`
  el.style.opacity = 0
}

/**
 * 前の日に動かした物を、全部元に戻す
 */
const resetWorld = () => {
  if (S.peekWin) S.peekWin.mesh.material = S.peekWin.normal
  Object.assign(S, dayState())
  S.repeatLeft = S.level.repeat
  const ev = S.level.events
  if (ev) {
    S.torchIn = nextIn(ev.torch)
    S.peekIn = nextIn(ev.peek)
  }
  building.zones.forEach((z) => {
    z.on = true
  })
  building.fireDoors.forEach((d) => {
    d.group.rotation.y = Math.PI
  })
  building.doors.forEach((d) => {
    d.hinge.rotation.y = 0
    d.lever.rotation.z = 0
    d.rattle = 0
    d.tried = false
  })
  building.room.visible = false
  building.signs.forEach((sign) => sign.draw(sign.label))
  building.fixtures.forEach((f, i) => {
    Object.assign(f, lightsAtStart[i], { stutter: 0 })
  })
  figure.group.visible = false
  person.group.visible = false
  S.walkerIn = 8 + Math.random() * 8
  building.homeGlass.mesh.material = building.homeGlass.normal
  closeLift()
}

/**
 * n 日目を、マンションの前の道から始める。少ししたら、どこに帰るのかを出す
 */
const startDay = (n) => {
  S.day = n
  resetWorld()
  $('ending').classList.add('hidden')
  fadeIn(1.6)
  S.mode = 'play'
  sound.setDrone(0.12)
  updateNotice()
  if (S.level.events && Math.random() < 0.45 + 0.2 * (n - 1)) showLampFigure()
  const goal = n === 1 ? '4階の、412号室に帰る。' : '今日も、412号室に帰る。'
  setTimeout(() => whisper(goal, 4200), 1800)
  if (S.locked && document.pointerLockElement !== renderer.domElement) pause()
}

/**
 * 黒い画面に「2日目」と日付を出して、少ししたらその日を始める
 */
const dayCard = (n) => {
  S.mode = 'card'
  S.cine = 0
  fadeOut(0)
  showEnding([`${n}日目`, dateText(dayDate(n))])
  S.timeline = [[2.8, () => startDay(n)]]
}

/**
 * タイトルから遊び始める。何日も続く時は、1日目の画面を先に出す
 * @param levelName - 'easy' / 'normal' / 'hard'
 * @param lock - マウスを画面にロックするか。ロックすると、マウスを動かすだけで見回せる
 */
const begin = (levelName = 'easy', lock = true) => {
  if (S.mode !== 'title') return
  S.level = LEVELS[levelName] || LEVELS.easy
  S.locked = lock
  S.firstNight = new Date()
  S.memory.visits += 1
  saveMemory()
  $('title').classList.add('hidden')
  sound.start()
  if (lock) lockPointer()
  console.log('%cここも、見てるんですね。', 'color:#a33;font-size:13px')
  if (S.level.days > 1) {
    dayCard(1)
    return
  }
  startDay(1)
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
  if (S.walker) {
    S.walker.path.forEach((p) => {
      p.y -= FH
    })
    person.group.position.y -= FH
  }
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
  if (S.level.days > 1 && S.day === S.level.days) {
    building.homeGlass.mesh.material = building.homeGlass.peek
  }
}

/**
 * 最後の追いかけ。うしろの階段の扉が閉まり、廊下の入口に顔の無い人が立つ
 */
const startChase = () => {
  if (S.lift) endLift()
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
 * 1歩分の足音を鳴らす。走っている時は大きい
 */
const footstep = () => {
  sound.step(S.running ? 0.75 : 0.5)
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
 * 412号室に入った。ドアを開けて中に入る。最後の日なら、暗転のあとにノックを鳴らす。
 * まだ続く時は、次の日を始める
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
  const lines = [...stamp(), '部屋に、帰ってきました。']
  if (S.day < S.level.days) {
    S.timeline = [
      [1.3, () => fadeOut(0.8)],
      [2.2, () => sound.slam(0.8)],
      [3.6, () => showEnding(lines)],
      [6.8, () => $('ending').classList.add('hidden')],
      [7.8, () => dayCard(S.day + 1)],
    ]
    return
  }
  S.timeline = [
    [1.3, () => fadeOut(0.8)],
    [2.2, () => sound.slam(0.8)],
    [3.6, () => showEnding(lines)],
    [5.8, () => sound.knock(3)],
    [7.6, () => showEnding([...lines, '', 'ドアの前で、足音が止まりました。'])],
    [9.0, () => showNext()],
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
  const head = stamp()
  S.timeline = [
    [at, () => fadeOut(0)],
    [at + 1.1, () => showEnding([...head, line])],
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
 * 1階から3階の廊下の奥へ行こうとして、うしろから襲われた。振り向かせて、目の前に顔を出す
 */
const wrongDeath = () => {
  S.yaw += Math.PI
  S.pitch = 0.02
  die('そっちは、あなたの部屋じゃない。', 0.9)
  faceToFace()
}

/**
 * 廊下から出た時に、消した明かりを元に戻す
 */
const endWrongWay = () => {
  building.fixtures.forEach((f, i) => {
    if (f.corridor === S.wrong.floor) f.on = lightsAtStart[i].on
  })
  S.wrong = null
}

/**
 * 1階から3階の廊下に入った時。奥から明かりが消えていき、さらに進むと、うしろから襲われる。
 * かんたんでは、明かりが消えるだけ
 */
const updateWrongWay = (dt) => {
  const m = /^C([123])$/.exec(S.tag)
  if (!m) {
    if (S.wrong) endWrongWay()
    return
  }
  if (!S.wrong && S.pos.x > WRONG_WARN) {
    S.wrong = { floor: Number(m[1]), next: 11, timer: 0 }
    whisper('そっちじゃない。')
    sound.whisper()
  }
  if (!S.wrong) return
  S.wrong.timer -= dt
  if (S.wrong.timer <= 0 && S.wrong.next >= 0) {
    const lamp = building.fixtures.find(
      (f) => f.corridor === S.wrong.floor && f.unit === S.wrong.next,
    )
    if (lamp) lamp.on = false
    sound.click()
    S.wrong.next -= 1
    S.wrong.timer = 0.16
  }
  if (S.level.strict && S.pos.x > WRONG_DEATH) wrongDeath()
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
 * 歩いた距離に合わせて、足音を鳴らす。S.stride は、何歩進んだか
 */
const walkSounds = (dist) => {
  if (dist < 0.0005) {
    if (S.walking) onStop()
    S.walking = false
    return
  }
  S.walking = true
  S.idle = 0
  S.idleWarned = false
  const prev = Math.floor(S.stride)
  S.stride += dist / (S.running ? RUN_STRIDE : STRIDE)
  if (Math.floor(S.stride) !== prev) footstep()
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
  S.running = f >= 0 && pressed('ShiftLeft', 'ShiftRight') === 1
  let speed = S.running ? RUN : WALK
  if (f < 0) speed = WALK * 0.65
  velocity.multiplyScalar(speed)
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
  if (S.idleWarned && S.level.strict && S.idle > 6.5) {
    idleDeath()
    return
  }
  if (S.idle < 22) return
  S.idle = S.level.strict ? 0 : -40
  S.idleWarned = true
  sound.approach()
}

/**
 * 足音が近づいてきたのに、まだ立ち止まっていた。うしろから襲われる
 */
const idleDeath = () => {
  S.yaw += Math.PI
  S.pitch = 0.02
  die('立ち止まっていると、追いつかれます。', 0.9)
  faceToFace()
}

/**
 * ふつう以上で、日の始めに、始めの場所のうしろの街灯の下に人を立たせる。
 * 振り返ると、こちらを向いて立っている。一度見てから目を離すと消える
 */
const showLampFigure = () => {
  figure.group.position.set(-14.0, -0.15, 4.4)
  figure.randomPose(0)
  figure.face(S.pos)
  figure.group.visible = true
  S.lampFig = { seen: 0 }
}

/**
 * 街灯の下の人。見てから目を離すか、近づくか、建物に入ると、明かりのちらつきの間に消える
 */
const updateLampFigure = (dt) => {
  if (!S.lampFig) return
  const seen = inView()
  if (seen) S.lampFig.seen += dt
  figure.face(S.pos)
  const near = flat(figure.group.position, S.pos) < 3.5
  if (!(S.lampFig.seen > 0.6 && !seen) && !near && !S.inside) return
  const lamp = building.fixtures.find((f) => f.outdoor && Math.abs(f.pos.x + 13.97) < 0.1)
  if (lamp) lamp.stutter = 0.4
  if (seen) sound.flicker()
  figure.group.visible = false
  S.lampFig = null
}

/**
 * エレベーターの扉を、開き具合 k (0 から 1) にする。lift が無ければ全部の階を閉める
 */
const setLiftDoors = (lift, k) => {
  lift.doors.forEach((door) => {
    door.position.x = door.userData.home + door.userData.side * 0.5 * k
  })
}

/**
 * どの階のエレベーターも閉めて、かごを隠す
 */
const closeLift = () => {
  building.lifts.forEach((lift) => setLiftDoors(lift, 0))
  building.car.visible = false
  building.carLamp.on = false
}

/**
 * エレベーターの出来事を終える
 */
const endLift = () => {
  closeLift()
  if (!S.final) figure.group.visible = false
  S.lift = null
}

/**
 * 点検中のはずのエレベーターが、いる階に着く。中で顔の無い人がこちらを向いて立っている
 */
const startLift = (floor) => {
  const y = floorY(floor)
  building.car.position.y = y
  building.car.visible = true
  building.carLamp.pos.y = y + 2.0
  building.carLamp.on = true
  figure.group.position.set(5.0, y, -5.65)
  figure.randomPose(0)
  figure.group.rotation.y = 0
  figure.group.visible = true
  S.lift = { lift: building.lifts.find((l) => l.floor === floor), t: 0 }
  sound.ding()
}

/**
 * エレベーターに引きずり込まれた
 */
const liftDeath = () => {
  endLift()
  die('エレベーターは、点検中です。', 0.6)
  faceToFace()
}

/**
 * ふつう以上で、2階から4階のホールに入った時に、たまにエレベーターが着く。
 * 扉が開いている間に近づくと、引きずり込まれる
 */
const updateLift = (dt) => {
  if (!S.level.events || S.final) return
  if (!S.lift) {
    const m = /^H([2-4])$/.exec(S.tag)
    if (!m || S.liftDone || S.ahead) return
    S.liftDone = true
    if (Math.random() < 0.45) startLift(Number(m[1]))
    return
  }
  const L = S.lift
  L.t += dt
  let k = 0
  if (L.t > 1.2 && L.t < 2.2) {
    k = L.t - 1.2
  } else if (L.t >= 2.2 && L.t < 6.0) {
    k = 1
  } else if (L.t >= 6.0) {
    k = Math.max(0, 7.0 - L.t)
  }
  setLiftDoors(L.lift, k)
  figure.face(S.pos)
  const close = Math.hypot(S.pos.x - 5.0, S.pos.z + 4.8) < 1.6
  if (k > 0.6 && close && Math.abs(S.feet - floorY(L.lift.floor)) < 1) {
    liftDeath()
    return
  }
  if (L.t >= 7.0) endLift()
}

/**
 * 外とエントランスまわりの小さな出来事。自販機がひとりでに鳴る、屋上の扉が叩かれる
 */
const updateOddities = (dt) => {
  if (!S.level.events) return
  const vend = building.fixtures.find((f) => f.vending)
  if (!S.dropped && Math.hypot(S.pos.x - vend.pos.x, S.pos.z - 1.5) < 2.4) {
    S.dropped = true
    if (Math.random() < 0.5) {
      sound.drop()
      vend.stutter = 0.35
    }
  }
  if (S.tag !== 'L5') return
  S.roofTime += dt
  if (S.knocked || S.roofTime < 2.5) return
  S.knocked = true
  sound.knock(3)
  setTimeout(() => sound.rattle(KNOB_BEATS), 1500)
  setTimeout(() => whisper('あけて。'), 2600)
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
    if (S.knobIn > 0 || d.hinge.rotation.y !== 0) return
    if (Math.random() > ev.knob) {
      if (Math.random() < 0.06) {
        sound.chime()
        S.knobIn = KNOB_REST
      }
      return
    }
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
 * いる階段の階の番号。踊り場ならその階、階段ならその階から上へ向かう途中。階段でなければ 0
 */
const stairFloor = () => {
  const m = /^[LAMB](\d)$/.exec(S.tag)
  return m ? Number(m[1]) : 0
}

/**
 * from 階から階段を下りて、玄関から外へ出ていく道すじ
 */
const exitPath = (from) => {
  const pts = []
  for (let f = from - 1; f >= 1; f--) pts.push(...descentPath(f))
  pts.push(
    new THREE.Vector3(2.8, 0, -0.8),
    new THREE.Vector3(3.9, 0, -1.3),
    new THREE.Vector3(5.0, 0, -0.5),
    new THREE.Vector3(5.0, 0, 1.9),
    new THREE.Vector3(Math.random() < 0.5 ? -9 : 20, 0, 2.1),
  )
  return pts
}

/**
 * 1階のホールから階段を上がり、f 階の廊下の部屋に入っていく道すじ
 */
const homePath = (f, unit) => {
  const pts = [
    new THREE.Vector3(4.6, 0, -0.9),
    new THREE.Vector3(3.9, 0, -1.3),
    new THREE.Vector3(2.8, 0, -0.8),
  ]
  for (let k = 1; k < f; k++) pts.push(...descentPath(k).reverse())
  const y = floorY(f)
  const x = doorX(unit)
  pts.push(
    new THREE.Vector3(2.8, y, -0.8),
    new THREE.Vector3(4.2, y, -0.9),
    new THREE.Vector3(6.8, y, -0.7),
    new THREE.Vector3(x, y, -0.7),
    new THREE.Vector3(x, y, -1.25),
  )
  return pts
}

/**
 * 階段に、人を1人出す。上から下りて外へ出ていく人と、下から上がって2階の部屋に帰る人がいる。
 * 下りてくる人の一部は、おかしな人
 * @param force - 確かめる時だけ使う。{ strange, up } で出し方を決める
 */
const spawnWalker = (force = {}) => {
  const pf = Math.max(1, stairFloor())
  const up = force.up ?? (pf >= 3 && Math.random() < 0.35)
  const chance = Math.min(0.7, 0.25 + 0.12 * (S.day - 1) + 0.08 * S.loops)
  const strange = !up && (force.strange ?? Math.random() < chance)
  const unit = Math.floor(Math.random() * UNITS)
  const path = up ? homePath(2, unit) : exitPath(Math.min(4, pf + (pf >= 2 ? 1 : 2)))
  S.walker = {
    path,
    seg: 0,
    along: 0,
    strange,
    up,
    unit,
    phase: 0,
    lastStep: 0,
    mode: 'walk',
    stare: 0,
    look: 0,
    greeted: false,
  }
  person.dress(Math.floor(Math.random() * 6), strange)
  person.group.position.copy(path[0])
  person.group.visible = true
}

/**
 * すれ違う人を消す
 */
const hideWalker = () => {
  person.group.visible = false
  S.walker = null
}

/**
 * おかしな人が、明かりのちらつきの間に消える
 */
const vanishWalker = () => {
  const p = person.group.position
  building.fixtures.forEach((f) => {
    if (f.stair && Math.abs(f.pos.y - p.y) < 3) f.stutter = 0.4
  })
  sound.flicker()
  hideWalker()
}

/**
 * 道の終わりまで歩いた。上がってきた人は、部屋のドアを開けて入る
 */
const finishWalker = () => {
  const w = S.walker
  hideWalker()
  if (!w.up) return
  const door = building.doors.find((d) => d.floor === 2 && d.num === 200 + w.unit + 1)
  if (!door) return
  door.hinge.rotation.y = -0.9
  sound.creak()
  setTimeout(() => {
    door.hinge.rotation.y = 0
    sound.slam(0.25)
  }, 1400)
}

const headPoint = new THREE.Vector3()
const toPoint = new THREE.Vector3()
const viewDir = new THREE.Vector3()

/**
 * 目の前の、角度 limit (ラジアン) の内側に point が見えているか
 */
const lookingAt = (point, limit) => {
  camera.getWorldDirection(viewDir)
  toPoint.subVectors(point, eye).normalize()
  return viewDir.dot(toPoint) > Math.cos(limit)
}

/**
 * おかしな人と目が合った。目の前に顔を出す
 */
const strangeDeath = () => {
  hideWalker()
  die('目が、合いましたね。', 0.6)
  faceToFace()
}

/**
 * おかしな人が目の前で止まって、こちらを見ている間。見返すと襲われ、目をそらしていれば消える
 */
const stareWalker = (dt, d) => {
  const w = S.walker
  w.stare += dt
  person.face(S.pos)
  w.look = lookingAt(headPoint, 0.4) ? w.look + dt : Math.max(0, w.look - dt * 0.5)
  if (w.look > 0.45) {
    strangeDeath()
    return
  }
  if ((w.stare > 2.6 && w.look < 0.2) || d > 3.4) vanishWalker()
}

/**
 * 階段ですれ違う人の1フレーム分。ふつう以上で、階段にいる間だけ出てくる
 */
const updateWalker = (dt) => {
  if (!S.level.events || S.final || !S.inside) return
  const w = S.walker
  if (!w) {
    const pf = stairFloor()
    if (!pf || pf >= 4) return
    S.walkerIn -= dt
    if (S.walkerIn > 0) return
    S.walkerIn = nextIn(WALKER_GAP)
    spawnWalker()
    return
  }
  const g = person.group
  headPoint.copy(g.position)
  headPoint.y += 1.62
  const d = headPoint.distanceTo(eye)
  if (w.mode === 'stare') {
    stareWalker(dt, d)
    return
  }
  // 道すじに沿って歩く
  const speed = w.strange ? 0.95 : 1.25
  let left = speed * dt
  while (left > 0 && w.seg < w.path.length - 1) {
    const rest = w.path[w.seg].distanceTo(w.path[w.seg + 1]) - w.along
    if (left < rest) {
      w.along += left
      left = 0
    } else {
      left -= rest
      w.seg += 1
      w.along = 0
    }
  }
  if (w.seg >= w.path.length - 1) {
    finishWalker()
    return
  }
  const a = w.path[w.seg]
  const b = w.path[w.seg + 1]
  g.position.lerpVectors(a, b, w.along / a.distanceTo(b))
  g.rotation.y = Math.atan2(b.x - a.x, b.z - a.z)
  // ふつうの人は、こちらとぶつからないように端へ寄る
  const dx = S.pos.x - g.position.x
  const dz = S.pos.z - g.position.z
  const near = Math.hypot(dx, dz)
  if (!w.strange && near < 0.9 && Math.abs(g.position.y - S.feet) < 1.2) {
    const len = Math.hypot(b.x - a.x, b.z - a.z) || 1
    const px = (b.z - a.z) / len
    const pz = -(b.x - a.x) / len
    const side = dx * px + dz * pz > 0 ? -1 : 1
    g.position.x += px * side * 0.35 * (1 - near / 0.9)
    g.position.z += pz * side * 0.35 * (1 - near / 0.9)
  }
  w.phase += (speed * dt) / 0.7
  person.walk(w.phase)
  const dy = Math.abs(g.position.y - S.feet)
  if (!w.strange && Math.floor(w.phase) !== w.lastStep) {
    w.lastStep = Math.floor(w.phase)
    const vol = THREE.MathUtils.clamp(1.4 / (1 + d), 0.03, 0.45)
    sound.step(vol, { muffle: THREE.MathUtils.clamp((dy - 1) * 0.3, 0, 0.7) })
  }
  if (!w.strange && !w.greeted && d < 2.4 && dy < 1.2 && lookingAt(headPoint, 0.6)) {
    w.greeted = true
    whisper('こんばんは。')
  }
  if (w.strange && d < 1.9 && dy < 1.3) {
    w.mode = 'stare'
    sound.whisper()
  }
}

/**
 * エントランスの自動ドアを開け閉めする。中に入った後は、もう開かない
 */
const updateEntrance = (dt) => {
  const p = person.group.position
  const leaving = S.walker && p.y < 0.5 && Math.hypot(p.x - 5.0, p.z) < 2.2
  const near = (!S.inside && Math.hypot(S.pos.x - 5.0, S.pos.z) < 2.2) || leaving
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
  updateWrongWay(dt)
  if (S.mode !== 'play') return
  updateIdle(dt)
  updateTorch(dt)
  updateKnob(dt)
  updatePeek(dt)
  updateWalker(dt)
  updateLampFigure(dt)
  updateOddities(dt)
  updateLift(dt)
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
 * 日にちの画面を出している間。時間が来たら、その日を始める
 */
const updateCard = (dt) => {
  S.cine += dt
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
  const sway = S.running ? 0.04 : 0.026
  const target = S.walking ? -Math.abs(Math.sin(S.stride * Math.PI)) * sway : 0
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
  if (S.mode === 'card') updateCard(dt)
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
    home: () => goHome(),
    person,
    walker: (force) => spawnWalker(force),
    lamp: () => showLampFigure(),
    lift: (floor) => startLift(floor),
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
