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
 * 古くなったクリーム色の塗装の壁。1枚で2m 四方
 */
export const wallTexture = () =>
  canvasTexture(512, 620, (ctx, w, h) => {
    ctx.fillStyle = '#afa694'
    ctx.fillRect(0, 0, w, h)
    speckle(ctx, w, h, 6000, ['#b9b09f', '#a39a89', '#bfb7a7'], 2)
    stains(ctx, w, h, 14, '90, 75, 55', 0.22)
    speckle(ctx, w, h, 500, ['rgba(60, 50, 40, 0.25)'], 3)
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
    stains(ctx, w, h, 7, '90, 70, 40', 0.26)
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

/**
 * 外壁の二丁掛けタイル。1枚で1.2m 四方
 */
export const tileTexture = () =>
  canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#6f6556'
    ctx.fillRect(0, 0, w, h)
    const rows = 20
    const th = h / rows
    const tw = w / 5.3
    for (let r = 0; r < rows; r++) {
      const off = (r % 2) * (tw / 2)
      for (let x = -tw; x < w + tw; x += tw) {
        const v = Math.random() * 16 - 8 - (Math.random() < 0.08 ? 18 : 0)
        ctx.fillStyle = `rgb(${172 + v}, ${155 + v}, ${132 + v})`
        ctx.fillRect(x + off + 2, r * th + 2, tw - 4, th - 3)
      }
    }
    stains(ctx, w, h, 10, '50, 42, 34', 0.18)
  })

/**
 * 打ちっぱなしに近い、塗装の古いコンクリート。1枚で1.5m 四方
 */
export const concreteTexture = () =>
  canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#8b8780'
    ctx.fillRect(0, 0, w, h)
    speckle(ctx, w, h, 7000, ['#95918a', '#7f7b74', '#9c988f', '#77736c'], 2)
    stains(ctx, w, h, 10, '40, 36, 30', 0.18)
  })

/**
 * エントランスの床の石目タイル。1枚で1.2m 四方 (600mm 角が4枚)
 */
export const stoneTileTexture = () =>
  canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#8c857a'
    ctx.fillRect(0, 0, w, h)
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        const v = Math.random() * 12 - 6
        ctx.fillStyle = `rgb(${186 + v}, ${178 + v}, ${165 + v})`
        ctx.fillRect(i * 256 + 2, j * 256 + 2, 252, 252)
      }
    }
    speckle(ctx, w, h, 5000, ['rgba(120, 112, 100, 0.5)', 'rgba(210, 204, 192, 0.5)'], 2.5)
    stains(ctx, w, h, 5, '90, 80, 66', 0.12)
  })

/**
 * 夜のアスファルト。1枚で3m 四方
 */
export const asphaltTexture = () =>
  canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#2e2f31'
    ctx.fillRect(0, 0, w, h)
    speckle(ctx, w, h, 14000, ['#3a3b3d', '#252628', '#434446', '#1d1e20'], 2)
    stains(ctx, w, h, 6, '10, 10, 12', 0.3)
  })

/**
 * 歩道のインターロッキング。1枚で1m 四方
 */
export const paverTexture = () =>
  canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#5a554e'
    ctx.fillRect(0, 0, w, h)
    const bw = w / 5
    const bh = h / 10
    for (let r = 0; r < 10; r++) {
      const off = (r % 2) * (bw / 2)
      for (let x = -bw; x < w + bw; x += bw) {
        const v = Math.random() * 14 - 7
        ctx.fillStyle = `rgb(${130 + v}, ${122 + v}, ${112 + v})`
        ctx.fillRect(x + off + 2, r * bh + 2, bw - 4, bh - 4)
      }
    }
    stains(ctx, w, h, 6, '30, 28, 24', 0.25)
  })

/**
 * 植え込みの低木
 */
export const hedgeTexture = () =>
  canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#1d2a1c'
    ctx.fillRect(0, 0, w, h)
    speckle(ctx, w, h, 5000, ['#2c3d29', '#16211a', '#384c32', '#0f1710'], 4)
  })

/**
 * 玄関ドア。郵便受けとのぞき穴は絵で描く
 */
