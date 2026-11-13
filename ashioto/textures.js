import * as THREE from 'three'

const MINCHO = '"Hiragino Mincho ProN", "Yu Mincho", serif'
const GOTHIC = '"Hiragino Sans", "Yu Gothic", sans-serif'

/**
 * canvas に描いた絵を、three.js のテクスチャにする
 * @param draw - (ctx, w, h) を受け取って描く関数
 */
export const canvasTexture = (w, h, draw) => {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  draw(canvas.getContext('2d'), w, h)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.anisotropy = 8
  return tex
}

/**
 * 細かい点を散らして、ざらつきを足す
 */
const speckle = (ctx, w, h, count, colors, size = 2) => {
  for (let i = 0; i < count; i++) {
    const s = Math.random() * size + 0.5
    ctx.fillStyle = colors[i % colors.length]
    ctx.fillRect(Math.random() * w, Math.random() * h, s, s)
  }
}

/**
 * うすいしみを、ぼかした円でいくつか描く
 * @param rgb - 'r, g, b' の形の色
 */
const stains = (ctx, w, h, count, rgb, alpha) => {
  for (let i = 0; i < count; i++) {
    const x = Math.random() * w
    const y = Math.random() * h
    const r = 20 + Math.random() * 80
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, `rgba(${rgb}, ${alpha * Math.random()})`)
    g.addColorStop(1, `rgba(${rgb}, 0)`)
    ctx.fillStyle = g
    ctx.fillRect(x - r, y - r, r * 2, r * 2)
  }
}

/**
 * 文字を、真ん中そろえで書く
 */
const centerText = (ctx, text, x, y, font, color) => {
  ctx.font = font
  ctx.fillStyle = color
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, x, y)
}

/**
 * 長尺シートの床。1枚で、横は廊下の幅、縦は2m
 */
export const floorTexture = () =>
  canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#4b5049'
    ctx.fillRect(0, 0, w, h)
    const wear = ctx.createLinearGradient(0, 0, w, 0)
    wear.addColorStop(0, 'rgba(0, 0, 0, 0.2)')
    wear.addColorStop(0.5, 'rgba(255, 255, 255, 0.06)')
    wear.addColorStop(1, 'rgba(0, 0, 0, 0.2)')
    ctx.fillStyle = wear
    ctx.fillRect(0, 0, w, h)
    speckle(ctx, w, h, 9000, ['#5d625a', '#3c403a', '#686d64', '#30332f'], 2.2)
    stains(ctx, w, h, 6, '20, 18, 14', 0.25)
    ctx.fillStyle = 'rgba(20, 22, 18, 0.5)'
    ctx.fillRect(0, h / 2, w, 2)
  })

/**
 * 古くなったクリーム色の壁。1枚で、横は約2m、縦は天井まで
 */
export const wallTexture = () =>
  canvasTexture(512, 620, (ctx, w, h) => {
    ctx.fillStyle = '#b3ab9c'
    ctx.fillRect(0, 0, w, h)
    speckle(ctx, w, h, 6000, ['#bdb5a6', '#a8a091', '#c3bcae'], 2)
    stains(ctx, w, h, 10, '90, 75, 55', 0.18)
    const grime = ctx.createLinearGradient(0, h * 0.78, 0, h)
    grime.addColorStop(0, 'rgba(60, 50, 38, 0)')
    grime.addColorStop(1, 'rgba(60, 50, 38, 0.35)')
    ctx.fillStyle = grime
    ctx.fillRect(0, h * 0.78, w, h * 0.22)
  })

/**
 * 穴の空いた石膏ボードの天井。1枚で、横は廊下の幅、縦は2m
 */
export const ceilingTexture = () =>
  canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#8a867d'
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = '#76726a'
    for (let y = 8; y < h; y += 16) {
      for (let x = 8 + ((y / 16) % 2) * 8; x < w; x += 16) {
        ctx.fillRect(x, y, 2, 2)
      }
    }
    ctx.fillStyle = '#6d6961'
    ctx.fillRect(0, 0, w, 3)
    ctx.fillRect(0, 0, 3, h)
    stains(ctx, w, h, 4, '70, 60, 45', 0.2)
  })

/**
 * 塗装の古い、鉄の玄関ドア
 */
