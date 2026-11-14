// 足音と、外の風の音。Web Audio でその場で作る。あしおとの sound.js をもとにしている

/**
 * Web Audio で、足音と風の音を鳴らす。音のファイルは使わない
 */
export const createSound = () => {
  let ctx = null
  let out = null
  let noise = null
  let windGain = null

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
   * ずっと鳴っている、低い風の音。ゆっくり強くなったり弱くなったりする
   */
  const makeWind = () => {
    windGain = ctx.createGain()
    windGain.gain.value = 0
    windGain.connect(out)
    const src = ctx.createBufferSource()
    src.buffer = noise
    src.loop = true
    const lowpass = ctx.createBiquadFilter()
    lowpass.type = 'lowpass'
    lowpass.frequency.value = 420
    const gust = ctx.createGain()
    gust.gain.value = 0.7
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 0.07
    const depth = ctx.createGain()
    depth.gain.value = 0.3
    lfo.connect(depth).connect(gust.gain)
    src.connect(lowpass).connect(gust).connect(windGain)
    src.start()
    lfo.start()
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
    makeWind()
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
   * 足音を1歩鳴らす。床の種類で音を変える
   * @param kind - 'tatami' / 'board' / 'hard' / 'ground' / 'grass' / 'gravel'
   */
  const step = (kind, vol) => {
    if (!ctx) return
    const t = ctx.currentTime
    const r = 0.85 + Math.random() * 0.3
    if (kind === 'tatami') {
      burst(t, { vol: vol * 0.3, freq: 700 * r, q: 0.6, len: 0.1 })
      thump(t, vol * 0.18, 70)
      return
    }
    if (kind === 'board') {
      burst(t, { vol: vol * 0.45, freq: 1150 * r, q: 1.1, len: 0.07 })
      thump(t, vol * 0.55, 120)
      return
    }
    if (kind === 'gravel') {
      burst(t, { vol: vol * 0.55, freq: 3200 * r, q: 0.5, type: 'highpass', len: 0.12 })
      burst(t + 0.03, { vol: vol * 0.35, freq: 2400 * r, q: 0.7, len: 0.08 })
      return
    }
    if (kind === 'grass') {
      burst(t, { vol: vol * 0.32, freq: 2600 * r, q: 0.5, len: 0.13, attack: 0.015 })
      thump(t, vol * 0.1, 60)
      return
    }
    if (kind === 'ground') {
      burst(t, { vol: vol * 0.4, freq: 1000 * r, q: 0.5, len: 0.11, attack: 0.01 })
      thump(t, vol * 0.14, 60)
      return
    }
    burst(t, { vol: vol * 0.55, freq: 1400 * r, q: 0.9, len: 0.08 })
    thump(t, vol * 0.5, 95)
  }

  /**
   * 風の音の大きさを、ゆっくり変える。家の中では小さくする
   */
  const setWind = (level) => {
    if (!ctx) return
    windGain.gain.setTargetAtTime(level, ctx.currentTime, 0.8)
  }

  return { start, step, setWind }
}