export const doorLeafTexture = () =>
  canvasTexture(256, 596, (ctx, w, h) => {
    ctx.fillStyle = '#4d4036'
    ctx.fillRect(0, 0, w, h)
    for (let x = 0; x < w; x += 2) {
      ctx.fillStyle = `rgba(0, 0, 0, ${Math.random() * 0.07})`
      ctx.fillRect(x, 0, 1, h)
    }
    ctx.strokeStyle = 'rgba(20, 15, 12, 0.5)'
    ctx.lineWidth = 3
    ctx.strokeRect(14, 14, w - 28, h - 28)
    ctx.fillStyle = '#9c978e'
    ctx.fillRect(w / 2 - 50, h * 0.575 - 9, 100, 18)
    ctx.fillStyle = '#1b1814'
    ctx.fillRect(w / 2 - 44, h * 0.575 - 4, 88, 8)
    ctx.fillStyle = '#a7a299'
    ctx.beginPath()
    ctx.arc(w / 2, h * 0.275, 6, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = 'rgba(20, 16, 12, 0.35)'
    ctx.fillRect(0, h - 60, w, 60)
    stains(ctx, w, h, 4, '15, 12, 10', 0.25)
  })

/**
 * メーターボックスの扉。上下にガラリがある
 */
export const meterBoxTexture = () =>
  canvasTexture(128, 384, (ctx, w, h) => {
    ctx.fillStyle = '#bdb6a7'
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = '#8f897c'
    for (let i = 0; i < 6; i++) {
      ctx.fillRect(16, 20 + i * 9, w - 32, 4)
      ctx.fillRect(16, h - 74 + i * 9, w - 32, 4)
    }
    ctx.fillStyle = '#6e6a61'
    ctx.fillRect(w - 24, h / 2 - 12, 8, 24)
    ctx.strokeStyle = 'rgba(70, 64, 56, 0.6)'
    ctx.lineWidth = 3
    ctx.strokeRect(4, 4, w - 8, h - 8)
    stains(ctx, w, h, 5, '60, 50, 40', 0.24)
    const rust = ctx.createLinearGradient(0, h - 40, 0, h)
    rust.addColorStop(0, 'rgba(120, 66, 30, 0)')
    rust.addColorStop(1, 'rgba(120, 66, 30, 0.45)')
    ctx.fillStyle = rust
    ctx.fillRect(0, h - 40, w, 40)
    for (let i = 0; i < 5; i++) {
      const x = 16 + Math.random() * (w - 32)
      const g = ctx.createLinearGradient(0, 74, 0, 74 + 50 + Math.random() * 60)
      g.addColorStop(0, 'rgba(110, 60, 28, 0.4)')
      g.addColorStop(1, 'rgba(110, 60, 28, 0)')
      ctx.fillStyle = g
      ctx.fillRect(x, 74, 2, 110)
    }
  })

/**
 * 1つの階の部屋番号札を、1枚の絵に並べる。i 番目の札は、横 1/12 の幅
 */
export const plateAtlas = (floor) =>
  canvasTexture(1536, 80, (ctx) => {
    for (let i = 0; i < 12; i++) {
      const x = i * 128
      ctx.fillStyle = '#e6e1d5'
      ctx.fillRect(x, 0, 128, 80)
      ctx.strokeStyle = '#6f6a60'
      ctx.lineWidth = 4
      ctx.strokeRect(x + 6, 6, 116, 68)
      const num = `${floor}${String(i + 1).padStart(2, '0')}`
      centerText(ctx, num, x + 64, 42, `600 ${num.length > 3 ? 38 : 46}px ${GOTHIC}`, '#24211d')
    }
  })

/**
 * 集合ポスト。12列 × 4段
 */
export const mailboxTexture = () =>
  canvasTexture(1024, 512, (ctx, w, h) => {
    ctx.fillStyle = '#5c5a55'
    ctx.fillRect(0, 0, w, h)
    const cw = w / 12
    const ch = h / 4
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 12; c++) {
        const x = c * cw
        const y = r * ch
        ctx.fillStyle = '#b9b5ac'
        ctx.fillRect(x + 3, y + 3, cw - 6, ch - 6)
        ctx.fillStyle = '#e6e2d8'
        ctx.fillRect(x + 10, y + 12, cw - 20, 20)
        centerText(
          ctx,
          `${4 - r}${String(c + 1).padStart(2, '0')}`,
          x + cw / 2,
          y + 22,
          `600 16px ${GOTHIC}`,
          '#2b2824',
        )
        ctx.fillStyle = '#2e2c28'
        ctx.beginPath()
        ctx.arc(x + cw / 2, y + ch * 0.62, 9, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#7d7970'
        ctx.fillRect(x + 10, y + ch - 20, cw - 20, 6)
      }
    }
  })

/**
 * 階段室の壁に描く階の表示。draw(text) で書き直す。背景は透明
 */
export const floorSign = () => {
  let ctx = null
  const tex = canvasTexture(256, 160, (c) => {
    ctx = c
  })

  /**
   * 壁にペンキで描いたような、階の名前を書く
   * @param red - 赤いペンキで書いて、下へ垂らすなら true
   */
  const draw = (text, red = false) => {
    ctx.clearRect(0, 0, 256, 160)
    const color = red ? 'rgba(122, 14, 9, 0.95)' : 'rgba(48, 46, 43, 0.92)'
    centerText(ctx, text, 128, 84, `700 118px ${GOTHIC}`, color)
    if (red) {
      ctx.fillStyle = color
      for (let i = 0; i < 7; i++) {
        ctx.fillRect(60 + Math.random() * 140, 120, 3 + Math.random() * 3, 10 + Math.random() * 30)
      }
    }
    tex.needsUpdate = true
  }

  return { tex, draw }
}

/**
 * 緑の非常口の表示
 */
