import * as THREE from 'three'

// 床・壁・屋根・地面などの絵。canvas で描く

/**
 * 決まった種から、毎回同じ並びの乱数を作る (木や遠くの家の置き場所を、開くたびに変えないため)
 */
export const seeded = (seed) => {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

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
 * a から b のあいだの乱数
 */
const rand = (a, b) => a + Math.random() * (b - a)

/**
 * 色を少し明るくしたり暗くしたりして、rgb() の文字にする
 * @param rgb - [r, g, b]
 * @param k - かける割合。1 でそのまま
 */
const shade = (rgb, k) => `rgb(${rgb.map((c) => Math.round(Math.min(255, c * k))).join(', ')})`

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
 * 畳。1.82 m 四方に、縦長の畳 (0.91 x 1.82 m) を2枚並べる。縁は長い辺にだけある
 */
export const tatamiTexture = () =>
  canvasTexture(512, 512, (ctx, w, h) => {
    for (let i = 0; i < 2; i++) {
      const x0 = i * 256
      ctx.fillStyle = shade([194, 182, 126], rand(0.95, 1.03))
      ctx.fillRect(x0, 0, 256, h)
      for (let y = 0; y < h; y += 3) {
        ctx.fillStyle = y % 6 === 0 ? 'rgba(96, 84, 40, 0.16)' : 'rgba(255, 250, 215, 0.10)'
        ctx.fillRect(x0 + 9, y, 238, 1.5)
      }
      ctx.fillStyle = '#2e2b22'
      ctx.fillRect(x0, 0, 10, h)
      ctx.fillRect(x0 + 246, 0, 10, h)
      ctx.fillStyle = 'rgba(70, 60, 30, 0.45)'
      ctx.fillRect(x0, 0, 256, 2)
    }
    stains(ctx, w, h, 8, '130, 110, 60', 0.12)
  })

/**
 * 板の床。細い板が縦に並び、継ぎ目は板ごとにずれる
 * @param rgb - 板の色 [r, g, b]
 */
export const boardTexture = (rgb) =>
  canvasTexture(512, 512, (ctx, w, h) => {
    const n = 16
    const bw = w / n
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = shade(rgb, rand(0.82, 1.1))
      ctx.fillRect(i * bw, 0, bw, h)
      for (let k = 0; k < 7; k++) {
        ctx.fillStyle = `rgba(60, 38, 20, ${rand(0.05, 0.16)})`
        ctx.fillRect(i * bw + rand(2, bw - 3), 0, rand(0.6, 1.6), h)
      }
      ctx.fillStyle = 'rgba(40, 26, 14, 0.55)'
      ctx.fillRect(i * bw, 0, 1.5, h)
      ctx.fillRect(i * bw, rand(0, h), bw, 1.5)
    }
  })

/**
 * 竿縁天井。明るい板が横に並び、細い竿縁が 45 cm おきに渡る
 */
export const ceilingTexture = () =>
  canvasTexture(512, 512, (ctx, w, h) => {
    const n = 6
    const bh = h / n
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = shade([196, 170, 128], rand(0.9, 1.06))
      ctx.fillRect(0, i * bh, w, bh)
      for (let k = 0; k < 6; k++) {
        ctx.fillStyle = `rgba(120, 84, 48, ${rand(0.05, 0.14)})`
        ctx.fillRect(0, i * bh + rand(2, bh - 2), w, rand(0.5, 1.5))
      }
      ctx.fillStyle = 'rgba(80, 56, 32, 0.4)'
      ctx.fillRect(0, i * bh, w, 1)
    }
    for (let x = 0; x < w; x += 128) {
      ctx.fillStyle = '#6a4a2c'
      ctx.fillRect(x, 0, 9, h)
    }
  })

/**
 * 土壁 (砂のような、ざらっとした壁)
 * @param rgb - 壁の色 [r, g, b]
 */
export const plasterTexture = (rgb) =>
  canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = shade(rgb, 1)
    ctx.fillRect(0, 0, w, h)
    speckle(ctx, w, h, 2600, [shade(rgb, 0.86), shade(rgb, 1.08), shade(rgb, 0.93)], 1.6)
    stains(ctx, w, h, 5, '120, 100, 70', 0.08)
  })

/**
 * ふすま1枚。うすい雲の模様の紙に、黒い縁と引手
 */
