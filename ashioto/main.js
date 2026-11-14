import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import './style.css'
import {
  CX1,
  FH,
  FLOORS,
  HX1,
  SX1,
  UNITS,
  buildBuilding,
  crossPath,
  descentPath,
  doorX,
  flightTop,
  floorY,
  landingSpot,
  stairBlocked,
  stairX,
} from './building.js'
import { createLightPool } from './lights.js'
import { createFigure } from './figure.js'
import { createCrawler, createHand } from './ghosts.js'
import { createCrowd, v3 } from './crowd.js'
import { createPerson } from './people.js'
import { createSound } from './sound.js'
import { buildStation } from './station.js'
import { buildTown } from './town.js'
import { CAR, DOORS, buildRideScenery, buildTrain } from './train.js'

// あしおと
// 夜、会社から電車で帰る。マンションのエレベーターは点検中なので、階段で20階まで上がる。西の階段は途中の階から上が
// 工事中なので、その階の廊下を通って東の階段に移る。20階の廊下の西の端の2012号室に入れば終わり。
// ふつう以上では、上がったはずなのに同じ階に出ることがある。最後は20階の廊下で、見ていない間だけ近づく顔の無い人から
// 逃げる。時刻、遊んだ回数、タブを離れていた時間を使う。データは外に出さない。

const EYE = 1.55
const WALK = 1.15
const STRIDE = 0.68
// Shift を押している間の速さと歩幅
const RUN = 2.3
const RUN_STRIDE = 0.86
const STORE = 'kowai.ashioto'
// 階段でこれだけ下りると死ぬ (m)
const BACK_LIMIT = 6
// 20階の廊下で、東の階段から来てここより西へ進んだら、追いかけが始まる (x)。2012号室まで、あと19m
const CHASE_X = doorX(0) + 19
// 20階より下の廊下で、廊下の端からこれだけ入ると奥から明かりが消え、ここまで入ると襲われる (m)。
// 東の階段へ移る階の廊下では、何も起きない
const WRONG_WARN = 1.2
const WRONG_DEATH = 4.6
// 階段ですれ違う人が、次に出てくるまでの秒数 (最短、ばらつき)
const WALKER_GAP = [26, 22]

// 難しさごとの設定
// days: 何日続けて帰れたら終わりか。途中でつかまったら、1日目からやり直し
// start: 追いかけの最初の距離、walk: 見ていない間の速さ、rush: 停電の間の速さ
// gap: 停電の間隔 (遠い時、近い時)、dark: 停電の長さ (最短、ばらつき)、flash: 懐中電灯の明るさ
// strict: 階段を下り続けると死ぬか、repeat: 1日のうちに、上がったはずが同じ階に出る回数
// events: たまに起こる出来事。torch (懐中電灯が切れる) と peek (階段室の窓から覗く) は、間隔 (最短、ばらつき) の秒数
const NORMAL = {
  days: 1,
  start: 9.5,
  walk: 2.45,
  rush: 4.6,
  gap: [3.6, 1.3],
  dark: [0.2, 0.28],
  flash: 5.5,
  strict: true,
  repeat: 2,
  events: { torch: [15, 15], peek: [10, 10] },
}
// かんたんは、タイトルで選んでも始まらない (無いと言われる)。もう手を入れない
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
  hard: { ...NORMAL, days: 3 },
}

// 屋上の扉のノブを鳴らす時刻 (秒)。1回試して、少し間を空けて何度か
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
  pos: new THREE.Vector3(-65, 0, -10.9),
  feet: 0,
  yaw: Math.PI,
  pitch: 0.02,
  tag: '@HP',
  prevTag: '@HP',
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
  onTop: false,
  loops: 0,
  repeatAt: [],
  // 西の階段をふさいである階。この階で、廊下を通って東の階段に移る。その廊下で、前から這ってくるお化け
  cross: 0,
  crossChase: null,
  looping: false,
  loopFloor: 0,
  aheadFloor: 0,
  ahead: false,
  vanishIn: 0,
  final: false,
  flickerIn: 0,
  darkFor: 0,
  beatIn: 0,
  moved: 0,
  // 最後の追いかけで、這うものが這った歩数
  gait: 0,
  back: 0,
  slamFor: 0,
  torchIn: 0,
  torchWarn: 0,
  torchOff: 0,
  peekIn: 0,
  peekFor: 0,
  peekSeen: 0,
  peekWin: null,
  wrong: null,
  trip: null,
  // 自動で歩かせる時にたどる点 ({ x, z } の並び) と、歩かせている秒数
  auto: null,
  autoFor: 0,
  story: null,
  odd: null,
  hinted: {},
  // 今やることの案内。出したもの (1日に1回ずつ) と、出す順番を待っているもの
  guided: {},
  guides: [],
  lookBack: 0,
  stillFor: 0,
  // 通りで拾った鈴を持っているか。落ちている鈴が、近くでひとりでに鳴ったか
  bell: false,
  bellCalled: false,
  // 上の踊り場で探している人。出したか、首を振る時間、鈴を聞きつけて振り向いている残りの秒数、消えるまでの秒数
  seekerShown: false,
  seekerT: 0,
  heardFor: 0,
  // 走って鈴を鳴らし続けた長さ (秒)。歩くと減る。心臓の音を次に鳴らすまでの秒数
  noise: 0,
  noiseBeat: 0,
  // 通りを歩く人を次に出すまでの秒数と、すれ違った人が振り返って白い顔を見せたか
  pedIn: 1,
  pedGhost: false,
  seekerGone: 0,
  vendTrap: false,
  vendFor: 0,
  walker: null,
  walkerIn: 0,
  // その日に階段に出した人の数
  walkers: 0,
  // 建物の中で歩いた道すじ ({ x, y, z, at } の並び。at は歩き始めからの道のり) と、その長さ。
  // うしろからついてくる人や、追いかけてくる人は、これをたどる
  trail: [],
  trailLen: 0,
  // うしろからついてくる人。もう出したか。階段で追いかけられている間は true (鈴の音を数えない)
  follow: null,
  followDone: false,
  hunted: false,
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
  // 死んだ時に、やり直せる場所。電車に乗ったら 'train' (中央町のホームから)、
  // 月見台で電車を降りたら 'home' (マンションの前から)。まだどちらでもなければ false
  checkpoint: false,
  from: 'office',
  locked: false,
  // マウスのロックを頼んで、まだ返事が来ていない間は true
  locking: false,
  // 一度でもロックできたか。一度もできない所では、ドラッグで見回してもらう
  lockedOnce: false,
  hum: 0,
  awayAt: 0,
  awayPending: false,
  whisperTimer: 0,
  // ささやきの文字を出し終わる時刻 (performance.now)。今やることの案内は、これを待ってから出す
  whisperUntil: 0,
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
// 最寄りの月見台駅。マンションの前の道の西の端にある。線路はここで終わる (終点)。
// 乗ってきたのが終電なので、次の電車は朝まで無い
const homeStation = buildStation(
  scene,
  {
    origin: [-66, 0.6],
    name: '月見台',
    kana: 'つきみだい',
    roman: 'Tsukimidai',
    prev: ['にしはら', '西原'],
    next: null,
    color: '#2e8b57',
    fares: [
      ['中央町', '220'],
      ['港北', '190'],
      ['西原', '160'],
      ['月見台', ''],
    ],
    departures: [['普通', '中央町', '5:02']],
    note: '本日の運転は、終了しました',
    tag: '@H',
  },
  building,
)
// 家に帰る電車。走っている間は、ほかの物から遠い RIDE に置いて、窓の外の景色を流す
const train = buildTrain(scene, building)
const RIDE = new THREE.Vector3(800, 0, -300)
const ride = buildRideScenery(scene, RIDE, building)
train.place(RIDE)
// 会社のある町と、乗る駅 (中央町)。ほかの場所から遠く離して置く
const town = buildTown(scene, [-1000, 0], building)
const workStation = buildStation(
  scene,
  {
    origin: town.stationOrigin,
    name: '中央町',
    kana: 'ちゅうおうちょう',
    roman: 'Chuo-cho',
    prev: ['みなと', '港'],
    next: ['こうほく', '港北'],
    color: '#2e8b57',
    fares: [
      ['港', '140'],
      ['中央町', ''],
      ['港北', '160'],
      ['西原', '190'],
      ['月見台', '220'],
    ],
    departures: [['普通', '月見台', '23:41']],
    note: 'この電車が、最終です',
    tag: '@C',
  },
  building,
)
// 金属の映り込み。部屋の明かりを写した、ぼんやりした景色を使う。映り込みが無いと、金属は黒い板に見える。
// 電車の外側は強さを決めてあるので先に付け、残りの金属 (エレベーターの扉、手すり、柱など) には弱く付ける
const pmrem = new THREE.PMREMGenerator(renderer)
const room = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
pmrem.dispose()
train.lightOutside(room)
scene.traverse((o) => {
  if (!o.isMesh) return
  ;[o.material].flat().forEach((m) => {
    if (!m.isMeshStandardMaterial || m.envMap || m.metalness < 0.5) return
    m.envMap = room
    m.envMapIntensity = 0.25
  })
})
// 走っている時の速さ (m/秒) と、ブレーキをかけてから止まるまでの長さ (m)
const CRUISE = 22
const BRAKE = 90
// 中央町から月見台までの駅。run は、前の駅を出てから止まり始めるまでの秒数。
// 最後の月見台は終点で、本物の駅に着く。それ以外は、走る景色の中のホームに止まる
const LEGS = [
  {
    name: '港北',
    kana: 'こうほく',
    roman: 'Kohoku',
    prev: ['ちゅうおうちょう', '中央町'],
    next: ['にしはら', '西原'],
    run: 8,
  },
  {
    name: '西原',
    kana: 'にしはら',
    roman: 'Nishihara',
    prev: ['こうほく', '港北'],
    next: ['つきみだい', '月見台'],
    run: 8,
  },
  { name: '月見台', roman: 'Tsukimidai', run: 11, last: true },
]
// 照明の、始めの点き方。日が変わったら、これに戻す
const lightsAtStart = building.fixtures.map((f) => ({ on: f.on, faulty: f.faulty }))
const pool = createLightPool(scene, building.fixtures, 10)
const figure = createFigure()
figure.group.visible = false
scene.add(figure.group)
const person = createPerson()
person.group.visible = false
scene.add(person.group)
// 町と電車にいる人たち。乗客、ホームで待つ人、コンビニの店員
const crowd = createCrowd(22)
// 上の踊り場で、鈴の音を探している人。電車やホームに出てくるのと同じ、顔の無い黒いコートの人
const seeker = createFigure()
seeker.group.visible = false
scene.add(seeker.group)
// 人の形をしていないお化け (這うもの)。東の階段へ移る階の廊下で前から這ってきて、そのまま追いかけてくる。
// 20階では、うしろから来る
const crawler = createCrawler()
crawler.group.visible = false
scene.add(crawler.group)
// 東の階段へ移る階の、廊下の腰壁を外からつかんでいる手。近づくと、手を放して下へ消える
// 肌は、壁の色と見分けがつくように、青白く、少し光らせる
const handSkin = new THREE.MeshStandardMaterial({
  color: 0xdfe3dc,
  emissive: 0x30332f,
  roughness: 0.8,
})
const hands = Array.from({ length: 8 }, () => {
  const mesh = createHand(handSkin)
  mesh.visible = false
  scene.add(mesh)
  return { mesh, drop: -1 }
})
const sound = createSound()
const homeDoor = building.doors.find((d) => d.home)
const eye = new THREE.Vector3()

/**
 * 今の怖さの段階。同じ階が続くたび、日を重ねるたびに上がる
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
  if (stage === 2) return ['2012号室の方へ', '', '足音が、', 'ふたり分します。']
  if (stage === 1) {
    return ['2012号室の方へ', '', '夜中の足音が', 'ひびいています。', '静かに歩いて', 'ください。']
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
  S.whisperUntil = performance.now() + ms
  clearTimeout(S.whisperTimer)
  S.whisperTimer = setTimeout(() => {
    el.style.opacity = 0
  }, ms)
}

/**
 * 今やることを、案内する。同じ案内は1日に1回。ほかのささやきを出している間は、出し終わるまで待つ
 * @param key - 案内の名前。1日に1回だけ出すための印
 */
const guide = (key, text, ms = 3800) => {
  if (S.guided[key]) return
  S.guided[key] = true
  S.guides.push([text, ms])
}

/**
 * 場所ごとの、今やることの案内。待っている案内があれば、前のささやきが消えてから出す
 */
const updateGuide = () => {
  const t = S.tag
  if (t === '@OL' || t === '@OD') guide('door', '会社を出たら、通りを左へ。駅は、交番の先。')
  if (/^@C[EG]$/.test(t)) guide('gate', '改札を通って、ホームへ。')
  if (t === '@CP') guide('platform', '月見台行きの電車を待つ。')
  if (S.inside && !S.final) guide('lobby', 'エレベーターは点検中。階段で、20階まで上がる。')
  if (S.guides.length === 0 || performance.now() < S.whisperUntil) return
  const [text, ms] = S.guides.shift()
  whisper(text, ms)
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
  const retry = S.mode === 'caught' && S.checkpoint
  const where = S.checkpoint === 'train' ? '中央町のホームから' : 'マンションの前から'
  $('ending-next').textContent = retry ? `Enter キーで、${where}やり直す` : 'Enter キーでタイトルへ'
  $('ending-next').classList.remove('hidden')
}