export const exitTexture = () =>
  canvasTexture(256, 96, (ctx, w, h) => {
    ctx.fillStyle = '#1d8f47'
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = '#f2f7ee'
    ctx.fillRect(14, 14, 54, 68)
    ctx.fillStyle = '#1d8f47'
    ctx.beginPath()
    ctx.arc(46, 30, 7, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillRect(30, 40, 22, 8)
    ctx.fillRect(38, 44, 8, 22)
    ctx.fillRect(28, 62, 14, 8)
    ctx.fillRect(44, 62, 8, 16)
    centerText(ctx, '非常口', 162, 50, `700 46px ${GOTHIC}`, '#f2f7ee')
  })

/**
 * 自販機の見本を1本描く。缶か、ペットボトル。丸みは左右の陰で出す
 * @param base - 底の y
 */
const drawDrink = (ctx, cx, base, bottle, body, band) => {
  const bw = bottle ? 24 : 30
  const bh = bottle ? 66 : 52
  const x = cx - bw / 2
  const y = base - bh
  ctx.fillStyle = body
  ctx.beginPath()
  ctx.roundRect(x, y, bw, bh, bottle ? 5 : 3)
  ctx.fill()
  if (bottle) {
    ctx.fillRect(cx - 6, y - 12, 12, 13)
    ctx.fillStyle = '#e9ebec'
    ctx.fillRect(cx - 7, y - 19, 14, 7)
  } else {
    ctx.fillStyle = '#b9bcbf'
    ctx.fillRect(x + 2, y - 3, bw - 4, 4)
  }
  ctx.fillStyle = band
  ctx.fillRect(x, y + bh * 0.32, bw, bh * 0.3)
  const shade = ctx.createLinearGradient(x, 0, x + bw, 0)
  shade.addColorStop(0, 'rgba(0, 0, 0, 0.38)')
  shade.addColorStop(0.32, 'rgba(255, 255, 255, 0.28)')
  shade.addColorStop(0.55, 'rgba(255, 255, 255, 0)')
  shade.addColorStop(1, 'rgba(0, 0, 0, 0.42)')
  ctx.fillStyle = shade
  ctx.fillRect(x, y - (bottle ? 19 : 3), bw, bh + (bottle ? 19 : 3))
}

/**
 * 自販機の見本の窓。3段 × 8列で、下に値段の帯 (青はつめたい、赤はあたたかい) とボタン
 */
export const vendingTexture = () =>
  canvasTexture(512, 374, (ctx, w, h) => {
    const bg = ctx.createLinearGradient(0, 0, 0, h)
    bg.addColorStop(0, '#f6f9fb')
    bg.addColorStop(1, '#dbe3ea')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, w, h)
    const palette = [
      ['#b3261e', '#f2f2f2'],
      ['#1f5fa8', '#f5f5f5'],
      ['#2f7d3a', '#efe7c8'],
      ['#e0a21b', '#3a2a10'],
      ['#eef2f4', '#1f5fa8'],
      ['#5b3a24', '#e9d8b8'],
      ['#cfe3c4', '#3d6b2f'],
      ['#ff7a1a', '#ffffff'],
      ['#20242a', '#c9a24a'],
    ]
    const cols = 8
    const cw = w / cols
    const rh = h / 3
    for (let r = 0; r < 3; r++) {
      ctx.fillStyle = 'rgba(120, 130, 140, 0.35)'
      ctx.fillRect(0, r * rh + rh - 31, w, 3)
      for (let c = 0; c < cols; c++) {
        const [body, band] = palette[(r * 5 + c * 4) % palette.length]
        const cx = c * cw + cw / 2
        const base = r * rh + rh - 32
        const bottle = (r * 3 + c) % 4 === 1 || r === 0
        drawDrink(ctx, cx, base, bottle, body, band)
        const hot = r === 2 && c >= 5
        ctx.fillStyle = hot ? '#c8281e' : '#1d5fb5'
        ctx.fillRect(c * cw + 4, base + 5, cw - 8, 12)
        ctx.font = `700 10px ${GOTHIC}`
        ctx.fillStyle = '#ffffff'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(hot ? '150' : bottle ? '180' : '130', cx, base + 11.5)
        ctx.fillStyle = '#2a2c2e'
        ctx.fillRect(cx - 14, base + 20, 28, 8)
        ctx.fillStyle = (r + c) % 7 === 3 ? '#e04a3a' : '#7ce68a'
        ctx.fillRect(cx - 11, base + 22, 22, 4)
      }
    }
  })

/**
 * 自販機の下半分の広告。青い地に、大きな文字
 */
export const vendingAdTexture = () =>
  canvasTexture(384, 352, (ctx, w, h) => {
    const bg = ctx.createLinearGradient(0, 0, w, h)
    bg.addColorStop(0, '#0e3f7a')
    bg.addColorStop(1, '#1b6fb5')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)'
    ctx.lineWidth = 10
    ctx.beginPath()
    ctx.moveTo(-20, h * 0.72)
    ctx.bezierCurveTo(w * 0.3, h * 0.55, w * 0.6, h * 0.95, w + 20, h * 0.7)
    ctx.stroke()
    centerText(ctx, 'つめたい', w / 2, h * 0.3, `800 64px ${GOTHIC}`, '#ffffff')
    centerText(ctx, 'のみもの', w / 2, h * 0.5, `700 34px ${GOTHIC}`, '#d8ecff')
  })

/**
 * 自販機の硬貨とお札の入れ口。上から、金額の表示、硬貨、お札、IC、返却レバー、おつり
 */
export const coinPanelTexture = () =>
  canvasTexture(160, 352, (ctx, w, h) => {
    const bg = ctx.createLinearGradient(0, 0, w, 0)
    bg.addColorStop(0, '#8d9196')
    bg.addColorStop(0.5, '#b7bbc0')
    bg.addColorStop(1, '#8a8e93')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = '#1b0d0b'
    ctx.fillRect(28, 16, 104, 30)
    centerText(ctx, '0', 112, 32, `700 22px ${GOTHIC}`, '#ff4a3a')
    ctx.fillStyle = '#3a3d41'
    ctx.beginPath()
    ctx.roundRect(56, 62, 48, 70, 8)
    ctx.fill()
    ctx.fillStyle = '#0b0c0d'
    ctx.fillRect(78, 72, 5, 50)
    centerText(ctx, '硬貨', w / 2, 144, `600 13px ${GOTHIC}`, '#222')
    ctx.fillStyle = '#3a3d41'
    ctx.fillRect(22, 162, 116, 26)
    ctx.fillStyle = '#0b0c0d'
    ctx.fillRect(30, 172, 100, 6)
    centerText(ctx, '千円札', w / 2, 200, `600 13px ${GOTHIC}`, '#222')
    ctx.fillStyle = '#2b2e32'
    ctx.beginPath()
    ctx.roundRect(36, 214, 88, 44, 10)
    ctx.fill()
    centerText(ctx, 'IC', w / 2, 236, `700 18px ${GOTHIC}`, '#7fd4ff')
    ctx.fillStyle = '#5c6066'
    ctx.fillRect(30, 270, 14, 40)
    ctx.fillStyle = '#0b0c0d'
    ctx.fillRect(66, 278, 70, 54)
    centerText(ctx, 'おつり', 101, 343, `600 11px ${GOTHIC}`, '#222')
  })