export const fusumaTexture = () =>
  canvasTexture(256, 512, (ctx, w, h) => {
    ctx.fillStyle = '#e6dcc4'
    ctx.fillRect(0, 0, w, h)
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = `rgba(190, 170, 120, ${rand(0.05, 0.12)})`
      ctx.beginPath()
      ctx.ellipse(rand(0, w), rand(0, h), rand(10, 30), rand(3, 7), 0, 0, Math.PI * 2)
      ctx.fill()
    }
    speckle(ctx, w, h, 900, ['rgba(150, 130, 90, 0.25)', 'rgba(255, 255, 240, 0.3)'], 1.5)
    ctx.strokeStyle = '#1c1915'
    ctx.lineWidth = 10
    ctx.strokeRect(5, 5, w - 10, h - 10)
    ctx.fillStyle = '#2a241c'
    ctx.beginPath()
    ctx.arc(w - 36, h * 0.52, 11, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#9c8148'
    ctx.beginPath()
    ctx.arc(w - 36, h * 0.52, 6, 0, Math.PI * 2)
    ctx.fill()
  })

/**
 * 障子1枚。下に腰板、上は白い紙に組子
 */
export const shojiTexture = () =>
  canvasTexture(256, 512, (ctx, w, h) => {
    const koshi = h * 0.17
    const paper = h - koshi
    ctx.fillStyle = '#f2eee2'
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = '#b08858'
    ctx.fillRect(0, paper, w, koshi)
    for (let k = 0; k < 12; k++) {
      ctx.fillStyle = `rgba(70, 44, 20, ${rand(0.06, 0.16)})`
      ctx.fillRect(0, paper + rand(4, koshi - 4), w, 1)
    }
    ctx.fillStyle = '#c6a274'
    for (let i = 1; i < 4; i++) {
      ctx.fillRect((i * w) / 4 - 2, 0, 4, paper)
    }
    for (let j = 1; j < 9; j++) {
      ctx.fillRect(0, (j * paper) / 9 - 2, w, 4)
    }
    ctx.strokeStyle = '#9a764c'
    ctx.lineWidth = 12
    ctx.strokeRect(6, 6, w - 12, h - 12)
  })

/**
 * 下見板 (横に重ねて張った、焦げ茶の板)。91 cm おきに、押縁の縦の木
 */
export const sidingTexture = () =>
  canvasTexture(512, 512, (ctx, w, h) => {
    const n = 9
    const bh = h / n
    for (let i = 0; i < n; i++) {
      const y = i * bh
      ctx.fillStyle = shade([84, 62, 44], rand(0.85, 1.12))
      ctx.fillRect(0, y, w, bh)
      for (let k = 0; k < 10; k++) {
        ctx.fillStyle = `rgba(30, 20, 12, ${rand(0.06, 0.2)})`
        ctx.fillRect(0, y + rand(2, bh - 2), w, rand(0.5, 1.5))
      }
      const g = ctx.createLinearGradient(0, y + bh - 8, 0, y + bh)
      g.addColorStop(0, 'rgba(0, 0, 0, 0)')
      g.addColorStop(1, 'rgba(0, 0, 0, 0.55)')
      ctx.fillStyle = g
      ctx.fillRect(0, y + bh - 8, w, 8)
    }
    for (let x = 0; x < w; x += 256) {
      ctx.fillStyle = '#3a2a1c'
      ctx.fillRect(x + 2, 0, 14, h)
    }
    stains(ctx, w, h, 6, '20, 15, 10', 0.2)
  })

/**
 * 小屋の板壁 (縦に張った、雨で白っぽくなった板)
 */
export const shedBoardTexture = () =>
  canvasTexture(512, 512, (ctx, w, h) => {
    const n = 8
    const bw = w / n
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = shade([118, 104, 88], rand(0.8, 1.12))
      ctx.fillRect(i * bw, 0, bw, h)
      for (let k = 0; k < 8; k++) {
        ctx.fillStyle = `rgba(40, 32, 24, ${rand(0.06, 0.2)})`
        ctx.fillRect(i * bw + rand(2, bw - 2), 0, rand(0.6, 1.5), h)
      }
      ctx.fillStyle = 'rgba(20, 16, 12, 0.6)'
      ctx.fillRect(i * bw, 0, 3, h)
    }
    stains(ctx, w, h, 10, '50, 45, 35', 0.3)
  })

/**
 * コンクリートや石の、灰色のざらっとした面
 * @param rgb - 色 [r, g, b]
 */
export const concreteTexture = (rgb) =>
  canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = shade(rgb, 1)
    ctx.fillRect(0, 0, w, h)
    speckle(ctx, w, h, 1800, [shade(rgb, 0.8), shade(rgb, 1.1), shade(rgb, 0.92)], 2)
    stains(ctx, w, h, 7, '70, 70, 60', 0.14)
  })

