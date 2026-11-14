/**
 * 音を割るための、ウェーブシェイパーの曲線
 */
const distortion = (amount) => {
  const n = 1024
  const curve = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1
    curve[i] = ((3 + amount) * x * 20 * (Math.PI / 180)) / (Math.PI + amount * Math.abs(x))
  }
  return curve
}

/**
 * Web Audio で、足音や物音をその場で作って鳴らす。音のファイルは使わない
 */
export const createSound = () => {
  let ctx = null
  let out = null
  let noise = null
  let humGain = null
  let droneGain = null
  let trainGain = null

  /**
   * 2秒分の白色雑音を作る
   */
  const makeNoise = () => {
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) {
      data[i] = Math.random() * 2 - 1
    }
    return buffer
  }

  /**
   * ずっと鳴っている音を用意する。蛍光灯のうなりと、低いうなり
   */
  const makeBeds = () => {
    humGain = ctx.createGain()
    humGain.gain.value = 0
    humGain.connect(out)
    const buzz = ctx.createOscillator()
    buzz.type = 'sawtooth'
    buzz.frequency.value = 100
    const band = ctx.createBiquadFilter()
    band.type = 'bandpass'
    band.frequency.value = 300
    band.Q.value = 0.7
    buzz.connect(band).connect(humGain)
    const low = ctx.createOscillator()
    low.frequency.value = 100
    const lowGain = ctx.createGain()
    lowGain.gain.value = 1.5
    low.connect(lowGain).connect(humGain)
    buzz.start()
    low.start()

    droneGain = ctx.createGain()
    droneGain.gain.value = 0
    droneGain.connect(out)
    ;[55, 55.6, 82.4].forEach((f) => {
      const osc = ctx.createOscillator()
      osc.frequency.value = f
      osc.connect(droneGain)
      osc.start()
    })
    const rumble = ctx.createBufferSource()
    rumble.buffer = noise
    rumble.loop = true
    const lowpass = ctx.createBiquadFilter()
    lowpass.type = 'lowpass'
    lowpass.frequency.value = 160
    rumble.connect(lowpass).connect(droneGain)
    rumble.start()

    // 電車の走る音。低いごうっという音と、モーターのうなり
    trainGain = ctx.createGain()
    trainGain.gain.value = 0
    trainGain.connect(out)
    const roar = ctx.createBufferSource()
    roar.buffer = noise
    roar.loop = true
    const roarFilter = ctx.createBiquadFilter()
    roarFilter.type = 'lowpass'
    roarFilter.frequency.value = 420
    roar.connect(roarFilter).connect(trainGain)
    roar.start()
    const motor = ctx.createOscillator()
    motor.type = 'triangle'
    motor.frequency.value = 180
    const motorGain = ctx.createGain()
    motorGain.gain.value = 0.25
    motor.connect(motorGain).connect(trainGain)
    motor.start()
  }

  /**
   * 音を鳴らせるようにする。ブラウザの決まりで、クリックの中で呼ぶ必要がある
   */
  const start = () => {
    if (ctx) {
      ctx.resume()
      return
    }
    ctx = new AudioContext()
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -12
    comp.ratio.value = 8
    comp.connect(ctx.destination)
    out = ctx.createGain()
    out.gain.value = 0.9
    out.connect(comp)
    noise = makeNoise()
    makeBeds()
    ctx.resume()
  }

  /**
   * 雑音を、フィルターと音量の山を付けて短く鳴らす
   */
  const burst = (t, { vol, freq, q = 1, type = 'bandpass', len = 0.1, attack = 0.004 }) => {
    const src = ctx.createBufferSource()
    src.buffer = noise
    const filter = ctx.createBiquadFilter()
    filter.type = type
    filter.frequency.value = freq
    filter.Q.value = q
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(Math.max(vol, 0.0002), t + attack)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + len)
    src.connect(filter).connect(gain).connect(out)
    src.start(t, Math.random() * 1.5, attack + len + 0.05)
  }

  /**
   * 低い「ドン」を鳴らす
   */
  const thump = (t, vol, freq = 90, len = 0.14) => {
    const osc = ctx.createOscillator()
    osc.frequency.setValueAtTime(freq, t)
    osc.frequency.exponentialRampToValueAtTime(freq * 0.5, t + len)
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(Math.max(vol, 0.0002), t)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + len)
    osc.connect(gain).connect(out)
    osc.start(t)
    osc.stop(t + len + 0.02)
  }

  /**
   * 足音を1歩鳴らす
   * @param muffle - 0 から 1。大きいほど、こもって遠くに聞こえる
   * @param when - 今から何秒後に鳴らすか
   */
  const step = (vol, { muffle = 0, when = 0 } = {}) => {
    if (!ctx) return
    const t = ctx.currentTime + when
    const freq = (1400 - muffle * 900) * (0.85 + Math.random() * 0.3)
    burst(t, { vol: vol * 0.55, freq, q: 0.9, len: 0.08 + muffle * 0.06 })
    thump(t, vol * 0.5, 95 - muffle * 25)
  }

  /**
   * 蛍光灯がちらつく時の、ジジッという音
   */
  const flicker = () => {
    if (!ctx) return
    const t = ctx.currentTime
    for (let i = 0; i < 5; i++) {
      burst(t + Math.random() * 0.2, {
        vol: 0.06,
        freq: 4000,
        type: 'highpass',
        len: 0.02,
        attack: 0.001,
      })
    }
  }

  /**
   * 蛍光灯が消えきった時の、カチッという音
   */
  const clunk = () => {
    if (!ctx) return
    const t = ctx.currentTime
    thump(t, 0.4, 70, 0.2)
    burst(t, { vol: 0.2, freq: 1800, q: 2, len: 0.04, attack: 0.001 })
  }

  /**
   * ささやき声のような、息の音
   */
  const whisper = () => {
    if (!ctx) return
    const t = ctx.currentTime
    for (let i = 0; i < 6; i++) {
      burst(t + i * 0.19 + Math.random() * 0.05, {
        vol: 0.05 + Math.random() * 0.05,
        freq: 2200 + Math.random() * 1600,
        q: 3,
        len: 0.12,
        attack: 0.04,
      })
    }
  }

  /**
   * つかまった時の、大きな音
   */
  const scare = () => {
    if (!ctx) return
    const t = ctx.currentTime
    const shaper = ctx.createWaveShaper()
    shaper.curve = distortion(30)
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.45, t + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.8)
    shaper.connect(gain).connect(out)
    ;[146.8, 155.6, 220, 311.1, 466.2].forEach((f) => {
      const osc = ctx.createOscillator()
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(f, t)
      osc.frequency.exponentialRampToValueAtTime(f * 0.62, t + 1.7)
      osc.connect(shaper)
      osc.start(t)
      osc.stop(t + 1.85)
    })
    burst(t, { vol: 0.5, freq: 1200, q: 0.5, len: 0.9, attack: 0.01 })
    thump(t, 0.9, 60, 0.6)
  }

  /**
   * ドアがきしむ音
   */
  const creak = () => {
    if (!ctx) return
    const t = ctx.currentTime
    const src = ctx.createBufferSource()
    src.buffer = noise
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.Q.value = 14
    filter.frequency.setValueAtTime(320, t)
    filter.frequency.linearRampToValueAtTime(760, t + 0.6)
    filter.frequency.linearRampToValueAtTime(540, t + 1.0)
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.5, t + 0.08)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.1)
    src.connect(filter).connect(gain).connect(out)
    src.start(t, 0, 1.2)
  }

  /**
   * ドアが勢いよく閉まる音
   */
  const slam = (vol = 1) => {
    if (!ctx) return
    const t = ctx.currentTime
    thump(t, 0.9 * vol, 58, 0.45)
    burst(t, { vol: 0.5 * vol, freq: 500, type: 'lowpass', len: 0.3, attack: 0.002 })
  }

  /**
   * ドアをノックする音
   */
  const knock = (count = 3) => {
    if (!ctx) return
    const t = ctx.currentTime
    for (let i = 0; i < count; i++) {
      const at = t + i * 0.42
      thump(at, 0.7, 120, 0.12)
      burst(at, { vol: 0.25, freq: 900, q: 1.5, len: 0.05, attack: 0.002 })
    }
  }

  /**
   * ドアノブを押し下げる音。内側から、だれかが何度か開けようとする
   * @param beats - 押し下げる時刻 (秒) の並び
   */
  const rattle = (beats) => {
    if (!ctx) return
    const t = ctx.currentTime
    beats.forEach((b) => {
      burst(t + b, { vol: 0.2, freq: 2400 + Math.random() * 700, q: 5, len: 0.035, attack: 0.002 })
      burst(t + b + 0.09, { vol: 0.12, freq: 1900 + Math.random() * 500, q: 5, len: 0.03 })
      thump(t + b, 0.14, 170, 0.05)
    })
  }

  /**
   * インターホンの「ピンポーン」
   */
  const chime = (vol = 0.2) => {
    if (!ctx) return
    const t = ctx.currentTime
    ;[
      [659, 0],
      [523, 0.42],
    ].forEach(([freq, at]) => {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = freq
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0.0001, t + at)
      gain.gain.exponentialRampToValueAtTime(vol, t + at + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + at + 1.2)
      osc.connect(gain).connect(out)
      osc.start(t + at)
      osc.stop(t + at + 1.25)
    })
  }

  /**
   * エレベーターが着いた「ポーン」と、扉が開く音
   */
  const ding = () => {
    if (!ctx) return
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = 1318
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.16, t + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.6)
    osc.connect(gain).connect(out)
    osc.start(t)
    osc.stop(t + 1.7)
    burst(t + 1.2, { vol: 0.07, freq: 320, q: 0.7, len: 0.9, attack: 0.25 })
  }

  /**
   * 自販機の取り出し口に、缶が落ちる「ガコン」
   */
  const drop = () => {
    if (!ctx) return
    const t = ctx.currentTime
    thump(t, 0.5, 110, 0.18)
    burst(t, { vol: 0.25, freq: 900, q: 1.2, len: 0.12, attack: 0.002 })
    thump(t + 0.16, 0.25, 160, 0.1)
    burst(t + 0.16, { vol: 0.12, freq: 2200, q: 3, len: 0.05, attack: 0.002 })
  }

  /**
   * 懐中電灯のスイッチの、カチッという音
   */
  const click = () => {
    if (!ctx) return
    burst(ctx.currentTime, { vol: 0.18, freq: 3200, q: 3, len: 0.02, attack: 0.001 })
  }

  /**
   * 心臓の音を1回鳴らす
   */
  const heartbeat = (vol) => {
    if (!ctx) return
    const t = ctx.currentTime
    thump(t, vol, 52, 0.18)
    thump(t + 0.2, vol * 0.7, 48, 0.18)
  }

  /**
   * うしろから、だれかの足音が近づいてきて止まる
   */
  const approach = () => {
    for (let i = 0; i < 8; i++) {
      step(0.05 + i * 0.07, { muffle: 0.85 - i * 0.1, when: i * 0.56 })
    }
  }

  /**
   * 蛍光灯のうなりの大きさ (0 から 1)
   */
  const setHum = (level) => {
    if (!ctx) return
    humGain.gain.setTargetAtTime(level * 0.03, ctx.currentTime, 0.05)
  }

  /**
   * 低いうなりの大きさ (0 から 1)
   */
  /**
   * レールのつなぎ目を車輪が越える「ガタン、ゴトン」
   */
  const joint = (vol = 0.3) => {
    if (!ctx) return
    const t = ctx.currentTime
    ;[0, 0.12].forEach((at, k) => {
      thump(t + at, vol * (k ? 0.8 : 1), 70 - k * 6, 0.12)
      burst(t + at, { vol: vol * 0.45, freq: 600 - k * 80, q: 1, len: 0.06, attack: 0.002 })
    })
  }

  /**
   * 踏切の鐘。カン、カン
   */
  const bell = (vol = 0.1) => {
    if (!ctx) return
    const t = ctx.currentTime
    ;[0, 0.42].forEach((at) => {
      const osc = ctx.createOscillator()
      osc.type = 'square'
      osc.frequency.value = 780
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0.0001, t + at)
      gain.gain.exponentialRampToValueAtTime(vol, t + at + 0.005)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + at + 0.3)
      osc.connect(gain).connect(out)
      osc.start(t + at)
      osc.stop(t + at + 0.32)
    })
  }

  /**
   * 電車の走る音の大きさ (0 から 1)
   */
  const setTrain = (level) => {
    if (!ctx) return
    trainGain.gain.setTargetAtTime(level * 0.07, ctx.currentTime, 0.3)
  }

  /**
   * ドアが開け閉めする時の、空気の抜ける音
   */
  const doorHiss = () => {
    if (!ctx) return
    burst(ctx.currentTime, { vol: 0.12, freq: 2600, q: 0.6, len: 0.5, attack: 0.05 })
  }

  const setDrone = (level) => {
    if (!ctx) return
    droneGain.gain.setTargetAtTime(level * 0.09, ctx.currentTime, 0.4)
  }

  return {
    start,
    step,
    flicker,
    clunk,
    whisper,
    scare,
    creak,
    slam,
    knock,
    heartbeat,
    rattle,
    chime,
    ding,
    drop,
    click,
    approach,
    setHum,
    setDrone,
    joint,
    bell,
    setTrain,
    doorHiss,
  }
}