/**
 * 自販機の横の回収箱の正面。上に丸い入れ口
 */
export const binTexture = (label, color) =>
  canvasTexture(192, 384, (ctx, w, h) => {
    ctx.fillStyle = '#e7e6e0'
    ctx.fillRect(0, 0, w, h)
    stains(ctx, w, h, 4, '90, 80, 60', 0.18)
    ctx.fillStyle = '#121314'
    ctx.beginPath()
    ctx.ellipse(w / 2, 70, 46, 40, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = color
    ctx.fillRect(0, 140, w, 56)
    centerText(ctx, label, w / 2, 169, `800 30px ${GOTHIC}`, '#ffffff')
    centerText(ctx, 'ここに入れてください', w / 2, 226, `600 14px ${GOTHIC}`, '#3a3a38')
    centerText(ctx, 'ゴミは入れないでください', w / 2, 252, `600 14px ${GOTHIC}`, '#3a3a38')
  })

/**
 * 建物の名前の看板
 */
export const nameSignTexture = () =>
  canvasTexture(1024, 96, (ctx, w, h) => {
    ctx.fillStyle = '#2b2722'
    ctx.fillRect(0, 0, w, h)
    centerText(ctx, 'MAISON TSUKIMI', w / 2 - 90, h / 2 + 2, `500 54px ${MINCHO}`, '#c9ad73')
    centerText(ctx, 'メゾン月見', w - 150, h / 2 + 2, `500 40px ${MINCHO}`, '#c9ad73')
  })

/**
 * 紙を1枚、少し傾けて描く。影と、上の画びょうも付ける
 * @param draw - 紙の左上を原点にして、中身を描く関数 (ctx, w, h)
 */
const pinned = (ctx, x, y, w, h, angle, color, draw) => {
  ctx.save()
  ctx.translate(x + w / 2, y + h / 2)
  ctx.rotate(angle)
  ctx.translate(-w / 2, -h / 2)
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)'
  ctx.fillRect(4, 5, w, h)
  ctx.fillStyle = color
  ctx.fillRect(0, 0, w, h)
  const age = ctx.createLinearGradient(0, 0, w, h)
  age.addColorStop(0, 'rgba(150, 120, 60, 0.06)')
  age.addColorStop(1, 'rgba(120, 90, 40, 0.2)')
  ctx.fillStyle = age
  ctx.fillRect(0, 0, w, h)
  draw(ctx, w, h)
  ctx.fillStyle = '#b8261c'
  ctx.beginPath()
  ctx.arc(w / 2, 10, 6, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

/**
 * 左寄せで1行ずつ書く
 */
const lines = (ctx, list, x, y, gap, font, color) => {
  ctx.font = font
  ctx.fillStyle = color
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  list.forEach((line, i) => ctx.fillText(line, x, y + i * gap))
}

/**
 * 防犯カメラの画像。暗い通路に、顔の無い人が立っている。ざらつきと日時の表示つき
 */
const cctvStill = (ctx, x, y, w, h) => {
  ctx.save()
  ctx.beginPath()
  ctx.rect(x, y, w, h)
  ctx.clip()
  const bg = ctx.createLinearGradient(x, y, x, y + h)
  bg.addColorStop(0, '#3b3f3c')
  bg.addColorStop(1, '#1e201f')
  ctx.fillStyle = bg
  ctx.fillRect(x, y, w, h)
  ctx.fillStyle = 'rgba(160, 165, 155, 0.18)'
  ctx.fillRect(x, y + h * 0.72, w, h * 0.28)
  const cx = x + w * 0.54
  ctx.fillStyle = '#0c0c0d'
  ctx.beginPath()
  ctx.moveTo(cx - w * 0.2, y + h)
  ctx.quadraticCurveTo(cx - w * 0.2, y + h * 0.5, cx, y + h * 0.48)
  ctx.quadraticCurveTo(cx + w * 0.2, y + h * 0.5, cx + w * 0.2, y + h)
  ctx.fill()
  ctx.fillStyle = '#a9a39a'
  ctx.beginPath()
  ctx.ellipse(cx, y + h * 0.36, w * 0.075, h * 0.1, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#0c0c0d'
  ctx.beginPath()
  ctx.ellipse(cx, y + h * 0.3, w * 0.082, h * 0.07, 0, Math.PI, Math.PI * 2)
  ctx.fill()
  for (let i = 0; i < 2600; i++) {
    ctx.fillStyle = `rgba(255, 255, 255, ${Math.random() * 0.12})`
    ctx.fillRect(x + Math.random() * w, y + Math.random() * h, 1.5, 1.5)
  }
  for (let yy = y; yy < y + h; yy += 3) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.12)'
    ctx.fillRect(x, yy, w, 1)
  }
  ctx.font = `600 13px ${GOTHIC}`
  ctx.fillStyle = 'rgba(235, 235, 225, 0.85)'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillText('CAM 03  2026/11/09 23:41', x + 8, y + 7)
  ctx.restore()
}

/**
 * 指名手配の紙。名前も年齢も分からず、写真は防犯カメラの画像。駅の交番の前にも、同じものが貼ってある
 */
export const wantedPosterTexture = () =>
  canvasTexture(512, 724, (ctx, w, h) => {
    ctx.fillStyle = '#efece3'
    ctx.fillRect(0, 0, w, h)
    stains(ctx, w, h, 5, '150, 120, 60', 0.2)
    centerText(ctx, '指名手配', w / 2, 70, `800 78px ${GOTHIC}`, '#c01e14')
    centerText(ctx, 'この人物を探しています', w / 2, 136, `700 26px ${GOTHIC}`, '#222')
    cctvStill(ctx, 46, 168, w - 92, 300)
    centerText(ctx, '防犯カメラの画像', w / 2, 484, `500 17px ${GOTHIC}`, '#555')
    lines(
      ctx,
      [
        '氏名・年齢　不詳',
        '黒っぽい服装　身長170cm前後',
        '夜間、駅とその周辺で',
        '目撃されています',
      ],
      52,
      528,
      34,
      `700 23px ${GOTHIC}`,
      '#222',
    )
    ctx.fillStyle = '#1f3d7a'
    ctx.fillRect(0, h - 74, w, 74)
    centerText(ctx, '見かけた方は 110番 へ', w / 2, h - 37, `800 30px ${GOTHIC}`, '#ffffff')
  })

/**
 * 町内会の掲示板の板。緑のフェルトに、お知らせの紙が何枚か。右側は指名手配の紙を重ねて貼る場所
 */
export const communityBoardTexture = () =>
  canvasTexture(1024, 600, (ctx, w, h) => {
    ctx.fillStyle = '#3c5243'
    ctx.fillRect(0, 0, w, h)
    speckle(ctx, w, h, 6000, ['rgba(255, 255, 255, 0.05)', 'rgba(0, 0, 0, 0.12)'], 2)
    stains(ctx, w, h, 6, '20, 25, 20', 0.3)
    pinned(ctx, 40, 40, 300, 240, -0.02, '#f2efe6', (c, pw) => {
      centerText(c, '資源回収のお知らせ', pw / 2, 46, `800 26px ${GOTHIC}`, '#1d5a2e')
      lines(
        c,
        [
          '11月の資源回収は',
          '第3日曜日 朝8時まで',
          '新聞・雑誌・段ボールを',
          'ひもでしばって出してください',
        ],
        24,
        96,
        34,
        `600 19px ${GOTHIC}`,
        '#2a2a28',
      )
      centerText(c, '月見台三丁目 町内会', pw / 2, 222, `500 15px ${GOTHIC}`, '#555')
    })
    pinned(ctx, 52, 318, 290, 250, 0.03, '#fbf3d5', (c, pw) => {
      centerText(c, '秋の防災訓練', pw / 2, 46, `800 28px ${GOTHIC}`, '#b3401c')
      lines(
        c,
        ['11月23日 (祝) 午前10時', '集合　月見台公園', '消火器の使い方を', '体験できます'],
        26,
        100,
        34,
        `600 19px ${GOTHIC}`,
        '#2a2a28',
      )
    })
    pinned(ctx, 380, 70, 250, 330, 0.04, '#ffffff', (c, pw) => {
      centerText(c, '猫を探しています', pw / 2, 40, `800 25px ${GOTHIC}`, '#222')
      c.fillStyle = '#d8d2c6'
      c.fillRect(30, 70, pw - 60, 140)
      c.fillStyle = '#c98f4d'
      c.beginPath()
      c.ellipse(pw / 2, 160, 52, 36, 0, 0, Math.PI * 2)
      c.ellipse(pw / 2 - 30, 118, 26, 24, 0, 0, Math.PI * 2)
      c.fill()
      c.beginPath()
      c.moveTo(pw / 2 - 50, 104)
      c.lineTo(pw / 2 - 44, 84)
      c.lineTo(pw / 2 - 34, 100)
      c.moveTo(pw / 2 - 26, 98)
      c.lineTo(pw / 2 - 14, 82)
      c.lineTo(pw / 2 - 10, 102)
      c.fill()
      lines(
        c,
        ['茶トラのオス (10歳)', '11月はじめから', '帰ってきません', '見かけた方はご連絡を'],
        26,
        236,
        24,
        `600 16px ${GOTHIC}`,
        '#2a2a28',
      )
    })
  })

/**
 * 掲示板の上の名札
 */
export const boardHeaderTexture = () =>
  canvasTexture(512, 64, (ctx, w, h) => {
    ctx.fillStyle = '#e9e6dc'
    ctx.fillRect(0, 0, w, h)
    centerText(ctx, '月見台三丁目 町内会 掲示板', w / 2, h / 2 + 2, `700 30px ${GOTHIC}`, '#2a3a2e')
  })

/**
 * 白地に黒い文字の貼り紙。行ごとに書く。行が多い時は、紙に収まるように行の間を詰める
 */
export const signTexture = (lines, w = 256, h = 320) =>
  canvasTexture(w, h, (ctx) => {
    ctx.fillStyle = '#efece4'
    ctx.fillRect(0, 0, w, h)
    const gap = Math.min(52, (h - 100) / Math.max(1, lines.length - 1))
    const top = (h - gap * (lines.length - 1)) / 2
    lines.forEach((line, i) => {
      const size = i === 0 ? 44 : 22
      centerText(
        ctx,
        line,
        w / 2,
        top + i * gap,
        `700 ${size}px ${GOTHIC}`,
        i === 0 ? '#b3241c' : '#262320',
      )
    })
  })

/**
 * 部屋の壁紙。白っぽい地に、細かい凹凸がある。1枚で 0.9m 四方で、左の端が継ぎ目
 */
export const clothTexture = () =>
  canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#d8d2c5'
    ctx.fillRect(0, 0, w, h)
    speckle(ctx, w, h, 9000, ['rgba(255, 255, 255, 0.1)', 'rgba(0, 0, 0, 0.06)'], 1.5)
    stains(ctx, w, h, 3, '120, 105, 80', 0.12)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.07)'
    ctx.fillRect(0, 0, 1, h)
  })