/**
 * 波板のトタン。縦の山と谷に、さびの筋
 * @param rgb - 塗った色 [r, g, b]
 * @param rust - さびの多さ。0 から 1
 */
export const corrugatedTexture = (rgb, rust) =>
  canvasTexture(512, 512, (ctx, w, h) => {
    const pitch = w / 24
    for (let x = 0; x < w; x += pitch) {
      const g = ctx.createLinearGradient(x, 0, x + pitch, 0)
      g.addColorStop(0, shade(rgb, 0.78))
      g.addColorStop(0.5, shade(rgb, 1.08))
      g.addColorStop(1, shade(rgb, 0.78))
      ctx.fillStyle = g
      ctx.fillRect(x, 0, pitch + 1, h)
    }
    for (let i = 0; i < 26 * rust; i++) {
      const y = rand(0, h)
      const len = rand(20, 160)
      const g = ctx.createLinearGradient(0, y, 0, y + len)
      g.addColorStop(0, 'rgba(130, 70, 30, 0.55)')
      g.addColorStop(1, 'rgba(130, 70, 30, 0)')
      ctx.fillStyle = g
      ctx.fillRect(rand(0, w), y, rand(2, 7), len)
    }
    stains(ctx, w, h, Math.round(10 * rust), '120, 66, 30', 0.35)
  })

/**
 * 瓦棒葺きのトタン屋根。45 cm おきに、縦の棒が通る
 * @param rgb - 塗った色 [r, g, b]
 */
export const roofTexture = (rgb) =>
  canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = shade(rgb, 1)
    ctx.fillRect(0, 0, w, h)
    speckle(ctx, w, h, 1500, [shade(rgb, 0.9), shade(rgb, 1.08)], 2)
    for (let x = 0; x < w; x += 128) {
      ctx.fillStyle = shade(rgb, 1.25)
      ctx.fillRect(x, 0, 5, h)
      ctx.fillStyle = shade(rgb, 0.6)
      ctx.fillRect(x + 5, 0, 7, h)
    }
    stains(ctx, w, h, 8, '110, 60, 30', 0.25)
  })

/**
 * 草の生えた地面
 */
export const grassTexture = () =>
  canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#6f7a45'
    ctx.fillRect(0, 0, w, h)
    stains(ctx, w, h, 14, '150, 140, 80', 0.35)
    stains(ctx, w, h, 10, '50, 70, 30', 0.35)
    const colors = ['#56632f', '#8a9152', '#a39c62', '#4c5a2a']
    ctx.lineWidth = 1
    for (let i = 0; i < 7000; i++) {
      const x = rand(0, w)
      const y = rand(0, h)
      ctx.strokeStyle = colors[i % colors.length]
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x + rand(-2, 2), y - rand(3, 8))
      ctx.stroke()
    }
  })

/**
 * 踏み固めた土
 */
export const dirtTexture = () =>
  canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#8a7a62'
    ctx.fillRect(0, 0, w, h)
    stains(ctx, w, h, 16, '60, 50, 38', 0.35)
    stains(ctx, w, h, 10, '170, 158, 130', 0.3)
    speckle(ctx, w, h, 4000, ['#6e604c', '#a39478', '#5a4e3e', '#b8ab90'], 2.5)
  })

/**
 * 畑の、耕した黒っぽい土
 */
export const soilTexture = () =>
  canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#4e3d2c'
    ctx.fillRect(0, 0, w, h)
    stains(ctx, w, h, 8, '30, 22, 14', 0.4)
    speckle(ctx, w, h, 3000, ['#3a2c1e', '#665240', '#2c2116', '#7a644c'], 3)
  })

/**
 * 砂利
 */
export const gravelTexture = () =>
  canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#8c8880'
    ctx.fillRect(0, 0, w, h)
    for (let i = 0; i < 1400; i++) {
      ctx.fillStyle = shade([150, 146, 138], rand(0.6, 1.2))
      ctx.beginPath()
      ctx.ellipse(rand(0, w), rand(0, h), rand(1.5, 4), rand(1.2, 3), rand(0, 3), 0, Math.PI * 2)
      ctx.fill()
    }
  })

/**
 * 舗装した道
 */
export const asphaltTexture = () =>
  canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#4a4a48'
    ctx.fillRect(0, 0, w, h)
    speckle(ctx, w, h, 9000, ['#3a3a38', '#5e5d59', '#6c6a64', '#2e2e2c'], 2)
    stains(ctx, w, h, 12, '30, 30, 28', 0.3)
    stains(ctx, w, h, 8, '120, 116, 108', 0.2)
  })