/**
 * エンディングからタイトルに戻る。まだ戻れない間は何もしない
 */
const backToTitle = () => {
  if ($('ending-next').classList.contains('hidden')) return
  if (S.mode === 'caught' && S.checkpoint) {
    $('ending-next').classList.add('hidden')
    startDay(S.day, S.checkpoint)
    return
  }
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
  S.locking = true
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
  S.cross = 9 + Math.floor(Math.random() * 4)
  S.repeatAt = pickRepeats(S.level.repeat)
  const ev = S.level.events
  if (ev) {
    S.torchIn = nextIn(ev.torch)
    S.peekIn = nextIn(ev.peek)
  }
  building.zones.forEach((z) => {
    z.on = true
  })
  building.blockStairs(S.cross)
  building.fireDoors.forEach((d) => {
    d.group.rotation.y = d.open
  })
  building.doors.forEach((d) => {
    d.hinge.rotation.y = 0
    d.lever.rotation.z = 0
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
  crowd.releaseAll()
  scene.add(figure.group)
  crawler.group.visible = false
  crawler.reset()
  placeHands()
  placeStart(S.from)
  closeLift()
  seeker.group.visible = false
  if (S.level.events) {
    S.odd = planOddities()
    applyOddities()
    S.vendTrap = S.day >= 2 && Math.random() < 0.4
  }
}

/**
 * 1日の始めの場所に立たせる。from が 'home' なら、やり直しで、マンションの前から。
 * そうでなければ、会社のロビーのエレベーターの前から
 */
const placeStart = (from) => {
  train.setLit(true)
  train.setOpen(0)
  train.place(RIDE)
  train.root.visible = false
  ride.group.visible = false
  train.fixtures.forEach((f) => {
    f.on = false
  })
  // マンションの前や中央町のホームからやり直す時は、鈴はもう持っている
  town.bell.mesh.visible = from === 'office'
  if (from === 'train') {
    const w = workStation.stop
    S.bell = true
    S.pos.set(w.x + 1.0, 0, w.z + 3.4)
    S.yaw = Math.PI / 2
    S.tag = '@CP'
    S.prevTag = '@CP'
    S.story = { stage: 'none', look: 0, carX: 22, unseen: 0 }
    S.trip = {
      phase: 'wait',
      t: 0,
      speed: 0,
      joint: 0,
      bell: 0,
      left: 0,
      sway: 0,
      waited: 4,
      leg: 0,
    }
    placeTownPeople()
    return
  }
  if (from === 'home') {
    S.bell = true
    S.pos.set(-8, 0, 2.0)
    S.yaw = -1.33
    S.tag = 'S'
    S.prevTag = 'S'
    S.trip = null
    S.story = { stage: 'home' }
    return
  }
  S.checkpoint = false
  town.guardShadow.visible = true
  S.story = { stage: 'none', look: 0, carX: 22, unseen: 0 }
  S.pos.copy(town.start)
  S.yaw = Math.PI
  S.tag = '@OB'
  S.prevTag = '@OB'
  S.trip = { phase: 'wait', t: 0, speed: 0, joint: 0, bell: 0, left: 0, sway: 0, waited: 0, leg: 0 }
  placeTownPeople()
  setTimeout(() => sound.ding(), 600)
}

/**
 * 電車を to へ動かす。乗っていれば、一緒に動く
 */
const carryTrain = (to) => {
  const dx = to.x - train.root.position.x
  const dz = to.z - train.root.position.z
  const onboard = S.tag.startsWith('@T')
  train.place(to)
  if (!onboard) return
  S.pos.x += dx
  S.pos.z += dz
}

const trainTo = new THREE.Vector3()

/**
 * 止まった電車から、ホームへ降りる道すじ。いちばん近いドアの前まで通路を歩き、ドアを出て、
 * ホームの点字ブロックの先まで進む。もうドアの前にいれば、そのまま出る
 * @param stop - 電車が止まっている場所 (1両目の真ん中)
 */
const trainExitPath = (stop) => {
  const door = DOORS.map((d) => stop.x + d).sort(
    (a, c) => Math.abs(a - S.pos.x) - Math.abs(c - S.pos.x),
  )[0]
  const aisleZ = THREE.MathUtils.clamp(S.pos.z, stop.z - 0.7, stop.z + 0.7)
  const toDoor =
    Math.abs(S.pos.x - door) < 0.5
      ? []
      : [
          { x: S.pos.x, z: aisleZ },
          { x: door, z: aisleZ },
        ]
  const out = [{ x: door, z: stop.z + 1.45 }].filter((p) => p.z > S.pos.z)
  S.autoFor = 0
  return [...toDoor, ...out, { x: door, z: stop.z + 2.9 }]
}

// 中央町から乗っている乗客。[両 (0 か 1), 両の真ん中からの x, 側, 降りる駅 (LEGS の番号)]。
// 終点の月見台 (2) まで乗っているのは、寝ている1人だけ。終点では、こちらとその人の2人だけが降りる
const SEATED = [
  [0, -5.9, 1, 0],
  [0, -4.2, -1, 0],
  [0, -0.3, -1, 0],
  [0, 4.0, 1, 0],
  [0, 5.6, -1, 0],
  [0, -8.9, -1, 1],
  [0, -3.6, 1, 1],
  [0, 1.0, 1, 1],
  [0, 4.6, -1, 1],
  [0, 6.3, 1, 2],
  [1, -4.8, 1, 0],
  [1, 2.2, -1, 0],
  [1, -1.3, 1, 1],
  [1, 5.1, -1, 1],
]

/**
 * 中央町のホームで、電車を待っている人と、コンビニの店員を置く
 */
const placeTownPeople = () => {
  const w = workStation.stop
  ;[
    [-7.4, 0],
    [2.47, 1],
    [CAR + 0.6 - 2.47, 2],
  ].forEach(([d, k]) => {
    const m = crowd.take('waiter')
    if (!m) return
    crowd.put(m, scene, w.x + d + (k - 1) * 0.3, 0, w.z + 2.7, Math.PI, 'stand', 11 + k * 5)
    m.door = w.x + d
  })
  const clerk = crowd.take('clerk')
  if (clerk) crowd.put(clerk, scene, town.clerk.x, 0, town.clerk.z, -Math.PI / 2, 'stand', 0, false)
}

/**
 * 電車が中央町に来る時に、乗客を座らせる。前の電車に乗らなかった時は、もう乗っているので何もしない
 */
const seatPassengers = () => {
  if (crowd.people.some((m) => m.used && (m.tag === 'rider' || m.tag === 'last'))) return
  SEATED.forEach(([c, x, s, leave], k) => {
    const m = crowd.take('rider')
    if (!m) return
    const cx = c * (CAR + 0.6)
    crowd.put(m, train.root, cx + x, -0.37, s * 1.12, s > 0 ? Math.PI : 0, 'sit', k * 7 + 3)
    m.leaveAt = leave
    m.car = cx
    // 何人かは、うつむいて眠っている。終点まで乗る人も
    const last = leave === LEGS.length - 1
    if (last || k % 4 === 1) m.p.head.rotation.x = 0.55
    if (last) m.tag = 'last'
    // 座っている間は動かないので、部品をまとめて軽くする
    m.p.bake()
  })
}

/**
 * ホームで待っていた人が、ドアが開いたら電車に乗り、ドアの近くに立つ
 */
const boardWaiters = () => {
  const w = workStation.stop
  crowd.people
    .filter((m) => m.used && m.tag === 'waiter')
    .forEach((m, k) => {
      crowd.walk(m, [v3(m.door, 0, w.z + 1.8), v3(m.door + (k % 2 ? 0.4 : -0.4), 0, w.z + 0.75)], {
        speed: 1.3,
        wait: 0.6 + k * 0.3,
        done: () => {
          train.root.attach(m.p.group)
          m.tag = 'rider'
          m.leaveAt = k === 1 ? 0 : 1
          m.car = m.door - w.x > CAR / 2 ? CAR + 0.6 : 0
          m.p.group.rotation.y = k % 2 ? 0 : Math.PI
          m.p.bake()
        },
      })
    })
}

/**
 * 乗客を、いちばん近いドアからホームへ出す道すじ (電車の中の座標)
 */
const riderExit = (m) => {
  const g = m.p.group.position
  const door = DOORS.map((d) => m.car + d).sort((a, c) => Math.abs(a - g.x) - Math.abs(c - g.x))[0]
  const side = g.z > 0 ? 1 : -1
  return {
    door,
    points: [v3(g.x, 0, side * 0.3), v3(door, 0, 0.2), v3(door, 0, 1.45), v3(door, 0, 2.6)],
  }
}

/**
 * 途中の駅で、その駅で降りる乗客を、ドアからホームへ歩かせる。降りたらホームに移して、ホームと一緒に流す
 */
const leavePassengers = (leg) => {
  crowd.people
    .filter((m) => m.used && m.tag === 'rider' && m.leaveAt === leg)
    .forEach((m, k) => {
      const { door, points } = riderExit(m)
      m.tag = 'leave'
      crowd.walk(m, points, {
        speed: 1.25,
        wait: 0.3 + k * 0.55 + Math.random() * 0.3,
        done: () => {
          ride.stop.attach(m.p.group)
          m.tag = 'gone'
          const away = (Math.random() < 0.5 ? -1 : 1) * (4 + Math.random() * 4)
          crowd.walk(m, [v3(door + away * 0.3, 0, 3.4), v3(door + away, 0, 4.4)], { speed: 1.2 })
        },
      })
    })
}

/**
 * 終点の月見台で、寝ていた1人が起きて降りる。ホームから改札を抜けて駅を出ると、
 * マンションとは反対の西へ歩いていく (その先は updateLastPassenger)
 */
const leaveAtTerminal = (stop) => {
  crowd.people
    .filter((m) => m.used && (m.tag === 'rider' || m.tag === 'last'))
    .forEach((m, k) => {
      const { points } = riderExit(m)
      m.p.head.rotation.x = 0
      m.tag = 'leave'
      crowd.walk(m, points, {
        speed: 1.3,
        wait: 0.5 + k * 0.6,
        done: () => {
          scene.attach(m.p.group)
          m.tag = 'away'
          // 改札の4つ目の通路を抜けて、駅の入口から歩道へ出て、西へ
          const gx = stop.x + 0.6
          const ez = stop.z + 15.5
          crowd.walk(
            m,
            [
              v3(gx, 0, stop.z + 4.6),
              v3(gx, 0, stop.z + 8.6),
              v3(gx, 0, stop.z + 12),
              v3(stop.x, 0, ez + 0.6),
              v3(stop.x - 4, 0, ez + 1.4),
              v3(stop.x - 40, 0, ez + 1.6),
            ],
            { speed: 1.2, done: () => crowd.release(m) },
          )
        },
      })
    })
}

const lastHead = new THREE.Vector3()

/**
 * 駅を出て西へ歩いていく、終点で一緒に降りた人。駅から離れたところで、見ていると消える。
 * 消える時に、ポケットの鈴がひとりでに鳴る。見ていなければ、暗がりの先で消える
 */
const updateLastPassenger = () => {
  const m = crowd.people.find((x) => x.used && x.tag === 'away')
  if (!m) return
  const p = m.p.group.position
  const past = homeStation.stop.x - p.x
  if (past < 12) return
  lastHead.copy(p)
  lastHead.y += 1.5
  updateFrustum()
  sphere.center.copy(lastHead)
  const seen = frustum.intersectsSphere(sphere) && lastHead.distanceTo(eye) < 30
  if (!seen && past < 20) return
  crowd.release(m)
  if (seen) sound.suzu(0.07)
}

/**
 * 電車の中の乗客の顔を消す / 戻す。消している間は、みんな首だけこちらへ向ける
 */
const blankRiders = (on) => {
  const base = train.root.position
  crowd.people
    .filter((m) => m.used && (m.tag === 'rider' || m.tag === 'last'))
    .forEach((m) => {
      m.p.blank(on)
      if (!on) {
        m.p.head.rotation.y = 0
        m.p.head.rotation.z = 0
        return
      }
      m.p.head.rotation.z = (m.k % 2 ? 1 : -1) * 0.25
      const g = m.p.group
      const yaw = Math.atan2(S.pos.x - base.x - g.position.x, S.pos.z - base.z - g.position.z)
      const turn = Math.atan2(Math.sin(yaw - g.rotation.y), Math.cos(yaw - g.rotation.y))
      m.p.head.rotation.y = THREE.MathUtils.clamp(turn, -1.5, 1.5)
    })
}

const ghostHead = new THREE.Vector3()

/**
 * 港北のホームの、ドアの前に面無し様を立たせる。ホームと一緒に寄ってきて、こちらを向いている
 */
const placePlatformGhost = () => {
  const local = S.pos.x - train.root.position.x
  const door = DOORS.reduce((best, d) => (Math.abs(d - local) < Math.abs(best - local) ? d : best))
  ride.stop.add(figure.group)
  figure.group.position.set(door, 0, 2.35)
  figure.group.rotation.y = Math.PI
  figure.randomPose(0)
  figure.group.visible = true
}

/**
 * ホームの面無し様を消す。ドアが閉まる時に、明かりのちらつきの間に
 */
const hidePlatformGhost = () => {
  if (figure.group.parent !== ride.stop) return
  scene.add(figure.group)
  figure.group.visible = false
  sound.flicker()
}

/**
 * 港北で止まっている間。面無し様と目が合い続けると死ぬ (ふつう以上)
 */
const watchPlatformGhost = (T, dt) => {
  if (figure.group.parent !== ride.stop) return
  if (T.t > 3.4 && !T.warned) {
    T.warned = true
    whisper('目を、合わせないで。')
    sound.whisper()
  }
  figure.group.getWorldPosition(ghostHead)
  ghostHead.y += 1.62
  updateFrustum()
  sphere.center.copy(ghostHead)
  const looking = T.warned && frustum.intersectsSphere(sphere) && lookingAt(ghostHead, 0.2)
  T.stare = looking ? (T.stare || 0) + dt : 0
  if (!S.level.events || T.stare < 1.6) return
  scene.add(figure.group)
  oddDeath('目が、合いました。')
}

/**
 * 次の駅の案内。ドアの上の表示と、車内の放送
 */
const announceNext = (k) => {
  const leg = LEGS[k]
  train.display.draw(leg.name, leg.roman)
  sound.chime(0.1)
  whisper(leg.last ? `次は、終点、${leg.name}です。` : `次は、${leg.name}です。`, 3200)
}

/**
 * 電車の1フレーム分。中央町のホームで待つ -> 電車が来る -> 乗るとドアが閉まって発車 -> 走る ->
 * 港北、西原に止まり、乗客が降りていく -> 終点の月見台に止まってドアが開き、残っていた1人と一緒に降りる ->
 * 終点なので先へは行かず、ドアを閉めて車内の明かりを消す
 */
const updateTrip = (dt) => {
  const T = S.trip
  if (!T) return
  T.t += dt
  const stop = homeStation.stop
  const work = workStation.stop
  if (T.phase === 'wait') {
    if (S.tag === '@CP') T.waited += dt
    if (T.waited > 9) {
      T.phase = 'approach'
      T.t = 0
      T.speed = CRUISE
      train.root.visible = true
      train.fixtures.forEach((f) => {
        f.on = true
      })
      train.display.draw('中央町', 'Chuo-cho', '')
      seatPassengers()
      carryTrain(trainTo.set(work.x - BRAKE - 110, 0, work.z))
      sound.chime(0.1)
      whisper('まもなく、1番線に、月見台方面の電車が参ります。', 3600)
    }
  } else if (T.phase === 'approach') {
    carryTrain(trainTo.set(work.x - BRAKE - 110 + CRUISE * T.t, 0, work.z))
    if (CRUISE * T.t >= 110) {
      T.phase = 'brake'
      T.t = 0
    }
  } else if (T.phase === 'brake') {
    const k = Math.min(T.t / ((2 * BRAKE) / CRUISE), 1)
    T.speed = CRUISE * (1 - k)
    carryTrain(trainTo.set(work.x - BRAKE + BRAKE * (1 - (1 - k) ** 2), 0, work.z))
    if (k >= 1) {
      T.phase = 'board'
      T.t = 0
      T.left = 0
      sound.doorHiss()
      boardWaiters()
      if (S.tag === '@CP') guide('board', '電車が来た。乗る。', 3000)
    }
  } else if (T.phase === 'board') {
    train.setOpen(Math.min(T.t / 1.2, 1))
    if (S.tag.startsWith('@T')) {
      T.left += dt
      if (!S.checkpoint) S.checkpoint = 'train'
    }
    if (T.left > 2.5) {
      T.phase = 'shut'
      T.t = 0
      sound.doorHiss()
      whisper('ドアが閉まります。', 2000)
      crowd.people.filter((m) => m.used && m.tag === 'waiter').forEach(crowd.finish)
    }
  } else if (T.phase === 'shut') {
    train.setOpen(Math.max(0, 1 - T.t / 1.2))
    if (T.t > 1.6) {
      T.phase = 'depart'
      T.t = 0
      train.display.draw(LEGS[0].name, LEGS[0].roman)
    }
  } else if (T.phase === 'depart') {
    if (T.t > 0.5 && S.tag.startsWith('@T')) guide('ride', '終点の月見台まで、乗っていく。')
    T.speed = Math.min(CRUISE, 2.6 * T.t)
    carryTrain(trainTo.set(work.x + 1.3 * T.t * T.t, 0, work.z))
    if (T.speed >= CRUISE) {
      // 乗らずにホームに残った時は、電車だけ行ってしまい、次の電車を待つ
      if (!S.tag.startsWith('@T')) {
        Object.assign(T, { phase: 'wait', t: 0, waited: 0, speed: 0 })
        train.root.visible = false
        return
      }
      T.phase = 'cruise'
      T.t = 0
      T.leg = 0
      carryTrain(trainTo.copy(RIDE))
      ride.group.visible = true
      announceNext(0)
    }
  } else if (T.phase === 'cruise') {
    ride.update(dt, T.speed)
    // 走り出して、車内の明かりが光を受け持ってから、窓に映る車内を撮る。駅を出るたびに撮り直す
    if (T.t > 0.4 && T.shot !== T.leg) {
      T.shot = T.leg
      const shown = figure.group.visible
      figure.group.visible = false
      train.capture(renderer)
      figure.group.visible = shown
    }
    if (T.leg === 1 && T.t > 3 && !T.crossed) {
      T.crossed = true
      ride.cross(160)
    }
    if (ride.crossingNear()) {
      T.bell -= dt
      if (T.bell <= 0) {
        T.bell = 0.84
        sound.bell(0.07)
      }
    }
    // 港北と西原のあいだで、車内の明かりが一瞬消える。点き直すと、乗客みんなの顔が無く、こちらを向いている。
    // もう一度消えて点くと、元に戻っている
    if (T.leg === 1 && T.t > 6 && !T.flicked) {
      T.flicked = true
      T.flick = 0
      train.setLit(false)
      sound.flicker()
    }
    if (T.flick !== undefined && T.flick >= 0) {
      const before = T.flick
      T.flick += dt
      const at = (x) => before < x && T.flick >= x
      if (at(0.35)) {
        train.setLit(true)
        blankRiders(true)
        sound.whisper()
        sound.heartbeat(0.5)
      }
      if (at(1.75)) {
        train.setLit(false)
        sound.flicker()
      }
      if (at(2.05)) {
        train.setLit(true)
        blankRiders(false)
        T.flick = -1
      }
    }
    const leg = LEGS[T.leg]
    if (T.t > leg.run && leg.last) {
      T.phase = 'arrive'
      T.t = 0
      carryTrain(trainTo.set(stop.x - BRAKE, 0, stop.z))
      ride.group.visible = false
      train.display.draw('月見台', 'Tsukimidai', 'まもなく')
      sound.chime(0.1)
      whisper('まもなく、終点、月見台です。', 3200)
    } else if (T.t > leg.run) {
      T.phase = 'slow'
      T.t = 0
      ride.approach(leg)
      train.display.draw(leg.name, leg.roman, 'まもなく')
      sound.chime(0.1)
      whisper(`まもなく、${leg.name}です。`, 3200)
      // 港北では、ホームに面無し様が立っている。ポケットの鈴が、ひとりでに鳴る
      if (T.leg === 0) {
        placePlatformGhost()
        sound.suzu(0.07)
      }
    }
  } else if (T.phase === 'slow') {
    const k = Math.min(T.t / ((2 * BRAKE) / CRUISE), 1)
    T.speed = CRUISE * (1 - k)
    ride.update(dt, T.speed)
    ride.alignStop(BRAKE * (1 - k) ** 2)
    if (k >= 1) {
      T.phase = 'halt'
      T.t = 0
      T.speed = 0
      T.said = false
      T.warned = false
      T.stare = 0
      sound.doorHiss()
      train.display.draw(LEGS[T.leg].name, LEGS[T.leg].roman, '')
    }
  } else if (T.phase === 'halt') {
    // 途中の駅。ドアは開くが、ホームへは渡れない
    const leg = LEGS[T.leg]
    train.setOpen(Math.min(T.t / 1.2, 1), false)
    if (T.t > 1.2 && !T.said) {
      T.said = true
      whisper(`${leg.name}、${leg.name}です。`, 3000)
      leavePassengers(T.leg)
    }
    watchPlatformGhost(T, dt)
    if (S.mode !== 'play') return
    if ((T.t > 7 && crowd.walking('leave') === 0) || T.t > 16) {
      T.phase = 'reshut'
      T.t = 0
      sound.doorHiss()
      whisper('ドアが閉まります。', 2000)
      hidePlatformGhost()
    }
  } else if (T.phase === 'reshut') {
    train.setOpen(Math.max(0, 1 - T.t / 1.2), false)
    if (T.t > 1.6) {
      T.phase = 'pull'
      T.t = 0
      ride.leaveStop()
      const next = LEGS[T.leg + 1]
      train.display.draw(next.name, next.roman)
    }
  } else if (T.phase === 'pull') {
    T.speed = Math.min(CRUISE, 2.6 * T.t)
    ride.update(dt, T.speed)
    if (T.speed >= CRUISE) {
      T.phase = 'cruise'
      T.t = 0
      T.leg += 1
      announceNext(T.leg)
    }
  } else if (T.phase === 'arrive') {
    const k = Math.min(T.t / ((2 * BRAKE) / CRUISE), 1)
    T.speed = CRUISE * (1 - k)
    carryTrain(trainTo.set(stop.x - BRAKE + BRAKE * (1 - (1 - k) ** 2), 0, stop.z))
    if (k >= 1) {
      T.phase = 'open'
      T.t = 0
      // 途中の駅で使った印を戻す。戻さないと、放送も自動で降ろすのも動かない
      T.said = false
      T.left = 0
      sound.doorHiss()
      train.display.draw('月見台', 'Tsukimidai', '')
    }
  } else if (T.phase === 'open') {
    train.setOpen(Math.min(T.t / 1.2, 1))
    if (T.t > 1.2 && !T.said) {
      T.said = true
      whisper('月見台、月見台です。この電車は、ここまでです。', 3600)
      // 降りていいのか迷わないように、ここだけは自動で降ろす
      if (S.tag.startsWith('@T')) S.auto = trainExitPath(stop)
      leaveAtTerminal(stop)
    }
    if (S.tag.startsWith('@H')) {
      T.left += dt
      S.checkpoint = 'home'
    }
    if (T.left > 3 && crowd.walking('leave') === 0) {
      T.phase = 'close'
      T.t = 0
      sound.doorHiss()
      guide('exit', '改札を出たら、左へ。マンションは、道の先。')
    }
  } else if (T.phase === 'close') {
    // 終点なので、この先へは行かない。ドアを閉めて、少ししたら車内の明かりを消す
    train.setOpen(Math.max(0, 1 - T.t / 1.2))
    if (T.t > 3.2) {
      T.phase = 'parked'
      T.t = 0
      train.setLit(false)
      sound.click()
    }
  } else if (T.phase === 'parked') {
    // 駅を出たら、もう見えないので隠す
    if (!S.tag.startsWith('@H')) {
      T.phase = 'gone'
      crowd.people
        .filter((m) => m.used && (m.tag === 'rider' || m.tag === 'last'))
        .forEach(crowd.release)
      train.root.visible = false
      train.fixtures.forEach((f) => {
        f.on = false
      })
    }
  }
  if (!ride.stop.visible) {
    crowd.people
      .filter((m) => m.used && m.tag === 'gone' && m.p.group.parent === ride.stop)
      .forEach(crowd.release)
  }
  // 走る音と、レールのつなぎ目の音。乗っている間は、少し揺れる
  const moving = ['cruise', 'slow', 'pull', 'arrive'].includes(T.phase)
  const onboard = S.tag.startsWith('@T')
  sound.setTrain(moving ? (onboard ? 1 : 0.6) * Math.min(1, T.speed / CRUISE + 0.15) : 0)
  T.sway = moving && onboard ? Math.min(1, T.speed / CRUISE) : 0
  if (moving && T.speed > 2) {
    T.joint -= dt * T.speed
    if (T.joint <= 0) {
      T.joint = 25
      sound.joint(onboard ? 0.22 : 0.1)
    }
  }
}

/**
 * 階段の異変を、ばらばらの階に割り当てる。赤い表示の階 (振り返ると死ぬ)、明かりの消えた区間 (止まると死ぬ)、
 * 上の踊り場で探す人 (走ると死ぬ) から、1日目は2つ、2日目からは3つ。ほかに、うしろからついてくる人 (止まると
 * 近づいてくる) と、表示の消えた階が1つずつ
 */
const planOddities = () => {
  const taken = new Set([
    ...S.repeatAt.flatMap((f) => [f, f + 1]),
    S.cross - 1,
    S.cross,
    S.cross + 1,
  ])
  // 空いている階から選ぶ。extra は、その階から上に、あと何階分を使うか。空きが無ければ、重なってもよい
  const pick = (extra = 0) => {
    const free = []
    for (let f = 3; f <= FLOORS - 3; f++) {
      if (!taken.has(f) && !taken.has(f + extra)) free.push(f)
    }
    const f =
      free.length > 0
        ? free[Math.floor(Math.random() * free.length)]
        : 3 + Math.floor(Math.random() * (FLOORS - 5))
    for (let n = f - 1; n <= f + 1 + extra; n++) taken.add(n)
    return f
  }
  const kinds = ['red', 'dark', 'search'].sort(() => Math.random() - 0.5)
  // うしろからついてくる人は、毎日出す。2階分ついてくる
  const plan = { follow: pick(1) }
  kinds.slice(0, S.day >= 2 ? 3 : 2).forEach((kind) => {
    plan[kind] = pick()
  })
  plan.blank = pick()
  return plan
}

/**
 * 異変の見た目を付ける。赤い表示、消えた表示、消えた明かり
 */
const applyOddities = () => {
  const o = S.odd
  if (o.red) drawSigns(o.red, `${o.red}F`, true)
  drawSigns(o.blank, '')
  if (!o.dark) return
  // 明かりを消すのは、その階から上がる時に使う方の階段だけ
  const east = eastFrom(o.dark)
  building.fixtures.forEach((f) => {
    if (!!f.east !== east) return
    if (f.stair === o.dark + 0.5 || f.stair === o.dark + 1) f.on = false
  })
}

/**
 * 異変のきまりを破った。目の前に顔を出す
 */
const oddDeath = (line) => {
  S.pitch = 0.02
  die(line, 0.7)
  faceToFace()
}

/**
 * 上の踊り場で、顔の無い人が首を振って、鈴の音を探している。歩けば鈴は鳴らず、近くに来るとたまに振り向くだけ。
 * 走って鈴を大きく鳴らすと、下りてくる。近くまで上がると、明かりのちらつきの間に消える
 */
const updateSeeker = (f, dt) => {
  const sf = S.odd.search
  if (!sf) return
  const g = seeker.group
  const here = f || Math.floor((S.feet + 0.5) / FH) + 1
  if (!S.seekerShown && here >= sf - 1 && here <= sf) {
    S.seekerShown = true
    g.position.copy(flightTop(sf, eastFrom(sf)))
    g.rotation.y = -Math.PI / 2
    seeker.randomPose(0)
    g.visible = true
  }
  if (!g.visible) return
  if (S.seekerGone > 0) {
    S.seekerGone -= dt
    if (S.seekerGone <= 0) g.visible = false
    return
  }
  const d = flat(S.pos, g.position)
  const dy = Math.abs(S.feet - g.position.y)
  // ふだんは首を振って探す。鈴を聞きつけた後は、しばらくこちらを向く
  S.seekerT += dt
  S.heardFor = Math.max(0, S.heardFor - dt)
  if (S.heardFor <= 0 && d < 6 && dy < 2.4 && Math.random() < dt * 0.3) S.heardFor = 1.4
  const heard = S.heardFor > 0
  const look = heard
    ? Math.atan2(S.pos.x - g.position.x, S.pos.z - g.position.z)
    : -Math.PI / 2 + Math.sin(S.seekerT * 0.6) * 1.2
  g.rotation.y = lerpAngle(g.rotation.y, look, 1 - Math.exp(-(heard ? 4 : 1.5) * dt))
  if (!S.hinted.search && dy < 2.2 && d < 6) {
    S.hinted.search = true
    whisper('しずかに。走らないで。')
    sound.whisper()
  }
  // 階段で追いかけられて走っている間は、鈴の音を数えない (逃げるには走るしかないので)
  if (S.running && S.walking && !S.hunted && dy < 2.4 && d < 7) {
    g.visible = false
    oddDeath('鈴の音を、聞かれました。')
    return
  }
  if (d < 2.3 && dy < 1.0) {
    const lamp = building.fixtures.find((l) => l.stair === sf + 0.5 && !!l.east === eastFrom(sf))
    if (lamp) lamp.stutter = 0.5
    sound.flicker()
    S.seekerGone = 0.12
  }
  if (S.feet > floorY(sf + 1) + 0.5) g.visible = false
}

/**
 * 階段の異変の1フレーム分。赤い表示の階では振り返ると、明かりの消えた区間では止まると死ぬ
 */
const updateStairOddities = (dt) => {
  const o = S.odd
  if (!o || S.final) return
  const m = /^([LAMB])(\d+)$/.exec(S.tag)
  const kind = m ? m[1] : ''
  const f = m ? Number(m[2]) : 0
  if (o.red && f === o.red) {
    if (!S.hinted.red && kind === 'L') {
      S.hinted.red = true
      whisper('振り返らないで。')
      sound.whisper()
    }
    const fz = -Math.cos(S.yaw)
    const back = (kind === 'A' && fz > 0.5) || (kind === 'B' && fz < -0.5)
    S.lookBack = back ? S.lookBack + dt : 0
    if (S.lookBack > 0.5) {
      oddDeath('振り返りましたね。')
      return
    }
  }
  const dark =
    o.dark &&
    ((f === o.dark && (kind === 'M' || kind === 'B')) || (f === o.dark + 1 && kind === 'L'))
  if (dark) {
    if (!S.hinted.dark) {
      S.hinted.dark = true
      whisper('止まらないで。')
      sound.whisper()
    }
    S.stillFor = S.walking ? 0 : S.stillFor + dt
    if (S.stillFor > 1.4) {
      oddDeath('暗いところで、立ち止まりましたね。')
      return
    }
  } else {
    S.stillFor = 0
  }
  updateSeeker(f, dt)
}

const followAt = new THREE.Vector3()
const followHead = new THREE.Vector3()

/**
 * うしろからついてくる人を出す。歩いてきた道すじの、ちょうど1つ下の階段くらいうしろに立たせる。
 * 黒い服で、顔は白く、手足を動かさずにすべるように歩く
 */
const startFollower = () => {
  const m = crowd.take('follow')
  if (!m) return
  const along = Math.max(0, S.trailLen - 5.5)
  trailAt(along, followAt)
  crowd.put(m, scene, followAt.x, followAt.y, followAt.z, 0, 'stand', 3, false)
  m.p.dress(3, true)
  m.p.blank(true)
  S.follow = {
    m,
    along,
    gap: S.trailLen - along,
    still: 0,
    step: 0,
    t: 0,
    until: stairFloor() + 2,
    stopped: false,
    gone: 0,
  }
}

/**
 * うしろからついてくる人を消す
 */
const endFollower = () => {
  crowd.release(S.follow.m)
  S.follow = null
  S.followDone = true
}

/**
 * うしろからついてきた人に、追いつかれた。振り向かせて、目の前に顔を出す
 */
const followDeath = () => {
  const g = S.follow.m.p.group.position
  S.yaw = Math.atan2(-(g.x - S.pos.x), -(g.z - S.pos.z))
  S.pitch = 0.02
  endFollower()
  die('ずっと、うしろにいました。', 0.7)
  faceToFace()
}

/**
 * うしろからついてくる人の1フレーム分 (ふつう以上)。決めた階から上がり始めると、うしろに現れる。
 * 歩いている間は、同じ道のりだけうしろを歩いてくる (走れば、走ってくる)。立ち止まると、そのまま近づいてくる。
 * 引き返して近づいても、追いつかれる。2階分上がるか、廊下へ出ると立ち止まり、見ていない間にいなくなる
 */
const updateFollower = (dt) => {
  const F = S.odd && S.odd.follow
  if (!F || S.final) return
  const fo = S.follow
  if (!fo) {
    // 決めた階から上がり始めたら出す。追いかけられていて出せなかった時は、2階上までのうちに出す
    const m = /^A(\d+)$/.exec(S.tag)
    const n = m ? Number(m[1]) : 0
    if (S.followDone || n < F || n > F + 2 || S.trailLen < 7 || S.hunted) return
    if (S.walker) hideWalker()
    startFollower()
    return
  }
  const g = fo.m.p.group
  fo.t += dt
  if (fo.t > 1.6 && !S.hinted.follow) {
    S.hinted.follow = true
    whisper('うしろから、だれか来る。止まらないで。', 3200)
    sound.whisper()
  }
  if (!fo.stopped && (stairFloor() >= fo.until || /^[HCD]\d/.test(S.tag))) fo.stopped = true
  followHead.copy(g.position)
  followHead.y += 1.6
  updateFrustum()
  sphere.center.copy(followHead)
  const seen = frustum.intersectsSphere(sphere) && !stairBlocked(eye, followHead)
  if (fo.stopped) {
    fo.gone += dt
    g.rotation.y = Math.atan2(S.pos.x - g.position.x, S.pos.z - g.position.z)
    if (!seen || fo.gone > 10) endFollower()
    return
  }
  fo.still = S.walking ? 0 : fo.still + dt
  let step = Math.max(0, Math.min(S.trailLen - fo.gap - fo.along, 2.5 * dt))
  if (fo.still > 1.0) {
    step = 0.75 * dt
    if (!S.hinted.followStill) {
      S.hinted.followStill = true
      whisper('止まると、近づいてくる。')
      sound.whisper()
    }
  }
  step = Math.min(step, S.trailLen - fo.along)
  fo.along += step
  if (fo.still > 1.0) fo.gap = S.trailLen - fo.along
  trailAt(fo.along, g.position)
  // 進む向きを向く。止まっている時は、こちらを向く
  if (step > 0.0001) {
    trailAt(fo.along + 0.4, followAt)
    g.rotation.y = Math.atan2(followAt.x - g.position.x, followAt.z - g.position.z)
  } else {
    g.rotation.y = Math.atan2(S.pos.x - g.position.x, S.pos.z - g.position.z)
  }
  fo.step += step
  if (fo.step > 0.68) {
    fo.step = 0
    const d = followHead.distanceTo(eye)
    const dy = Math.abs(g.position.y - S.feet)
    sound.step(THREE.MathUtils.clamp(1.6 / (1 + d), 0.05, 0.5), {
      muffle: THREE.MathUtils.clamp((dy - 1) * 0.3, 0, 0.6),
    })
  }
  const close = Math.hypot(g.position.x - S.pos.x, g.position.y - S.feet, g.position.z - S.pos.z)
  if (S.trailLen - fo.along < 1.0 || close < 0.8) followDeath()
}

/**
 * n 日目を、マンションの前の道から始める。少ししたら、どこに帰るのかを出す
 */
const startDay = (n, from = 'office') => {
  S.day = n
  S.from = from
  resetWorld()
  $('ending').classList.add('hidden')
  fadeIn(1.6)
  S.mode = 'play'
  sound.setDrone(0.12)
  updateNotice()
  if (S.level.events && Math.random() < 0.45 + 0.2 * (n - 1)) showLampFigure()
  // 始めの案内は、画面が明るくなってから
  S.whisperUntil = performance.now() + 1800
  if (from === 'train') {
    guide('platform', '月見台行きの電車を待つ。')
  } else if (from === 'home') {
    guide('home', 'マンションに帰る。エントランスは、すぐ先。')
  } else {
    guide('start', n === 1 ? '終電に乗って、家に帰る。' : '今日も、終電で家に帰る。')
  }
  // ロックを頼んでいる途中は止めない。止めると、ロックが効いた後のクリックは画面の方に行き、
  // 「クリックで戻る」に届かなくなる
  if (S.locked && !S.locking && document.pointerLockElement !== renderer.domElement) pause()
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
const begin = (levelName = 'normal', lock = true) => {
  if (S.mode !== 'title') return
  S.level = LEVELS[levelName] || LEVELS.normal
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
 * 画面から離れていた分、何かが進んでいる。最後の追いかけの途中なら、うしろの這うものが近づいている
 */
const applyAway = () => {
  S.awayPending = false
  if (level() < 1) return
  whisper('どこに行ってたの？')
  sound.whisper()
  if (!S.final) return
  // 最後の追いかけの途中なら、うしろの這うものが近づいている
  const fig = crawler.group.position
  const d = flat(fig, S.pos)
  const pull = Math.min(4, Math.max(d - 3.4, 0))
  fig.x += ((S.pos.x - fig.x) / d) * pull
  fig.z += ((S.pos.z - fig.z) / d) * pull
}

/**
 * 建物の中の明かりを全部消す / 付ける
 */
const setDark = (dark) => {
  S.dark = dark
}

/**
 * 同じ階が何日続く日を、ばらばらに決める。f 階から上がる時に、また f 階に出る
 * @param n - その日に、同じ階が続く回数
 */
const pickRepeats = (n) => {
  const floors = []
  while (floors.length < n) {
    const f = 4 + Math.floor(Math.random() * (FLOORS - 7))
    // 東の階段へ移る階と、その下の階は使わない
    if (!floors.includes(f) && f !== S.cross && f !== S.cross - 1) floors.push(f)
  }
  return floors
}

/**
 * f 階から上へ上がる時に使う階段が、東の階段か。西の階段は、S.cross 階から上がふさがっている
 */
const eastFrom = (f) => f >= S.cross

/**
 * f 階の階の表示 (両方の階段室の分) を、書き換える
 */
const drawSigns = (f, text, red = false) => {
  building.signs.filter((s) => s.floor === f).forEach((s) => s.draw(text, red))
}

/**
 * f 階の上の、中間の踊り場に、背中を向けて立たせる
 */
const showAhead = (f) => {
  S.ahead = true
  S.aheadFloor = f
  figure.group.position.copy(landingSpot(f, eastFrom(f)))
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
  const east = eastFrom(S.aheadFloor)
  const lamp = building.fixtures.find((f) => f.stair === S.aheadFloor + 0.5 && !!f.east === east)
  if (lamp) lamp.stutter = 0.5
  sound.flicker()
  S.vanishIn = 0.12
}

/**
 * f 階から上がったはずが、また f 階に出た。1回目は先の踊り場に人が立ち、2回目からは下の階段の明かりが消える
 */
const onRepeat = (f) => {
  S.loops += 1
  sound.whisper()
  updateNotice()
  if (S.loops === 1) showAhead(f)
  if (S.loops < 2) return
  S.clockFrozen = true
  building.fixtures.forEach((lamp) => {
    if (lamp.stair && lamp.stair < f) lamp.on = false
    if (lamp.stair === f || lamp.stair === f + 0.5) lamp.faulty = true
  })
}

/**
 * 階段の場所が変わった時の出来事。中間の踊り場で、上の階に着いたらそっくりな同じ階へ移すかを決める
 */
const onStairs = () => {
  const mid = /^M(\d+)$/.exec(S.tag)
  const from = /^A(\d+)$/.exec(S.prevTag)
  if (mid && from && mid[1] === from[1] && !S.looping) {
    const f = Number(mid[1])
    const k = S.repeatAt.indexOf(f)
    if (k >= 0) {
      S.repeatAt.splice(k, 1)
      S.looping = true
      S.loopFloor = f
      drawSigns(f + 1, `${f}F`)
    }
  }
  if (!S.looping || S.tag !== `L${S.loopFloor + 1}`) return
  // 上の階に着いた瞬間に、そっくりな下の階へ移す
  const f = S.loopFloor
  S.feet -= FH
  S.trail.forEach((p) => {
    p.y -= FH
  })
  if (S.follow) S.follow.m.p.group.position.y -= FH
  const cc = S.crossChase
  if (cc && cc.path) {
    cc.path.pts.forEach((p) => {
      p.y -= FH
    })
    crawler.group.position.y -= FH
  }
  if (S.ahead) figure.group.position.y -= FH
  if (S.walker) {
    S.walker.path.forEach((p) => {
      p.y -= FH
    })
    person.group.position.y -= FH
  }
  S.looping = false
  drawSigns(f + 1, `${f + 1}F`)
  S.tag = `L${f}`
  onRepeat(f)
}

/**
 * 20階に着いた。2012号室のドアが少し開いて、明かりが漏れている
 */
const reachTop = () => {
  S.onTop = true
  guide('top', '20階に着いた。2012号室は、廊下のいちばん奥。')
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
 * 最後の追いかけ。うしろの東の階段の扉が閉まり、廊下のうしろに、移る階で追いかけてきた這うものがいる。
 * どちらの階段室へも、もう出られない
 */
const startChase = () => {
  if (S.lift) endLift()
  if (S.crossChase && S.crossChase.phase !== 'done') endCrossChase()
  S.final = true
  building.zones.forEach((z) => {
    if (z.tag === `D${FLOORS}`) z.on = false
  })
  S.slamFor = 0.35
  sound.slam(0.6)
  // 頭 (体の向きの前 1.3m) が、決めた距離だけうしろに来るように置く
  const x = Math.min(CX1 - 0.4, S.pos.x + S.level.start + 1.3)
  crawler.reset()
  crawler.group.position.set(x, floorY(FLOORS), -0.7)
  crawler.group.rotation.set(0, 0, 0)
  crawler.face(S.pos)
  crawler.randomPose(0)
  crawler.group.visible = true
  guide('final', 'うしろに、何かいる。見ている間は、止まる。', 3200)
  guide('final2', '部屋まで、急いで。', 2600)
  S.flickerIn = 3
  S.darkFor = 0
  console.log('%cうしろ', 'color:#a33;font-size:13px')
}

/**
 * 20階の防火扉を閉める動き
 */
const updateSlam = (dt) => {
  if (S.slamFor <= 0) return
  S.slamFor = Math.max(0, S.slamFor - dt)
  const door = building.fireDoors.find((d) => d.floor === FLOORS && d.east)
  door.group.rotation.y = door.open * (S.slamFor / 0.35)
}

/**
 * 自分の足音と、少し遅れて鳴る、もう1人の足音の大きさ
 */
const echoVolume = () => {
  // 月見台から家までの道では、だれかがついてくる
  if (S.tag === 'S' && S.checkpoint === 'home' && !S.inside) return 0.12
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
  ringBell()
}

/**
 * 拾った鈴が、ポケットの中で鳴る。歩いている間は鳴らず、走ると毎歩鳴る
 */
const ringBell = () => {
  if (!S.bell || !S.running) return
  sound.suzu(0.16)
}

/**
 * 走って鈴を鳴らし続けると、音をたどって面無し様が来る。少し歩けば、おさまる。
 * 鳴らしすぎると、心臓の音が速くなる。最後の追いかけでは数えない。かんたんでは、知らせるだけで死なない
 */
const updateNoise = (dt) => {
  if (!S.bell || S.final || S.hunted) return
  const loud = S.running && S.walking
  S.noise = loud ? S.noise + dt : Math.max(0, S.noise - dt * 0.5)
  if (S.noise < 2) return
  if (!S.hinted.noise) {
    S.hinted.noise = true
    whisper('鈴が、鳴りすぎている。歩こう。')
    sound.whisper()
  }
  S.noiseBeat -= dt
  if (S.noiseBeat <= 0) {
    S.noiseBeat = Math.max(0.35, 0.9 - 0.2 * (S.noise - 2))
    sound.heartbeat(Math.min(0.6, 0.25 + 0.12 * (S.noise - 2)))
  }
  if (!S.level.events || S.noise < 4.5) return
  S.noise = 0
  oddDeath('鈴の音を、たどってきました。')
}

/**
 * 通りの歩道に落ちている鈴。近づくと、ひとりでに小さく鳴る。足もとまで来たら拾う。
 * 拾わずに通り過ぎても、いつの間にかポケットに入っている。いわれは、電車の広告 (ホラー映画) で知る
 */
const updateBell = () => {
  if (S.bell || !S.tag.startsWith('@C')) return
  const at = town.bell.at
  const d = flat(S.pos, at)
  if (!S.bellCalled && d < 4.5) {
    S.bellCalled = true
    sound.suzu(0.12)
  }
  if (d < 1.1) {
    pickBell('鈴を、拾った。')
    return
  }
  if (S.pos.x > at.x + 5) pickBell('ポケットの中で、鈴が鳴った。')
}

/**
 * 鈴を持つ。落ちていた鈴は消す
 */
const pickBell = (line) => {
  S.bell = true
  town.bell.mesh.visible = false
  sound.suzu(0.3)
  whisper(line, 2800)
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
 * 2012号室に入った。ドアを開けて中に入る。最後の日なら、暗転のあとにノックを鳴らす。
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
    // たまに、部屋の電気が消えている
    const unlit = Math.random() < 0.35
    if (unlit) {
      building.homeLamps.forEach((lamp) => {
        lamp.on = false
      })
    }
    const note = unlit ? ['', '廊下の電気を、消した覚えはありません。'] : []
    S.timeline = [
      [1.3, () => fadeOut(0.8)],
      [2.2, () => sound.slam(0.8)],
      [3.6, () => showEnding([...lines, ...note])],
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
 * つかまった。振り向かせて、目の前に這うものの顔を出す
 */
const caught = () => {
  crawlerHead(crawlHead)
  S.yaw = Math.atan2(-(crawlHead.x - S.pos.x), -(crawlHead.z - S.pos.z))
  S.pitch = 0.04
  die('あなたの歩き方を、おぼえました。', 0.9)
  crawlerToFace()
}

const scareAt = new THREE.Vector3()

/**
 * 目の前に、立ち上がった這うものを置く。口の開いた頭が、ちょうど目の前に来るように
 */
const crawlerToFace = () => {
  const g = crawler.group
  const fx = -Math.sin(S.yaw)
  const fz = -Math.cos(S.yaw)
  crawler.scarePose()
  g.rotation.set(0, 0, 0)
  g.position.set(S.pos.x + fx * 1.3, S.feet, S.pos.z + fz * 1.3)
  crawler.face(S.pos)
  g.updateMatrixWorld(true)
  crawler.head.getWorldPosition(scareAt)
  g.position.x += S.pos.x + fx * 0.5 - scareAt.x
  g.position.y += S.feet + EYE - scareAt.y
  g.position.z += S.pos.z + fz * 0.5 - scareAt.z
  g.visible = true
  sound.scare()
}

/**
 * 階段を下りすぎた。目の前に立っている
 */
const downDeath = () => {
  die('下には、もう戻れません。', 0.9)
  faceToFace()
}

/**
 * 20階より下の廊下の奥へ行こうとして、うしろから襲われた。振り向かせて、目の前に顔を出す
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
 * 20階より下の廊下に入った時。奥から明かりが消えていき、さらに進むと、うしろから襲われる。
 * 西の端からでも、東の端からでも同じ。東の階段へ移る階の廊下では、何も起きない。かんたんでは、明かりが消えるだけ
 */
const updateWrongWay = (dt) => {
  const m = /^C(\d+)$/.exec(S.tag)
  const floor = m ? Number(m[1]) : 0
  if (!m || floor >= FLOORS || floor === S.cross) {
    if (S.wrong) endWrongWay()
    return
  }
  // どちらの端から入ったか。入った端から、どれだけ奥へ来たか
  const east = S.wrong ? S.wrong.east : S.pos.x > (HX1 + CX1) / 2
  const depth = east ? CX1 - S.pos.x : S.pos.x - HX1
  if (!S.wrong && depth > WRONG_WARN) {
    S.wrong = { floor, east, next: east ? 0 : UNITS - 1, timer: 0 }
    whisper('そっちじゃない。戻ろう。')
    sound.whisper()
  }
  if (!S.wrong) return
  S.wrong.timer -= dt
  const w = S.wrong
  if (w.timer <= 0 && w.next >= 0 && w.next < UNITS) {
    const lamp = building.fixtures.find((f) => f.corridor === w.floor && f.unit === w.next)
    if (lamp) lamp.on = false
    sound.click()
    w.next += w.east ? 1 : -1
    w.timer = 0.16
  }
  if (S.level.strict && depth > WRONG_DEATH) wrongDeath()
}

/**
 * 東の階段へ移る階の廊下に、腰壁を外からつかんでいる手を置く。2本ずつ、間を空けて4組。少し大きい
 */
const placeHands = () => {
  const y = floorY(S.cross) + 1.15
  let x = 11.5 + Math.random() * 1.5
  hands.forEach((h, k) => {
    h.mesh.position.set(x, y, 0.17)
    h.mesh.rotation.set(0, (Math.random() - 0.5) * 0.4, 0)
    // 2本のうち片方は、左手 (裏返す)
    h.mesh.scale.set(k % 2 ? -1.3 : 1.3, 1.3, 1.3)
    h.mesh.visible = true
    h.drop = -1
    x += k % 2 === 0 ? 0.4 + Math.random() * 0.2 : 2.2 + Math.random() * 1.6
  })
}

/**
 * 腰壁をつかむ手。近づくと、手を放して下へ消える。前から這ってくるものが出たら、残りも全部放す
 */
const updateHands = (dt) => {
  const here = S.tag === `C${S.cross}`
  hands.forEach((h) => {
    if (!h.mesh.visible) return
    if (h.drop < 0) {
      const near = here && Math.abs(S.pos.x - h.mesh.position.x) < 2.8
      if (!near && !S.crossChase) return
      h.drop = 0
      sound.step(0.1, { muffle: 0.75 })
    }
    h.drop += dt
    h.mesh.position.y -= dt * 2.6
    if (h.drop > 0.4) h.mesh.visible = false
  })
}

/**
 * 道すじを1つ作る。start から始まり、あとで pathPush で点を足していく
 */
const makePath = (start) => ({ pts: [{ x: start.x, y: start.y, z: start.z, at: 0 }], len: 0 })

/**
 * 道すじに点を足す。前の点から 0.2m 以上離れた時だけ
 */
const pathPush = (path, x, y, z) => {
  const last = path.pts[path.pts.length - 1]
  const d = Math.hypot(x - last.x, z - last.z)
  if (d < 0.2) return
  path.len += d
  path.pts.push({ x, y, z, at: path.len })
}

/**
 * 道すじの、道のり at の場所を out に入れる。道すじの外なら、端の場所
 */
const pathAt = (path, at, out) => {
  const t = path.pts
  for (let i = t.length - 1; i > 0; i--) {
    const a = t[i - 1]
    if (a.at > at) continue
    const b = t[i]
    const k = Math.min(1, (at - a.at) / Math.max(b.at - a.at, 0.0001))
    return out.set(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k, a.z + (b.z - a.z) * k)
  }
  return out.set(t[0].x, t[0].y, t[0].z)
}

const crawlAhead = new THREE.Vector3()
const crawlHead = new THREE.Vector3()

/**
 * 這うものの頭の場所を out に入れる。体の向きの前、1.3m ほど先
 */
const crawlerHead = (out) => {
  const g = crawler.group
  return out.set(
    g.position.x + Math.sin(g.rotation.y) * 1.3,
    g.position.y + 0.7,
    g.position.z + Math.cos(g.rotation.y) * 1.3,
  )
}

/**
 * 這うものの足音。手足4本で、ひたひたと鳴る
 */
const crawlSound = (d) => {
  sound.step(THREE.MathUtils.clamp(1.8 / (1 + d), 0.06, 0.6), { muffle: 0.15 })
}

/**
 * 東の階段へ移る階の廊下を、半分くらいまで来た。先の明かりがちらついて、その下に這うものがいる。その奥は暗い
 */
const startCrossChase = () => {
  if (S.walker) hideWalker()
  // 10m ほど先の明かりの下に出す。その先の明かりは、もう消えている
  const lamps = building.fixtures
    .filter((f) => f.corridor === S.cross)
    .sort((a, c) => a.unit - c.unit)
  const spot = lamps.find((f) => f.pos.x > S.pos.x + 9) || lamps[lamps.length - 1]
  lamps.forEach((f) => {
    if (f.unit > spot.unit) f.on = false
  })
  spot.on = true
  spot.stutter = 0.8
  S.crossChase = { phase: 'appear', t: 0, next: spot.unit, speed: 0, gait: 0, step: 0 }
  crawler.reset()
  crawler.group.position.set(spot.pos.x + 0.8, floorY(S.cross), -0.7)
  crawler.group.rotation.set(0, -Math.PI / 2, 0)
  crawler.randomPose(0.3)
  crawler.group.visible = true
  sound.flicker()
  sound.suzu(0.14)
}

/**
 * 移る階の廊下の明かりを、元に戻す
 */
const restoreCrossLights = () => {
  building.fixtures.forEach((f, i) => {
    if (f.corridor === S.cross) f.on = lightsAtStart[i].on
  })
}

/**
 * 這うものに追いつかれた。振り向かせて、目の前に這うものの顔を出す
 */
const crossDeath = () => {
  crawlerHead(crawlHead)
  S.yaw = Math.atan2(-(crawlHead.x - S.pos.x), -(crawlHead.z - S.pos.z))
  S.pitch = 0.02
  S.hunted = false
  die('すぐうしろまで、這ってきていました。', 0.7)
  crawlerToFace()
}

/**
 * 這うものが消える。30秒逃げきったか、かんたんで追いつかれた時
 */
const endCrossChase = () => {
  const cc = S.crossChase
  cc.phase = 'done'
  crawler.group.visible = false
  crawler.group.rotation.x = 0
  S.hunted = false
  S.noise = 0
  restoreCrossLights()
  sound.flicker()
}

/**
 * 移る階の廊下の、前から這ってくるもの。先の明かりの下からこちらへ這ってきて、通り過ぎた明かりは消えていく。
 * 目の前まで来ると明かりが消えて、点き直すと、すり抜けてうしろにいる。そこから30秒、歩いた道すじをたどって
 * 追いかけてくる。歩くより速く、走るより少し遅い。かんたんでは、追いつかれても消えるだけ
 */
const updateCrossChase = (dt) => {
  const cc = S.crossChase
  if (!cc || cc.phase === 'done') return
  cc.t += dt
  const y = floorY(S.cross)
  const g = crawler.group
  if (cc.phase === 'appear') {
    // 少しのあいだ、明かりの下で、こちらを向いている
    crawler.face(S.pos)
    if (cc.t < 1.4) return
    cc.phase = 'rush'
    cc.t = 0
    sound.whisper()
    return
  }
  if (cc.phase === 'rush') {
    // 通り過ぎた明かりは、うしろから消えていく
    for (;;) {
      const lamp = building.fixtures.find((f) => f.corridor === S.cross && f.unit === cc.next)
      if (!lamp || lamp.pos.x < g.position.x + 1.6) break
      lamp.on = false
      sound.click()
      cc.next -= 1
    }
    // こちらへ向かって、だんだん速く這ってくる
    cc.speed = Math.min(6, 1.2 + cc.t * 3)
    crawler.face(S.pos)
    const d = flat(g.position, S.pos)
    const move = Math.min(cc.speed * dt, Math.max(0, d - 1.2))
    g.position.x += ((S.pos.x - g.position.x) / d) * move
    g.position.z += ((S.pos.z - g.position.z) / d) * move
    cc.gait += move / 0.9
    crawler.crawl(cc.gait, 0.32)
    cc.step += move
    if (cc.step > 0.45) {
      cc.step = 0
      crawlSound(d)
    }
    if (d - 1.2 > 0.25) return
    // 目の前で、明かりが消える
    cc.phase = 'black'
    cc.t = 0
    setDark(true)
    g.visible = false
    sound.scare()
    sound.suzu(0.3)
    return
  }
  if (cc.phase === 'black') {
    if (cc.t < 0.75) return
    // 点き直すと、すり抜けて、うしろ (西) にいる
    setDark(false)
    const x = Math.max(HX1 + 0.3, S.pos.x - 6)
    g.position.set(x, y, -0.7)
    crawler.face(S.pos)
    crawler.randomPose(0.6)
    g.visible = true
    cc.phase = 'chase'
    // 這い出す前に、少しだけ間がある
    cc.t = -0.6
    cc.path = makePath(g.position)
    pathPush(cc.path, S.pos.x, S.feet, S.pos.z)
    cc.along = 0
    S.hunted = true
    whisper('走って。')
    sound.heartbeat(0.6)
    return
  }
  // 追いかけてくる
  pathPush(cc.path, S.pos.x, S.feet, S.pos.z)
  if (cc.t < 0) {
    crawler.face(S.pos)
    return
  }
  cc.speed = 2.0 * Math.min(1, 0.4 + cc.t)
  const before = cc.along
  cc.along = Math.min(cc.path.len, cc.along + cc.speed * dt)
  pathAt(cc.path, cc.along, g.position)
  pathAt(cc.path, Math.min(cc.path.len, cc.along + 0.6), crawlAhead)
  const across = Math.hypot(crawlAhead.x - g.position.x, crawlAhead.z - g.position.z)
  if (across > 0.01) {
    g.rotation.y = Math.atan2(crawlAhead.x - g.position.x, crawlAhead.z - g.position.z)
    // 階段では、体を坂に合わせて傾ける
    g.rotation.x = THREE.MathUtils.clamp(
      -Math.atan2(crawlAhead.y - g.position.y, across),
      -0.6,
      0.6,
    )
  }
  const moved = cc.along - before
  cc.gait += moved / 0.9
  crawler.crawl(cc.gait, 0.32)
  const d = Math.hypot(g.position.x - S.pos.x, g.position.y - S.feet, g.position.z - S.pos.z)
  cc.step += moved
  if (cc.step > 0.45) {
    cc.step = 0
    crawlSound(d)
  }
  S.beatIn -= dt
  if (S.beatIn <= 0) {
    S.beatIn = 0.45
    sound.heartbeat(0.5)
  }
  // 頭が追いついたら、つかまる
  if (cc.path.len - cc.along < 1.5 || d < 1.2) {
    if (S.level.events) {
      crossDeath()
      return
    }
    endCrossChase()
    return
  }
  if (cc.t > 30 || S.onTop) endCrossChase()
}

/**
 * 西の階段がふさがっている階。初めて着いた時に、東の階段へ行くように知らせる。
 * 廊下には腰壁をつかむ手があり、半分くらいまで来ると、前から這うものが来る
 */
const updateCrossing = (dt) => {
  const f = S.cross
  if (!S.hinted.cross && S.tag === `L${f}` && S.pos.x < HX1) {
    S.hinted.cross = true
    whisper('工事中で、上がれない。廊下を通って、東側の階段へ。', 4000)
  }
  updateHands(dt)
  if (!S.crossChase && S.tag === `C${f}` && S.pos.x > 26 && !S.final) startCrossChase()
  updateCrossChase(dt)
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
 * 場所に応じた出来事。建物に入る、階段、20階、追いかけ、2012号室
 */
const onPlace = () => {
  // マンションの区画 (道とエントランスの前、駅など '@' で始まる区画のほか) に入ったら、建物の中。
  // 壁ぞいに入っても、ここで必ず中になる
  if (!S.inside && S.tag !== 'S' && S.tag !== 'E' && !S.tag.startsWith('@')) {
    S.inside = true
    building.zones.find((z) => z.tag === 'E').on = false
    sound.slam(0.25)
  }
  onStairs()
  const topHall = `H${FLOORS}`
  const topCorridor = `C${FLOORS}`
  if (!S.onTop && !S.looping && (S.tag === topHall || S.tag === topCorridor)) reachTop()
  if (S.onTop && !S.final && S.tag === topCorridor && S.pos.x < CHASE_X) startChase()
  const atHome = S.tag === topCorridor && Math.abs(S.pos.x - homeDoor.x) < 0.45 && S.pos.z < -0.95
  if (S.onTop && atHome) goHome()
}

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
  if (velocity.lengthSq() > 1) velocity.normalize()
  S.running = f >= 0 && pressed('ShiftLeft', 'ShiftRight') === 1
  let speed = S.running ? RUN : WALK
  if (f < 0) speed = WALK * 0.65
  velocity.multiplyScalar(speed)
}

/**
 * 自動で歩かせる。S.auto の点を順にたどり、進む向きへ顔も向ける。
 * 最後の点に着いたら (つかえて着けない時は6秒で)、操作を戻す
 */
const autoVelocity = (dt) => {
  S.running = false
  velocity.set(0, 0, 0)
  S.autoFor += dt
  const next = S.auto[0]
  const dx = next.x - S.pos.x
  const dz = next.z - S.pos.z
  const d = Math.hypot(dx, dz)
  if (d < 0.05 || S.autoFor > 6) {
    S.auto.shift()
    if (S.auto.length === 0 || S.autoFor > 6) S.auto = null
    return
  }
  S.yaw = lerpAngle(S.yaw, Math.atan2(-dx, -dz), 1 - Math.exp(-4 * dt))
  S.pitch *= 1 - Math.min(1, 2 * dt)
  velocity.set(dx / d, 0, dz / d).multiplyScalar(Math.min(WALK, d / dt))
}

/**
 * キーで (自動で歩かせている間は、決めた道すじで) プレイヤーを動かす。
 * 歩ける区画からはみ出さないようにして、足元の高さも決める
 */
const move = (dt) => {
  if (S.auto) {
    autoVelocity(dt)
  } else {
    keyVelocity(dt)
  }
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
  recordTrail()
  if (S.mode !== 'play') return
  onPlace()
}

/**
 * 建物の中で歩いた道すじを、0.2m ごとに残す。古い方から捨てて、100m 分くらいを持つ
 */
const recordTrail = () => {
  if (!S.inside) return
  const t = S.trail
  const last = t[t.length - 1]
  const d = last ? Math.hypot(S.pos.x - last.x, S.pos.z - last.z) : 0
  if (last && d < 0.2) return
  S.trailLen += d
  t.push({ x: S.pos.x, y: S.feet, z: S.pos.z, at: S.trailLen })
  if (t.length > 500) t.shift()
}

/**
 * 歩いた道すじの、道のり at の場所を out に入れる。道すじの外なら、端の場所
 */
const trailAt = (at, out) => {
  const t = S.trail
  if (t.length === 0) return out.set(S.pos.x, S.feet, S.pos.z)
  for (let i = t.length - 1; i > 0; i--) {
    const a = t[i - 1]
    if (a.at > at) continue
    const b = t[i]
    const k = Math.min(1, (at - a.at) / Math.max(b.at - a.at, 0.0001))
    return out.set(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k, a.z + (b.z - a.z) * k)
  }
  return out.set(t[0].x, t[0].y, t[0].z)
}

/**
 * 歩いた道すじのうち、p にいちばん近い所の道のり
 */
const trailNear = (p) => {
  let best = S.trailLen
  let bestD = Infinity
  S.trail.forEach((q) => {
    const d = Math.hypot(q.x - p.x, (q.y - p.y) * 1.5, q.z - p.z)
    if (d >= bestD) return
    bestD = d
    best = q.at
  })
  return best
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

const bodySphere = new THREE.Sphere(new THREE.Vector3(), 0.8)

/**
 * 這うものが、画面に写っているか。体の真ん中 (頭とうしろ足のあいだ) で見る
 */
const crawlerInView = () => {
  updateFrustum()
  const g = crawler.group
  bodySphere.center.set(
    g.position.x + Math.sin(g.rotation.y) * 0.7,
    g.position.y + 0.6,
    g.position.z + Math.cos(g.rotation.y) * 0.7,
  )
  return frustum.intersectsSphere(bodySphere)
}

/**
 * 最後の追いかけの、這うものの今の速さ。明かりが消えている間は速く、見られている間は止まる
 */
const chaseSpeed = () => {
  if (S.dark) return S.level.rush
  if (crawlerInView()) return 0
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
    crawler.randomPose(near)
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
 * 最後の追いかけの1フレーム分。見ていない間は這ってきて、見ると止まる。止まるたびに、姿勢が変わっている
 */
const updateChase = (dt) => {
  if (!S.final) return
  const fig = crawler.group.position
  const full = flat(fig, S.pos)
  // 頭までの距離。頭は、体の向きの前 1.3m
  const d = full - 1.3
  if (d < 0.45) {
    caught()
    return
  }
  const near = THREE.MathUtils.clamp(1 - d / 12, 0, 1)
  flickers(dt, near)
  const speed = chaseSpeed()
  crawler.face(S.pos)
  if (speed > 0) {
    const stepLen = Math.min(speed * dt, Math.max(0, d - 0.3))
    fig.x += ((S.pos.x - fig.x) / full) * stepLen
    fig.z += ((S.pos.z - fig.z) / full) * stepLen
    S.gait += stepLen / 0.9
    crawler.crawl(S.gait, 0.32)
    S.moved += stepLen
    if (S.moved > 0.45) {
      S.moved = 0
      sound.step(THREE.MathUtils.clamp(2.4 / (d + 1), 0.08, 0.8), { muffle: 0.3 })
    }
  }
  heartbeat(dt, near)
  sound.setDrone(0.25 + near * 0.75)
}

/**
 * しばらく立ち止まっていると、うしろから足音が近づいてくる
 */
const updateIdle = (dt) => {
  // 電車を待つ間や乗っている間は立ち止まるので、マンションの中だけ
  if (S.final || level() < 1 || S.walking || !S.inside) return
  S.idle += dt
  if (S.idleWarned && S.level.strict && S.idle > 6.5) {
    idleDeath()
    return
  }
  if (S.idle < 22) return
  S.idle = S.level.strict ? 0 : -40
  S.idleWarned = true
  sound.approach()
  whisper('足音が、近づいてくる。歩こう。')
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
  figure.group.visible = false
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
 * ふつう以上で、2階から上のホールに入った時に、たまにエレベーターが着く。
 * 扉が開いている間に近づくと、引きずり込まれる
 */
const updateLift = (dt) => {
  if (!S.level.events || S.final) return
  if (!S.lift) {
    const m = /^H(\d+)$/.exec(S.tag)
    if (!m || Number(m[1]) < 2 || S.liftDone || S.ahead) return
    S.liftDone = true
    if (Math.random() < 0.45) startLift(Number(m[1]))
    return
  }
  const L = S.lift
  L.t += dt
  if (L.t > 1.2 && !S.hinted.lift) {
    S.hinted.lift = true
    whisper('エレベーターに、近づかないで。')
  }
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
  // 2日目から、たまに。明るい自販機の前で立ち止まっていると、明かりがちらついてから襲われる
  if (S.vendTrap) {
    const front = Math.abs(S.pos.x - vend.pos.x) < 0.9 && S.pos.z > 1.2 && S.pos.z < 2.3
    S.vendFor = front && !S.walking ? S.vendFor + dt : 0
    if (S.vendFor > 2 && !S.hinted.vend) {
      S.hinted.vend = true
      vend.stutter = 0.8
      whisper('見られてる。ここで止まらないで。')
    }
    if (S.vendFor > 3.6) {
      oddDeath('明るいところは、よく見えます。')
      return
    }
  }
  if (!S.dropped && Math.hypot(S.pos.x - vend.pos.x, S.pos.z - 1.5) < 2.4) {
    S.dropped = true
    if (Math.random() < 0.5) {
      sound.drop()
      vend.stutter = 0.35
    }
  }
  if (S.tag !== `L${FLOORS + 1}`) return
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
  // 電車、駅、会社のロビーのような明るい所では、懐中電灯は点けない (外の道では点ける)
  if (/^@(T|O|[CH][EGTNP])/.test(S.tag)) power = 0
  flashlight.intensity = power
}

/**
 * ふつう以上では、見ていない間に、階段室の窓の外に人が立つ。見つかると少しして消える
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
  // 覗くのは、階段室の窓だけ (住んでいる人の部屋の窓は使わない)
  const win = building.windows.find((w) => {
    if (w.floor % 1 === 0) return false
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
  const m = /^[LAMB](\d+)$/.exec(S.tag)
  return m ? Number(m[1]) : 0
}

/**
 * from 階から階段を下りて、玄関から外へ出ていく道すじ。東の階段から下りる人は、西の階段がふさがっている階で
 * 廊下を通って西の階段へ移る
 */
const exitPath = (from) => {
  const pts = []
  for (let f = from - 1; f >= 1; f--) {
    if (f === S.cross - 1 && from > S.cross) pts.push(...crossPath(S.cross, true))
    pts.push(...descentPath(f, eastFrom(f)))
  }
  pts.push(
    new THREE.Vector3(SX1, 0, -0.8),
    new THREE.Vector3(SX1 + 1.0, 0, -1.3),
    new THREE.Vector3(5.0, 0, -0.5),
    new THREE.Vector3(5.0, 0, 1.9),
    new THREE.Vector3(Math.random() < 0.5 ? -9 : 20, 0, 2.1),
  )
  return pts
}

/**
 * from 階の踊り場から階段を上がり、f 階の廊下の部屋に入っていく道すじ。from が1なら、1階のホールから。
 * from 階から上がるのに使う方の階段で上がり、東の階段なら、廊下の東の端から部屋へ行く
 */
const homePath = (from, f, unit) => {
  const east = eastFrom(from)
  const pts =
    from === 1
      ? [
          new THREE.Vector3(4.6, 0, -0.9),
          new THREE.Vector3(SX1 + 1.0, 0, -1.3),
          new THREE.Vector3(SX1, 0, -0.8),
        ]
      : []
  for (let k = from; k < f; k++) pts.push(...descentPath(k, east).reverse())
  const y = floorY(f)
  const x = doorX(unit)
  if (east) {
    pts.push(
      new THREE.Vector3(stairX(SX1 - 0.3, true), y, -0.8),
      new THREE.Vector3(CX1 - 0.6, y, -0.7),
    )
  } else {
    pts.push(
      new THREE.Vector3(SX1, y, -0.8),
      new THREE.Vector3(SX1 + 1.2, y, -0.9),
      new THREE.Vector3(6.8, y, -0.7),
    )
  }
  pts.push(new THREE.Vector3(x, y, -0.7), new THREE.Vector3(x, y, -1.25))
  return pts
}

/**
 * 階段に、人を1人出す。4階上から下りて外へ出ていく人と、2階下から上がって1つ下の階の部屋に帰る人がいる。
 * 下りてくる人の一部は、おかしな人。ふつうの顔の人の一部は、こちらをじっと見てくる人 (watch)
 * @param force - 確かめる時だけ使う。{ strange, up, mimic, watch } で出し方を決める
 */
const spawnWalker = (force = {}) => {
  const pf = Math.max(1, stairFloor())
  // いる方の階段に出す。上がってくる人は、2階下から同じ階段で上がってこられる時だけ。
  // 下りてくる人は、足音が長く聞こえるように、4階上から。西の階段なら、ふさいである階より上からは来ない
  const east = S.pos.x > (HX1 + CX1) / 2
  const upOk = east ? pf - 2 >= S.cross : pf >= 3
  const from = Math.min(east ? FLOORS : S.cross, pf + 4)
  const up = upOk && (force.up ?? (from <= pf || Math.random() < 0.3))
  if (!up && from <= pf) return
  S.walkers += 1
  // 2人目に下りてくる人は、じっと見てくる人にする
  const watchTurn = !up && S.walkers === 2
  const chance = Math.min(0.7, 0.25 + 0.12 * (S.day - 1) + 0.08 * S.loops)
  const strange = !up && !watchTurn && !force.watch && (force.strange ?? Math.random() < chance)
  // 2日目からは、おかしな人の半分が、顔があってあいさつもする。足音だけがしない
  const mimic = strange && (force.mimic ?? (S.day >= 2 && Math.random() < 0.5))
  const watch = !up && !strange && (force.watch ?? (watchTurn || Math.random() < 0.2))
  const unit = Math.floor(Math.random() * UNITS)
  const path = up ? homePath(pf - 2, pf - 1, unit) : exitPath(from)
  S.walker = {
    path,
    seg: 0,
    along: 0,
    strange,
    up,
    unit,
    home: pf - 1,
    phase: 0,
    lastStep: 0,
    mode: 'walk',
    stare: 0,
    look: 0,
    greeted: false,
    mimic,
    watch,
    minD: Infinity,
    pale: 0,
    watchFor: 0,
  }
  // じっと見てくる人は、スマホを持たない (首がこちらを向く)
  const seed = watch ? 1 + 2 * Math.floor(Math.random() * 3) : Math.floor(Math.random() * 6)
  person.dress(seed, strange && !mimic)
  person.group.position.copy(path[0])
  person.group.visible = true
}

/**
 * すれ違う人を消す
 */
const hideWalker = () => {
  person.group.visible = false
  S.walker = null
  // 追いかけられていたなら、鈴の音は数え直す (逃げきったあと、すぐに鳴らしすぎで死なないように)
  if (S.hunted) S.noise = 0
  S.hunted = false
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
  const door = building.doors.find((d) => d.floor === w.home && d.idx === w.unit)
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

const walkerAhead = new THREE.Vector3()

/**
 * すれ違う人の首を、こちらへ向ける。体の向きはそのままで、首だけ回して、見上げる / 見下ろす
 * @param k - 向く速さ
 */
const turnHeadToPlayer = (dt, k) => {
  const g = person.group
  const yaw = Math.atan2(S.pos.x - g.position.x, S.pos.z - g.position.z)
  const turn = THREE.MathUtils.clamp(
    Math.atan2(Math.sin(yaw - g.rotation.y), Math.cos(yaw - g.rotation.y)),
    -1.2,
    1.2,
  )
  const across = Math.max(0.3, Math.hypot(S.pos.x - g.position.x, S.pos.z - g.position.z))
  const tilt = THREE.MathUtils.clamp(-Math.atan2(eye.y - headPoint.y, across), -0.7, 0.6)
  const h = person.head.rotation
  const s = 1 - Math.exp(-k * dt)
  h.y += (turn - h.y) * s
  h.x += (tilt - h.x) * s
}

/**
 * じっと見てくる人と、目を合わせすぎた。顔の真っ白な人が、目の前にいる
 */
const watcherDeath = () => {
  const g = person.group
  S.hunted = false
  S.walker = null
  S.yaw = Math.atan2(-(g.position.x - S.pos.x), -(g.position.z - S.pos.z))
  S.pitch = 0.02
  g.position.set(S.pos.x - Math.sin(S.yaw) * 0.42, S.feet, S.pos.z - Math.cos(S.yaw) * 0.42)
  person.face(S.pos)
  person.fade(1)
  person.head.rotation.set(0, 0, 0.25)
  sound.scare()
  die('ずっと、目が合っていましたね。', 0.7)
}

/**
 * すれ違ったあとに立ち止まって、こちらをじっと見ている間。見ているうちに、顔がだんだん白くなる。
 * 目を合わせ続けると、追いかけてくる。目をそらして離れれば、見ていない間にいなくなる
 */
const watchWalker = (dt, d) => {
  const w = S.walker
  person.face(S.pos)
  turnHeadToPlayer(dt, 6)
  updateFrustum()
  sphere.center.copy(headPoint)
  const seen = frustum.intersectsSphere(sphere) && !stairBlocked(eye, headPoint)
  const looking = seen && d < 12 && lookingAt(headPoint, 0.3)
  w.look = looking ? w.look + dt : Math.max(0, w.look - dt * 0.4)
  w.pale = Math.min(1, w.pale + dt * (looking ? 0.42 : 0.05))
  person.fade(w.pale)
  w.watchFor += dt
  if (looking && w.look > 0.7 && !S.hinted.watch) {
    S.hinted.watch = true
    whisper('目を、そらして。')
    sound.whisper()
  }
  if (w.look > 2.4) {
    // 追いかけてくる。こちらの歩いた道すじを、走ってたどる
    w.mode = 'chase'
    w.along = trailNear(person.group.position)
    w.chaseFor = 0
    w.stepLen = 0
    // 走り出す前に、首をかしげて、少しだけ間がある
    w.windup = 0.7
    person.fade(1)
    S.hunted = true
    sound.whisper()
    sound.heartbeat(0.6)
    return
  }
  if (!seen && (d > 10 || w.watchFor > 25)) hideWalker()
}

/**
 * じっと見てくる人が、追いかけてくる間。首をかしげた少しの間のあと、走ってくる。
 * 歩くより速く、走るより少し遅い。5秒逃げきれば、消える
 */
const chaseWalker = (dt, d) => {
  const w = S.walker
  const g = person.group
  if (w.windup > 0) {
    w.windup -= dt
    person.face(S.pos)
    person.head.rotation.set(-0.2, 0, 0.45)
    return
  }
  w.chaseFor += dt
  // 走り出しは、少しずつ速くなる
  const speed = 1.9 * Math.min(1, 0.3 + w.chaseFor / 0.8)
  const before = w.along
  w.along = Math.min(S.trailLen, w.along + speed * dt)
  trailAt(w.along, g.position)
  trailAt(Math.min(S.trailLen, w.along + 0.4), walkerAhead)
  if (Math.hypot(walkerAhead.x - g.position.x, walkerAhead.z - g.position.z) > 0.01) {
    g.rotation.y = Math.atan2(walkerAhead.x - g.position.x, walkerAhead.z - g.position.z)
  }
  person.head.rotation.set(-0.15, 0, 0.3)
  w.phase += (speed * dt) / 0.6
  person.walk(w.phase)
  w.stepLen += w.along - before
  if (w.stepLen > 0.55) {
    w.stepLen = 0
    sound.step(THREE.MathUtils.clamp(2.2 / (1 + d), 0.12, 0.8), { muffle: 0.1 })
  }
  S.beatIn -= dt
  if (S.beatIn <= 0) {
    S.beatIn = 0.42
    sound.heartbeat(0.55)
  }
  const close = Math.hypot(g.position.x - S.pos.x, g.position.y - S.feet, g.position.z - S.pos.z)
  if (S.trailLen - w.along < 0.9 || close < 0.8) {
    watcherDeath()
    return
  }
  if (w.chaseFor > 5) vanishWalker()
}

/**
 * 階段ですれ違う人の1フレーム分。ふつう以上で、階段にいる間だけ出てくる。
 * うしろからついてくる人がいる間は、出さない
 */
const updateWalker = (dt) => {
  if (!S.level.events || S.final || !S.inside) return
  const w = S.walker
  if (!w) {
    const pf = stairFloor()
    if (!pf || pf >= FLOORS || S.follow || S.hunted) return
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
  if (w.mode === 'watch') {
    watchWalker(dt, d)
    return
  }
  if (w.mode === 'chase') {
    chaseWalker(dt, d)
    return
  }
  // 下へ2階分より離れたか、上へ4階分より離れたら、もう見えないので消す
  const rel = g.position.y - S.feet
  if (w.seg > 2 && (rel < -FH * 2.2 || rel > FH * 4.6)) {
    hideWalker()
    return
  }
  // 道すじに沿って歩く
  const speed = w.strange ? 0.95 : w.watch ? 1.1 : 1.25
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
  // じっと見てくる人は、近づいてくる間ずっとこちらを見ていて、あいさつはしない。
  // すれ違って、こちらより少し下まで下りたら、立ち止まって振り向く
  if (w.watch) {
    if (d < 9) turnHeadToPlayer(dt, 3)
    w.minD = Math.min(w.minD, d)
    if (w.minD < 3 && g.position.y < S.feet - 1.1) {
      w.mode = 'watch'
      person.walk(Math.round(w.phase))
    }
    return
  }
  if ((!w.strange || w.mimic) && !w.greeted && d < 2.4 && dy < 1.2 && lookingAt(headPoint, 0.6)) {
    w.greeted = true
    whisper('こんばんは。')
  }
  if (w.strange && d < 1.9 && dy < 1.3) {
    w.mode = 'stare'
    sound.whisper()
  }
}

const storyHead = new THREE.Vector3()

/**
 * 話の流れ。中央町のホームの向かいに顔の無い人が立っていて、目が合う。電車では隣の車両にいて、
 * 目を離すたびに近づく。月見台に着く前に消える
 */
const updateStory = (dt) => {
  const st = S.story
  if (!st) return
  const T = S.trip
  if (st.stage === 'none' && /^@C[EGTNP]/.test(S.tag)) {
    st.stage = 'platform'
    const p = workStation.far
    figure.group.position.set(p.x + 3.5, 0, p.z)
    figure.randomPose(0)
    figure.group.visible = true
  }
  if (st.stage === 'platform') {
    figure.face(S.pos)
    storyHead.copy(figure.group.position)
    storyHead.y += 1.6
    if (S.tag === '@CP' && inView() && lookingAt(storyHead, 0.22)) st.look += dt
    if (st.look > 1.0 && !st.met) {
      st.met = true
      figure.randomPose(0.25)
      sound.whisper()
      whisper('目が、合った。', 2600)
      if (T) T.waited = Math.max(T.waited, 6.5)
    }
    if (T && T.phase === 'board') {
      figure.group.visible = false
      st.stage = 'ride'
    }
    return
  }
  // 西原を出て、乗客がほとんどいなくなってから、隣の車両に現れる
  if (st.stage === 'ride' && T && T.phase === 'cruise' && T.leg === LEGS.length - 1) {
    st.stage = 'car'
    figure.randomPose(0)
    figure.group.visible = true
    sound.suzu(0.08)
    setTimeout(() => whisper('隣の車両に、だれかいる。目を離さないで。', 3400), 1200)
  }
  if (st.stage !== 'car') return
  // 目を離すたびに、3.5m ずつ近づく。近づくたびに、ポケットの鈴がひとりでに鳴る。
  // ふつう以上では、隣の車両を抜けてこちらの車両まで来て、追いつかれると死ぬ
  const base = train.root.position
  figure.group.position.set(base.x + st.carX, 0, base.z)
  figure.group.rotation.y = -Math.PI / 2
  const limit = S.level.events ? -20 : CAR / 2 + 2
  if (inView()) {
    st.unseen = 0
  } else {
    st.unseen += dt
    if (st.unseen > 1.4 && st.carX > limit) {
      st.carX -= 3.5
      st.unseen = 0
      sound.step(0.12, { muffle: 0.5 })
      sound.suzu(0.05)
    }
  }
  if (S.level.events && st.carX - (S.pos.x - base.x) < 1.2) {
    S.yaw = Math.atan2(-(figure.group.position.x - S.pos.x), -(figure.group.position.z - S.pos.z))
    die('隣の車両から、来ていました。', 0.7)
    faceToFace()
    return
  }
  if (T && T.phase === 'arrive' && T.t > 3) {
    figure.group.visible = false
    sound.flicker()
    st.stage = 'home'
  }
}

/**
 * 会社のロビーの自動ドアと、通りの信号。信号は青の間だけ、ピヨピヨ鳴る
 */
const updateTown = (dt) => {
  const near = flat(S.pos, town.door) < 2.4
  town.lobbyDoors.forEach((g) => {
    const target = g.userData.home + g.userData.side * (near ? 1.05 : 0)
    g.position.x += (target - g.position.x) * Math.min(1, dt * 4)
  })
  S.signalT = (S.signalT || 0) + dt
  const go = S.signalT % 24 < 9
  town.signals.forEach((face) => {
    face.material = go ? town.walkGo : town.walkRed
  })
  if (!go || !S.tag.startsWith('@C')) return
  S.chirpIn = (S.chirpIn || 0) - dt
  if (S.chirpIn > 0) return
  S.chirpIn = 0.55
  const d = Math.abs(S.pos.x - (town.door.x + 38))
  if (d < 25) sound.chirp(0.05 * (1 - d / 25))
}

const guardBase = town.guardShadow.position.z
const pedHead = new THREE.Vector3()

/**
 * 通りを歩く人を1人出す。向こう (駅の方) から来てすれ違う人か、少し先を同じ向きに歩く人
 * @param toward - こちらへ向かって来る人なら true
 */
const spawnPedestrian = (toward) => {
  const m = crowd.take('ped')
  if (!m) return
  const tx = town.door.x
  const z = town.door.z + (toward ? 2.4 : 1.3)
  const x0 = toward ? Math.min(S.pos.x + 40, tx + 95) : S.pos.x + 10
  const x1 = toward ? tx - 30 : tx + 95
  if (!toward && x0 > x1 - 5) {
    crowd.release(m)
    return
  }
  crowd.put(m, scene, x0, 0, z, toward ? -Math.PI / 2 : Math.PI / 2, 'stand', 20 + m.k)
  m.toward = toward
  m.state = 'walk'
  crowd.walk(m, [v3(x1, 0, z)], { speed: toward ? 1.15 : 0.85, done: () => crowd.release(m) })
}

/**
 * すれ違った人を振り返って見ると、立ち止まって、白い顔でこちらを向いている。すぐに消える (1日に1回、ふつう以上)
 */
const watchPedestrian = (m, dt) => {
  if (!m.toward || !S.level.events) return
  const p = m.p.group.position
  if (m.state === 'stare') {
    m.stare -= dt
    m.p.group.rotation.y = Math.atan2(S.pos.x - p.x, S.pos.z - p.z)
    if (m.stare > 0) return
    crowd.release(m)
    sound.flicker()
    return
  }
  if (S.pedGhost) return
  const behind = S.pos.x - p.x
  if (behind < 3 || behind > 22) return
  pedHead.copy(p)
  pedHead.y += 1.6
  if (!lookingAt(pedHead, 0.25)) return
  S.pedGhost = true
  m.state = 'stare'
  m.stare = 1.5
  m.path = null
  m.p.stand()
  m.p.blank(true)
  sound.whisper()
}

/**
 * 会社のまわりの人。警備室のすりガラスの影は、少しゆれていて、ドアの前まで来ると消えている。
 * 通りには、向こうから来てすれ違う人と、先を歩く人がいる。駅に入るまで
 */
const updateStreetPeople = (dt) => {
  if (!S.story || S.story.stage !== 'none') return
  const g = town.guardShadow
  if (g.visible) {
    g.position.z = guardBase + Math.sin(performance.now() * 0.0004) * 0.04
    if (Math.hypot(S.pos.x - g.position.x, S.pos.z - g.position.z) < 2.4) g.visible = false
  }
  if (!S.tag.startsWith('@C') && S.tag !== '@OD') return
  const peds = crowd.people.filter((m) => m.used && m.tag === 'ped')
  S.pedIn -= dt
  if (S.pedIn <= 0 && peds.length < 2) {
    S.pedIn = 6 + Math.random() * 6
    spawnPedestrian(!peds.some((m) => m.toward))
  }
  peds.forEach((m) => watchPedestrian(m, dt))
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
 * 遊んでいる間の1フレーム分
 */
const updatePlay = (dt) => {
  updateTrip(dt)
  if (S.mode !== 'play') return
  crowd.update(dt)
  updateTown(dt)
  updateStreetPeople(dt)
  updateBell()
  updateLastPassenger()
  updateStory(dt)
  move(dt)
  if (S.mode !== 'play') return
  updateGuide()
  updateAhead(dt)
  updateChase(dt)
  if (S.mode !== 'play') return
  updateWrongWay(dt)
  if (S.mode !== 'play') return
  updateCrossing(dt)
  updateIdle(dt)
  updateNoise(dt)
  if (S.mode !== 'play') return
  updateTorch(dt)
  updatePeek(dt)
  updateWalker(dt)
  updateLampFigure(dt)
  updateOddities(dt)
  updateStairOddities(dt)
  if (S.mode !== 'play') return
  updateFollower(dt)
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
 * 2012号室に入る演出。ドアを開けて、中へ進む
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
 * 階ごとの部品のうち、遠い階のものを隠して、描く数を減らす。外にいる間は、下の4階分だけ描く (上は霧でほぼ見えない)
 */
const updateLayers = () => {
  const here = Math.floor((S.feet + 0.5) / FH) + 1
  building.floorGroups.forEach((g, f) => {
    if (g) g.visible = S.inside ? Math.abs(f - here) <= 2 : f <= 4
  })
}

/**
 * カメラをプレイヤーの目の位置に置く。歩いている間は、少し頭が揺れる
 */
const placeCamera = (dt) => {
  const sway = S.running ? 0.04 : 0.026
  const target = S.walking ? -Math.abs(Math.sin(S.stride * Math.PI)) * sway : 0
  S.bob += (target - S.bob) * Math.min(1, dt * 12)
  // 電車に乗って走っている間は、少し揺れる
  const t = performance.now() / 1000
  const rock = S.trip ? S.trip.sway : 0
  camera.position.set(S.pos.x, S.feet + EYE + S.bob + Math.sin(t * 7.3) * 0.006 * rock, S.pos.z)
  camera.rotation.set(S.pitch, S.yaw, Math.sin(t * 1.1) * 0.008 * rock, 'YXZ')
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
  updateEntrance(dt)
  updateClock()
  placeCamera(dt)
  updateLayers()
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
  S.locking = false
  if (document.pointerLockElement) {
    S.lockedOnce = true
    return
  }
  if (S.mode === 'play' && S.locked) pause()
})

// ロックを断られた時。Chrome は、Esc で外した直後 (1.25秒) のロックを断る。
// 一度ロックできていたなら、もう一度クリックしてもらう
document.addEventListener('pointerlockerror', () => {
  S.locking = false
  if (S.mode === 'play' && S.locked && S.lockedOnce) pause()
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

/**
 * タイトルで、かんたんを選んだ。そんな帰り道は無いと言われて、もう押せなくなる
 */
const refuseEasy = (button) => {
  $('greeting').textContent = 'かんたんな帰り道なんて、ありませんよ。'
  button.disabled = true
  sound.start()
  sound.whisper()
}

document.querySelectorAll('#levels button').forEach((button) => {
  button.addEventListener('click', () => {
    if (button.dataset.level === 'easy') {
      refuseEasy(button)
      return
    }
    begin(button.dataset.level)
  })
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
    start: (levelName = 'normal') => begin(levelName, false),
    home: () => goHome(),
    person,
    walker: (force) => spawnWalker(force),
    follower: () => startFollower(),
    crossChase: () => startCrossChase(),
    crawler,
    hands,
    lamp: () => showLampFigure(),
    lift: (floor) => startLift(floor),
    renderer,
    scene,
    camera,
    seeker,
    crowd,
    ride,
    homeStation,
    train,
    town,
    workStation,
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