/**
 * 部屋の廊下のフローリング。細い板が縦に並ぶ。1枚で 1.2m 四方
 */
export const flooringTexture = () =>
  canvasTexture(256, 256, (ctx, w, h) => {
    const n = 8
    const pw = w / n
    for (let i = 0; i < n; i++) {
      const tone = 0.85 + Math.random() * 0.25
      ctx.fillStyle = `rgb(${Math.round(128 * tone)}, ${Math.round(96 * tone)}, ${Math.round(66 * tone)})`
      ctx.fillRect(i * pw, 0, pw, h)
      for (let k = 0; k < 6; k++) {
        ctx.fillStyle = `rgba(60, 40, 22, ${0.08 + Math.random() * 0.1})`
        ctx.fillRect(i * pw + Math.random() * pw, 0, 1, h)
      }
      ctx.fillStyle = 'rgba(30, 20, 12, 0.55)'
      ctx.fillRect(i * pw, 0, 1, h)
      ctx.fillRect(i * pw, Math.random() * h, pw, 1)
    }
  })

/**
 * 屋上の鉄の扉。塗装が古びて、上からさびが垂れ、手の触れるところと足元が汚れている
 */
export const steelDoorTexture = () =>
  canvasTexture(256, 512, (ctx, w, h) => {
    ctx.fillStyle = '#7b857d'
    ctx.fillRect(0, 0, w, h)
    speckle(ctx, w, h, 2600, ['rgba(255, 255, 255, 0.05)', 'rgba(0, 0, 0, 0.08)'], 2)
    stains(ctx, w, h, 9, '38, 42, 38', 0.35)
    for (let i = 0; i < 10; i++) {
      const x = Math.random() * w
      const len = 40 + Math.random() * 180
      const rust = ctx.createLinearGradient(0, 0, 0, len)
      rust.addColorStop(0, 'rgba(112, 62, 28, 0.6)')
      rust.addColorStop(1, 'rgba(112, 62, 28, 0)')
      ctx.fillStyle = rust
      ctx.fillRect(x, 0, 1.5 + Math.random() * 3, len)
    }
    const hand = ctx.createRadialGradient(w * 0.88, h * 0.55, 0, w * 0.88, h * 0.55, 70)
    hand.addColorStop(0, 'rgba(25, 22, 18, 0.45)')
    hand.addColorStop(1, 'rgba(25, 22, 18, 0)')
    ctx.fillStyle = hand
    ctx.fillRect(0, 0, w, h)
    const foot = ctx.createLinearGradient(0, h * 0.82, 0, h)
    foot.addColorStop(0, 'rgba(30, 26, 20, 0)')
    foot.addColorStop(1, 'rgba(30, 26, 20, 0.6)')
    ctx.fillStyle = foot
    ctx.fillRect(0, h * 0.82, w, h * 0.18)
    for (let i = 0; i < 26; i++) {
      ctx.strokeStyle = 'rgba(20, 18, 15, 0.35)'
      ctx.lineWidth = 1 + Math.random() * 2
      const x = Math.random() * w
      const y = h * 0.86 + Math.random() * h * 0.12
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x + 6 + Math.random() * 24, y + (Math.random() - 0.5) * 6)
      ctx.stroke()
    }
    for (let i = 0; i < 46; i++) {
      ctx.fillStyle = Math.random() < 0.5 ? 'rgba(118, 66, 34, 0.75)' : 'rgba(176, 181, 170, 0.6)'
      const s = 1 + Math.random() * 4
      ctx.fillRect(
        Math.random() * w,
        h * 0.55 + Math.random() * h * 0.45,
        s,
        s * (0.5 + Math.random()),
      )
    }
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)'
    ctx.lineWidth = 6
    ctx.strokeRect(0, 0, w, h)
  })