/**
 * 稲を刈ったあとの田んぼ。株が列になって残る
 */
export const paddyTexture = () =>
  canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#8b7a58'
    ctx.fillRect(0, 0, w, h)
    stains(ctx, w, h, 16, '70, 58, 40', 0.4)
    stains(ctx, w, h, 10, '150, 136, 100', 0.3)
    const row = w / 20
    for (let x = row / 2; x < w; x += row) {
      for (let y = 0; y < h; y += row / 2) {
        ctx.fillStyle = `rgba(${rand(150, 190)}, ${rand(135, 165)}, ${rand(90, 110)}, 0.85)`
        ctx.fillRect(x + rand(-1, 1), y + rand(-1, 1), rand(2, 4), rand(2, 4))
      }
    }
    speckle(ctx, w, h, 1500, ['rgba(60, 50, 35, 0.5)', 'rgba(110, 120, 70, 0.4)'], 2)
  })

/**
 * コンクリートブロックの壁 (1個 40 x 20 cm)
 */
export const blockTexture = () =>
  canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#8f8c86'
    ctx.fillRect(0, 0, w, h)
    for (let y = 0; y < h; y += 64) {
      const off = (y / 64) % 2 ? 64 : 0
      for (let x = -off; x < w; x += 128) {
        ctx.fillStyle = shade([160, 157, 150], rand(0.9, 1.05))
        ctx.fillRect(x + 3, y + 3, 122, 58)
      }
    }
    speckle(ctx, w, h, 2500, ['rgba(80, 80, 75, 0.4)', 'rgba(200, 200, 195, 0.3)'], 2)
    stains(ctx, w, h, 8, '60, 60, 50', 0.2)
  })

/**
 * ふろ場の、小さい四角のタイル
 */
export const bathTileTexture = () =>
  canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#8f9a9a'
    ctx.fillRect(0, 0, w, h)
    const s = w / 20
    for (let y = 0; y < h; y += s) {
      for (let x = 0; x < w; x += s) {
        ctx.fillStyle = shade([176, 196, 198], rand(0.92, 1.05))
        ctx.fillRect(x + 1.5, y + 1.5, s - 3, s - 3)
      }
    }
    stains(ctx, w, h, 6, '90, 80, 60', 0.15)
  })

/**
 * 積んだまきの切り口
 */
export const logEndTexture = () =>
  canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#3a2a1c'
    ctx.fillRect(0, 0, w, h)
    for (let i = 0; i < 40; i++) {
      const x = rand(0, w)
      const y = rand(0, h)
      const r = rand(10, 22)
      ctx.fillStyle = shade([186, 150, 104], rand(0.8, 1.1))
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = 'rgba(120, 84, 48, 0.6)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(x, y, r * 0.55, 0, Math.PI * 2)
      ctx.stroke()
    }
  })

/**
 * 掛け軸。墨で描いた山と月
 */
export const kakejikuTexture = () =>
  canvasTexture(128, 512, (ctx, w, h) => {
    ctx.fillStyle = '#4a4636'
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = '#ebe3cf'
    ctx.fillRect(16, 70, w - 32, h - 150)
    stains(ctx, w, h, 6, '160, 140, 100', 0.2)
    ctx.fillStyle = 'rgba(40, 36, 30, 0.7)'
    ctx.beginPath()
    ctx.moveTo(16, 330)
    ctx.quadraticCurveTo(40, 240, 62, 270)
    ctx.quadraticCurveTo(80, 220, 112, 300)
    ctx.lineTo(112, 362)
    ctx.lineTo(16, 362)
    ctx.fill()
    ctx.fillStyle = 'rgba(40, 36, 30, 0.35)'
    ctx.beginPath()
    ctx.moveTo(16, 300)
    ctx.quadraticCurveTo(52, 200, 88, 250)
    ctx.lineTo(112, 230)
    ctx.lineTo(112, 300)
    ctx.fill()
    ctx.strokeStyle = 'rgba(40, 36, 30, 0.55)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(84, 140, 13, 0, Math.PI * 2)
    ctx.stroke()
    ctx.fillStyle = '#2a1e14'
    ctx.fillRect(0, h - 14, w, 14)
  })

/**
 * 空。上は青く、地平線のあたりは白っぽい
 */
export const skyTexture = () =>
  canvasTexture(64, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h)
    g.addColorStop(0, '#7f99b5')
    g.addColorStop(0.4, '#b4c3d1')
    g.addColorStop(0.5, '#d3d9de')
    g.addColorStop(1, '#c4cace')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
  })