export const doorTexture = () =>
  canvasTexture(256, 596, (ctx, w, h) => {
    ctx.fillStyle = '#4a4038'
    ctx.fillRect(0, 0, w, h)
    for (let x = 0; x < w; x += 2) {
      ctx.fillStyle = `rgba(0, 0, 0, ${Math.random() * 0.08})`
      ctx.fillRect(x, 0, 1, h)
    }
    ctx.strokeStyle = 'rgba(20, 16, 12, 0.6)'
    ctx.lineWidth = 3
    ctx.strokeRect(18, 18, w - 36, h - 36)
    ctx.fillStyle = 'rgba(25, 20, 16, 0.35)'
    ctx.fillRect(0, h - 70, w, 70)
    stains(ctx, w, h, 5, '15, 12, 10', 0.3)
  })

/**
 * 部屋番号の札
 */
export const plateTexture = (text) =>
  canvasTexture(256, 108, (ctx, w, h) => {
    ctx.fillStyle = '#d6d0c2'
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = '#8f897d'
    ctx.lineWidth = 6
    ctx.strokeRect(3, 3, w - 6, h - 6)
    centerText(ctx, text, w / 2, h / 2 + 4, `600 64px ${GOTHIC}`, '#2b2824')
  })

/**
 * 赤地に白い文字のラベル (消火器の箱など)
 */
export const labelTexture = (text) =>
  canvasTexture(256, 96, (ctx, w, h) => {
    ctx.fillStyle = '#b8231d'
    ctx.fillRect(0, 0, w, h)
    centerText(ctx, text, w / 2, h / 2 + 3, `700 54px ${GOTHIC}`, '#f4efe6')
  })

/**
 * 時計の針を1本描く
 */
const hand = (ctx, c, angle, len, width, color) => {
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(c - Math.sin(angle) * 12, c + Math.cos(angle) * 12)
  ctx.lineTo(c + Math.sin(angle) * len, c - Math.cos(angle) * len)
  ctx.stroke()
}

/**
 * 壁の時計の文字盤。draw(date) で、その時刻の針を描き直す
 */
export const clockFace = () => {
  let ctx = null
  const tex = canvasTexture(256, 256, (c) => {
    ctx = c
  })

  /**
   * 渡された時刻で、文字盤と針を描く
   */
  const draw = (date) => {
    const c = 128
    ctx.clearRect(0, 0, 256, 256)
    ctx.fillStyle = '#e9e5dc'
    ctx.beginPath()
    ctx.arc(c, c, 126, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#2a2622'
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2
      const inner = i % 5 === 0 ? 94 : 106
      ctx.lineWidth = i % 5 === 0 ? 6 : 2
      ctx.beginPath()
      ctx.moveTo(c + Math.sin(a) * inner, c - Math.cos(a) * inner)
      ctx.lineTo(c + Math.sin(a) * 114, c - Math.cos(a) * 114)
      ctx.stroke()
    }
    const s = date.getSeconds()
    const m = date.getMinutes() + s / 60
    const h = (date.getHours() % 12) + m / 60
    hand(ctx, c, (h / 12) * Math.PI * 2, 58, 9, '#1e1b18')
    hand(ctx, c, (m / 60) * Math.PI * 2, 88, 6, '#1e1b18')
    hand(ctx, c, (s / 60) * Math.PI * 2, 98, 2, '#9b1c16')
    tex.needsUpdate = true
  }

  return { tex, draw }
}

/**
 * 壁の貼り紙。draw(lines) で文面を書き直す
 */
export const noticePaper = () => {
  let ctx = null
  const tex = canvasTexture(360, 480, (c) => {
    ctx = c
  })

  /**
   * 貼り紙の文面を描く。1行目は見出し
   */
  const draw = (lines) => {
    const w = 360
    const h = 480
    ctx.fillStyle = '#ebe5d6'
    ctx.fillRect(0, 0, w, h)
    const age = ctx.createLinearGradient(0, 0, w, h)
    age.addColorStop(0, 'rgba(160, 130, 70, 0.1)')
    age.addColorStop(1, 'rgba(120, 95, 50, 0.22)')
    ctx.fillStyle = age
    ctx.fillRect(0, 0, w, h)
    centerText(ctx, lines[0], w / 2, 80, `700 38px ${MINCHO}`, '#262320')
    lines.slice(1).forEach((line, i) => {
      centerText(ctx, line, w / 2, 160 + i * 44, `500 25px ${MINCHO}`, '#262320')
    })
    tex.needsUpdate = true
  }

  return { tex, draw }
}