/**
 * 屋上の扉に貼ってある注意書き。黄ばんで、上の角をテープで留めてある
 */
export const roofWarnTexture = () =>
  canvasTexture(256, 352, (ctx, w, h) => {
    ctx.fillStyle = '#e8e1cd'
    ctx.fillRect(0, 0, w, h)
    stains(ctx, w, h, 6, '150, 118, 60', 0.3)
    ctx.fillStyle = '#ad2a20'
    ctx.fillRect(20, 30, w - 40, 62)
    centerText(ctx, '危険', w / 2, 62, `700 42px ${GOTHIC}`, '#f1ebdf')
    ;['屋上への', '立ち入りを', '禁止します'].forEach((line, i) => {
      centerText(ctx, line, w / 2, 146 + i * 44, `700 28px ${GOTHIC}`, '#262320')
    })
    centerText(ctx, '管理組合', w / 2, h - 42, `500 19px ${GOTHIC}`, '#4b463f')
    ctx.fillStyle = 'rgba(214, 200, 150, 0.7)'
    ;[
      [14, 12, -0.6],
      [w - 14, 12, 0.6],
    ].forEach(([x, y, a]) => {
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(a)
      ctx.fillRect(-26, -9, 52, 18)
      ctx.restore()
    })
  })

/**
 * くもりガラス。dark は暗い部屋、lit は明かりの点いた部屋、peek はすぐ裏に人が立っている
 */
export const frostedTexture = (mode) =>
  canvasTexture(128, 160, (ctx, w, h) => {
    if (mode === 'dark') {
      ctx.fillStyle = '#1f2125'
      ctx.fillRect(0, 0, w, h)
    } else {
      const glow = ctx.createRadialGradient(w / 2, h * 0.45, 10, w / 2, h / 2, 110)
      glow.addColorStop(0, '#e2d3b0')
      glow.addColorStop(1, '#8e7f62')
      ctx.fillStyle = glow
      ctx.fillRect(0, 0, w, h)
    }
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = Math.random() < 0.5 ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)'
      ctx.beginPath()
      ctx.arc(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 0, Math.PI * 2)
      ctx.fill()
    }
    if (mode !== 'peek') return
    ctx.filter = 'blur(7px)'
    ctx.fillStyle = 'rgba(12, 10, 9, 0.92)'
    ctx.beginPath()
    ctx.ellipse(w / 2, 58, 26, 33, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillRect(w / 2 - 50, 92, 100, 80)
    ctx.fillStyle = 'rgba(30, 24, 20, 0.95)'
    ;[26, 102].forEach((x) => {
      ctx.beginPath()
      ctx.ellipse(x, 88, 10, 15, 0, 0, Math.PI * 2)
      ctx.fill()
    })
    ctx.filter = 'none'
  })

/**
 * 階段の踊り場の網入りガラス。peek が true なら、外にのっぺらぼうの顔が押し付けられている
 */
export const wireGlassTexture = (peek) =>
  canvasTexture(256, 320, (ctx, w, h) => {
    ctx.fillStyle = '#1a1f27'
    ctx.fillRect(0, 0, w, h)
    speckle(ctx, w, h, 3000, ['rgba(255, 255, 255, 0.05)', 'rgba(0, 0, 0, 0.1)'], 2)
    if (peek) {
      ctx.filter = 'blur(5px)'
      ctx.fillStyle = '#8c867c'
      ctx.beginPath()
      ctx.ellipse(w / 2, 140, 50, 64, 0.05, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#0a0a0b'
      ctx.beginPath()
      ctx.ellipse(w / 2, 104, 56, 44, 0.05, Math.PI, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#6f6a62'
      ;[54, 202].forEach((x) => {
        ctx.beginPath()
        ctx.ellipse(x, 220, 22, 32, 0, 0, Math.PI * 2)
        ctx.fill()
      })
      ctx.filter = 'none'
    }
    ctx.strokeStyle = 'rgba(150, 150, 150, 0.35)'
    ctx.lineWidth = 1
    for (let i = 0; i <= w; i += 16) {
      ctx.beginPath()
      ctx.moveTo(i, 0)
      ctx.lineTo(i, h)
      ctx.stroke()
    }
    for (let j = 0; j <= h; j += 16) {
      ctx.beginPath()
      ctx.moveTo(0, j)
      ctx.lineTo(w, j)
      ctx.stroke()
    }
  })

/**
 * 家の外壁のサイディング。横に細い目地が通る。1枚で 2m 四方
 */
export const sidingTexture = (base) =>
  canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = base
    ctx.fillRect(0, 0, w, h)
    speckle(ctx, w, h, 2500, ['rgba(255, 255, 255, 0.05)', 'rgba(0, 0, 0, 0.07)'], 1.5)
    for (let y = 0; y < h; y += 16) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.22)'
      ctx.fillRect(0, y, w, 2)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.06)'
      ctx.fillRect(0, y + 2, w, 1)
    }
    stains(ctx, w, h, 4, '40, 36, 30', 0.18)
  })

/**
 * 外壁の雨だれ。上から下へ、細い黒ずみが垂れる。背景は透明
 */
export const streakTexture = () =>
  canvasTexture(512, 256, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h)
    for (let i = 0; i < 26; i++) {
      const x = Math.random() * w
      const len = h * (0.3 + Math.random() * 0.7)
      const g = ctx.createLinearGradient(0, 0, 0, len)
      g.addColorStop(0, `rgba(38, 34, 28, ${0.25 + Math.random() * 0.3})`)
      g.addColorStop(1, 'rgba(38, 34, 28, 0)')
      ctx.fillStyle = g
      ctx.fillRect(x, 0, 2 + Math.random() * 9, len)
    }
    const top = ctx.createLinearGradient(0, 0, 0, 24)
    top.addColorStop(0, 'rgba(38, 34, 28, 0.35)')
    top.addColorStop(1, 'rgba(38, 34, 28, 0)')
    ctx.fillStyle = top
    ctx.fillRect(0, 0, w, 24)
  })

/**
 * 床の端にたまった汚れ。下の端 (壁ぎわ) が濃く、上へ行くほど薄い。背景は透明
 */
export const edgeDirtTexture = () =>
  canvasTexture(256, 64, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h)
    const g = ctx.createLinearGradient(0, h, 0, 0)
    g.addColorStop(0, 'rgba(22, 20, 16, 0.55)')
    g.addColorStop(1, 'rgba(22, 20, 16, 0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
    speckle(ctx, w, h, 600, ['rgba(15, 13, 10, 0.4)'], 2)
  })

/**
 * 天井の雨じみ。輪のように縁が濃い。背景は透明
 */
export const waterStainTexture = () =>
  canvasTexture(256, 256, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h)
    for (let i = 0; i < 4; i++) {
      const x = w / 2 + (Math.random() - 0.5) * 80
      const y = h / 2 + (Math.random() - 0.5) * 80
      const r = 40 + Math.random() * 60
      const g = ctx.createRadialGradient(x, y, r * 0.5, x, y, r)
      g.addColorStop(0, 'rgba(110, 85, 50, 0.08)')
      g.addColorStop(0.85, 'rgba(100, 72, 38, 0.35)')
      g.addColorStop(1, 'rgba(100, 72, 38, 0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
    }
  })

/**
 * ブロック塀。1枚で 0.8m 四方に、横 0.4m × 縦 0.2m のブロックが並ぶ
 */
export const blockTexture = () =>
  canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#6d6c67'
    ctx.fillRect(0, 0, w, h)
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 2; c++) {
        const tone = 0.9 + Math.random() * 0.2
        ctx.fillStyle = `rgb(${Math.round(138 * tone)}, ${Math.round(136 * tone)}, ${Math.round(128 * tone)})`
        ctx.fillRect(c * 128 + 3, r * 64 + 3, 122, 58)
      }
    }
    speckle(ctx, w, h, 3000, ['rgba(255, 255, 255, 0.06)', 'rgba(0, 0, 0, 0.12)'], 2)
    stains(ctx, w, h, 5, '40, 45, 30', 0.35)
  })

/**
 * 古いトタンの波板。縦に波が通り、ところどころさびている。1枚で 1m 四方
 */
export const corrugatedTexture = () =>
  canvasTexture(256, 256, (ctx, w, h) => {
    for (let x = 0; x < w; x += 16) {
      const g = ctx.createLinearGradient(x, 0, x + 16, 0)
      g.addColorStop(0, '#6f7471')
      g.addColorStop(0.5, '#a3a8a4')
      g.addColorStop(1, '#6f7471')
      ctx.fillStyle = g
      ctx.fillRect(x, 0, 16, h)
    }
    stains(ctx, w, h, 7, '120, 70, 35', 0.45)
    speckle(ctx, w, h, 1500, ['rgba(110, 60, 30, 0.3)', 'rgba(0, 0, 0, 0.1)'], 2)
  })

/**
 * 自転車のかごの金網。すき間は透ける
 */
export const meshTexture = () =>
  canvasTexture(64, 64, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h)
    ctx.strokeStyle = '#b8bcc0'
    ctx.lineWidth = 3
    for (let i = 0; i <= w; i += 16) {
      ctx.beginPath()
      ctx.moveTo(i, 0)
      ctx.lineTo(i, h)
      ctx.moveTo(0, i)
      ctx.lineTo(w, i)
      ctx.stroke()
    }
  })

/**
 * 2階建ての家の正面。窓とドアを描く。glow は、明かりの点いた窓と玄関の灯りだけを描いた絵
 * @param seed - 外壁の色と、どの窓に明かりが点いているかを決める番号
 */
export const houseFacade = (seed) => {
  const colors = ['#8a8274', '#6f7478', '#9a8b74', '#7a6f66']
  const lit = [seed % 3 === 0, seed % 2 === 1, seed % 4 === 2]
  const wins = [
    { x: 36, y: 214, w: 176, h: 128, lit: lit[0] },
    { x: 66, y: 56, w: 112, h: 84, lit: lit[1] },
    { x: 300, y: 56, w: 112, h: 84, lit: lit[2] },
  ]
  const door = { x: 330, y: 206, w: 72, h: 150 }
  const lamp = seed % 2 === 0

  /**
   * 窓を1つ描く。明かりが点いていればカーテン越しの暖色、消えていれば暗いガラス
   */
  const drawWindow = (ctx, win, glowOnly) => {
    if (glowOnly) {
      if (!win.lit) return
      const cx = win.x + win.w / 2
      const cy = win.y + win.h / 2
      const g = ctx.createRadialGradient(cx, cy, 4, cx, cy, win.w * 0.7)
      g.addColorStop(0, '#b98d55')
      g.addColorStop(1, '#5e4024')
      ctx.fillStyle = g
      ctx.fillRect(win.x + 6, win.y + 6, win.w - 12, win.h - 12)
      for (let x = win.x + 6; x < win.x + win.w - 6; x += 9) {
        ctx.fillStyle = 'rgba(40, 24, 8, 0.12)'
        ctx.fillRect(x, win.y + 6, 4, win.h - 12)
      }
      return
    }
    ctx.fillStyle = '#b9bbbd'
    ctx.fillRect(win.x, win.y, win.w, win.h)
    ctx.fillStyle = win.lit ? '#6b4f2c' : '#0d1013'
    ctx.fillRect(win.x + 6, win.y + 6, win.w - 12, win.h - 12)
    if (!win.lit) {
      const g = ctx.createLinearGradient(win.x, win.y, win.x + win.w, win.y + win.h)
      g.addColorStop(0, 'rgba(120, 140, 160, 0.18)')
      g.addColorStop(0.5, 'rgba(120, 140, 160, 0)')
      ctx.fillStyle = g
      ctx.fillRect(win.x + 6, win.y + 6, win.w - 12, win.h - 12)
    }
    ctx.fillStyle = '#b9bbbd'
    ctx.fillRect(win.x + win.w / 2 - 2, win.y, 4, win.h)
  }

  const map = canvasTexture(512, 372, (ctx, w, h) => {
    ctx.fillStyle = colors[seed % colors.length]
    ctx.fillRect(0, 0, w, h)
    for (let y = 0; y < h; y += 11) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)'
      ctx.fillRect(0, y, w, 2)
    }
    stains(ctx, w, h, 6, '30, 26, 22', 0.25)
    wins.forEach((win) => drawWindow(ctx, win, false))
    ctx.fillStyle = '#4a3527'
    ctx.fillRect(door.x, door.y, door.w, door.h)
    ctx.fillStyle = '#2a1f17'
    ctx.fillRect(door.x + door.w - 16, door.y + 72, 6, 22)
    ctx.fillStyle = lamp ? '#efe0b0' : '#6c6a63'
    ctx.fillRect(door.x + door.w / 2 - 8, door.y - 26, 16, 16)
    ctx.fillStyle = '#9da1a3'
    ctx.fillRect(222, 300, 70, 52)
    ctx.fillStyle = '#5d6164'
    ctx.beginPath()
    ctx.arc(250, 326, 18, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#8c8f90'
    ctx.fillRect(w - 18, 0, 8, h)
  })
  const glow = canvasTexture(512, 372, (ctx, w, h) => {
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, w, h)
    wins.forEach((win) => drawWindow(ctx, win, true))
    if (lamp) {
      ctx.fillStyle = '#d9c48c'
      ctx.fillRect(door.x + door.w / 2 - 8, door.y - 26, 16, 16)
    }
  })
  return { map, glow }
}
