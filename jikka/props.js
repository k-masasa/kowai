import * as THREE from 'three'
import { at, atScaled, box, makeBuilder, tube } from './kit.js'

// 家具と明かり。1つずつ、置いた所の真ん中を原点にして組む (下の面が y = 0、前は +z)

const LEG = 0.05
const DIAL = new THREE.CylinderGeometry(0.052, 0.052, 0.008, 20)
const RING = new THREE.TorusGeometry(0.2, 0.025, 6, 20)
const SHADE = new THREE.CylinderGeometry(0.27, 0.3, 0.05, 20)
const BULB = new THREE.SphereGeometry(0.045, 10, 8)
const KAKEJIKU = new THREE.PlaneGeometry(0.42, 1.45)

/**
 * x, y, z の点を作る
 */
const v = (x, y, z) => new THREE.Vector3(x, y, z)

/**
 * 天板と4本の脚の台を組む
 */
const buildTable = (b, m, p, s) => {
  const mat = m[p.mat ?? 'furniture']
  const { w, d, h } = s
  box(b, mat, -w / 2, w / 2, h - 0.03, h, -d / 2, d / 2)
  ;[-w / 2 + 0.04, w / 2 - 0.04 - LEG].forEach((x) => {
    ;[-d / 2 + 0.04, d / 2 - 0.04 - LEG].forEach((z) => {
      box(b, mat, x, x + LEG, 0, h - 0.03, z, z + LEG)
    })
  })
}

/**
 * 両側の板と、何段かの板の棚を組む
 */
const buildShelf = (b, m, p, s) => {
  const mat = m[p.mat ?? 'furniture']
  const { w, d, h } = s
  const n = p.n ?? 3
  box(b, mat, -w / 2, -w / 2 + 0.03, 0, h, -d / 2, d / 2)
  box(b, mat, w / 2 - 0.03, w / 2, 0, h, -d / 2, d / 2)
  for (let i = 0; i <= n; i++) {
    const y = 0.05 + ((h - 0.08) * i) / n
    box(b, mat, -w / 2, w / 2, y, y + 0.025, -d / 2, d / 2)
  }
}

/**
 * 家具の種類。size は大きさ (w 横、d 奥行き、h 高さ、y0 下の端、front 前に出る分)、build は組み方。
 * solid が false の物には、ぶつからない。fixture があれば、そこに本物の光を当てる
 */
export const PROP_TYPES = {
  table: {
    label: '台',
    size: (p) => ({ w: p.w ?? 0.8, d: p.d ?? 0.8, h: p.h ?? 0.7 }),
    build: buildTable,
  },
  shelf: {
    label: '棚',
    size: (p) => ({ w: p.w ?? 1.0, d: p.d ?? 0.35, h: p.h ?? 1.2 }),
    build: buildShelf,
  },
  kotatsu: {
    label: 'こたつ',
    size: () => ({ w: 1.3, d: 1.3, h: 0.39 }),
    build: (b, m) => {
      box(b, m.kotatsu, -0.65, 0.65, 0, 0.36, -0.65, 0.65)
      box(b, m.furniture, -0.5, 0.5, 0.36, 0.39, -0.5, 0.5)
    },
  },
  tv: {
    label: 'テレビ',
    size: () => ({ w: 1.0, d: 0.52, h: 0.98 }),
    build: (b, m) => {
      box(b, m.darkWood, -0.5, 0.5, 0, 0.35, -0.26, 0.26)
      box(b, m.tv, -0.4, 0.4, 0.35, 0.98, -0.24, 0.21)
      box(b, m.screen, -0.22, 0.32, 0.43, 0.9, 0.21, 0.225)
    },
  },
  sink: {
    label: '流し台',
    size: (p) => ({ w: p.w ?? 1.1, d: 0.6, h: 0.86 }),
    build: (b, m, p, s) => {
      const w = s.w
      box(b, m.cream, -w / 2, w / 2, 0, 0.82, -0.3, 0.3)
      box(b, m.stainless, -w / 2 - 0.02, w / 2 + 0.02, 0.82, 0.86, -0.32, 0.32)
      box(b, m.screen, -0.3, 0.3, 0.861, 0.865, -0.21, 0.17)
      tube(b, m.stainless, v(0, 0.86, -0.25), v(0, 1.12, -0.25), 0.012)
      tube(b, m.stainless, v(0, 1.12, -0.25), v(0, 1.08, -0.05), 0.01)
    },
  },
  stove: {
    label: 'コンロ',
    size: () => ({ w: 0.6, d: 0.6, h: 0.8 }),
    build: (b, m) => {
      box(b, m.cream, -0.3, 0.3, 0, 0.7, -0.3, 0.3)
      box(b, m.stove, -0.25, 0.25, 0.7, 0.8, -0.23, 0.23)
    },
  },
  fridge: {
    label: '冷蔵庫',
    size: () => ({ w: 0.65, d: 0.65, h: 1.55 }),
    build: (b, m) => {
      box(b, m.white, -0.325, 0.325, 0, 1.55, -0.325, 0.325)
      box(b, m.gray, -0.3, 0.3, 1.05, 1.06, 0.325, 0.33)
    },
  },
  cupboard: {
    label: '食器棚',
    size: (p) => ({ w: p.w ?? 1.5, d: 0.43, h: 1.8 }),
    build: (b, m, p, s) => {
      const { w, d } = s
      box(b, m.furniture, -w / 2, w / 2, 0, 0.85, -d / 2, d / 2)
      box(b, m.furniture, -w / 2, -w / 2 + 0.03, 0.85, 1.8, -d / 2, d / 2 - 0.1)
      box(b, m.furniture, w / 2 - 0.03, w / 2, 0.85, 1.8, -d / 2, d / 2 - 0.1)
      box(b, m.furniture, -w / 2, w / 2, 1.77, 1.8, -d / 2, d / 2 - 0.1)
      box(b, m.furniture, -w / 2, w / 2, 1.3, 1.32, -d / 2, d / 2 - 0.12)
      box(b, m.furniture, -w / 2, w / 2, 0.85, 1.8, -d / 2, -d / 2 + 0.02)
      box(b, m.glass, -w / 2 + 0.03, w / 2 - 0.03, 0.85, 1.77, d / 2 - 0.106, d / 2 - 0.1)
      box(b, m.white, -0.55, -0.2, 0.85, 0.95, -0.105, 0.015)
      box(b, m.white, 0.15, 0.55, 1.32, 1.4, -0.105, 0.015)
    },
  },
  wallShelf: {
    label: '一枚棚',
    size: (p) => ({ w: p.w ?? 2.0, d: 0.33, h: 0.23, y0: -0.2 }),
    build: (b, m, p, s) => {
      const { w, d } = s
      box(b, m.furniture, -w / 2, w / 2, 0, 0.03, -d / 2, d / 2)
      ;[-w / 2 + 0.3, 0, w / 2 - 0.25].forEach((x) => {
        box(b, m.furniture, x - 0.02, x + 0.02, -0.2, 0, -d / 2, -d / 2 + 0.2)
      })
    },
  },
  phone: {
    label: '電話',
    size: () => ({ w: 0.24, d: 0.2, h: 0.16 }),
    solid: false,
    build: (b, m, p) => {
      const drop = p.drop ?? 1.08
      box(b, m.phone, -0.11, 0.11, 0, 0.08, -0.1, 0.1)
      box(b, m.phone, -0.09, 0.09, 0.08, 0.11, -0.09, 0.03)
      b.add(DIAL, m.cream, at(0, 0.092, 0.06, 0.6))
      b.add(DIAL, m.phone, atScaled(0, 0.095, 0.062, 0.6, 0, 0, 0.35, 1, 0.35))
      box(b, m.phone, -0.1, 0.1, 0.115, 0.14, -0.05, -0.01)
      box(b, m.phone, -0.12, -0.06, 0.105, 0.155, -0.07, 0.01)
      box(b, m.phone, 0.06, 0.12, 0.105, 0.155, -0.07, 0.01)
      tube(b, m.cord, v(-0.06, 0.03, -0.1), v(-0.06, 0.03, -0.14), 0.004)
      tube(b, m.cord, v(-0.06, 0.03, -0.14), v(-0.06, -drop, -0.14), 0.004)
    },
  },
  getabako: {
    label: '下駄箱',
    size: (p) => ({ w: p.w ?? 1.08, d: p.d ?? 0.32, h: p.h ?? 0.87 }),
    build: (b, m, p, s) => {
      const { w, d, h } = s
      box(b, m.furniture, -w / 2, w / 2, 0, h, -d / 2, d / 2)
      box(b, m.darkWood, -0.005, 0.005, 0.05, h - 0.05, d / 2, d / 2 + 0.004)
    },
  },
  washbasin: {
    label: '洗面台',
    size: () => ({ w: 1.0, d: 0.44, h: 0.8 }),
    build: (b, m) => {
      box(b, m.white, -0.5, 0.5, 0, 0.8, -0.22, 0.22)
      box(b, m.screen, -0.25, 0.25, 0.801, 0.805, -0.13, 0.15)
      tube(b, m.stainless, v(0, 0.8, -0.18), v(0, 1.0, -0.18), 0.01)
      tube(b, m.stainless, v(0, 1.0, -0.18), v(0, 0.97, -0.03), 0.008)
    },
  },
  mirror: {
    label: '鏡',
    size: () => ({ w: 0.7, d: 0.006, h: 0.7 }),
    solid: false,
    build: (b, m) => {
      box(b, m.mirror, -0.35, 0.35, 0, 0.7, -0.003, 0.003)
    },
  },
  butsudan: {
    label: '仏壇',
    size: () => ({ w: 1.38, d: 0.66, h: 1.7, front: 0.5 }),
    build: (b, m, p, s) => {
      const { w, d } = s
      box(b, m.lacquer, -w / 2, w / 2, 0, 0.42, -d / 2, d / 2)
      box(b, m.lacquer, -w / 2, w / 2, 0.42, 1.7, -d / 2, -d / 2 + 0.04)
      box(b, m.lacquer, -w / 2, -w / 2 + 0.04, 0.42, 1.7, -d / 2, d / 2)
      box(b, m.lacquer, w / 2 - 0.04, w / 2, 0.42, 1.7, -d / 2, d / 2)
      box(b, m.lacquer, -w / 2, w / 2, 1.66, 1.7, -d / 2, d / 2)
      box(b, m.gold, -w / 2 + 0.06, w / 2 - 0.06, 0.47, 1.62, -d / 2 + 0.04, -d / 2 + 0.07)
      box(b, m.gold, -w / 2 + 0.04, w / 2 - 0.04, 0.85, 0.89, -d / 2 + 0.04, d / 2 - 0.08)
      box(b, m.lacquer, -w / 2, -w / 2 + 0.025, 0.45, 1.65, d / 2, d / 2 + 0.5)
      box(b, m.lacquer, w / 2 - 0.025, w / 2, 0.45, 1.65, d / 2, d / 2 + 0.5)
    },
  },
  kakejiku: {
    label: '掛け軸',
    size: () => ({ w: 0.42, d: 0.02, h: 1.45 }),
    solid: false,
    build: (b, m) => {
      b.add(KAKEJIKU, m.kakejiku, at(0, 0.725, 0))
    },
  },
  cardboard: {
    label: '段ボール箱',
    size: (p) => ({ w: p.w ?? 0.5, d: p.d ?? 0.4, h: p.h ?? 0.35 }),
    build: (b, m, p, s) => {
      const { w, d, h } = s
      box(b, m.cardboard, -w / 2, w / 2, 0, h, -d / 2, d / 2)
    },
  },
  chest: {
    label: 'たんす',
    size: (p) => ({ w: p.w ?? 1.0, d: p.d ?? 0.45, h: p.h ?? 1.1 }),
    build: (b, m, p, s) => {
      const { w, d, h } = s
      box(b, m.furniture, -w / 2, w / 2, 0, h, -d / 2, d / 2)
      ;[0.3, 0.55, 0.8].forEach((k) => {
        box(
          b,
          m.darkWood,
          -w / 2 + 0.03,
          w / 2 - 0.03,
          h * k - 0.006,
          h * k + 0.006,
          d / 2,
          d / 2 + 0.005,
        )
      })
    },
  },
  block: {
    label: '箱',
    size: (p) => ({ w: p.w ?? 0.5, d: p.d ?? 0.5, h: p.h ?? 0.5 }),
    build: (b, m, p, s) => {
      const { w, d, h } = s
      box(b, m[p.mat ?? 'furniture'], -w / 2, w / 2, 0, h, -d / 2, d / 2)
    },
  },
  washer: {
    label: '洗濯機',
    size: () => ({ w: 0.85, d: 0.46, h: 0.93 }),
    build: (b, m) => {
      box(b, m.white, -0.425, 0.425, 0, 0.9, -0.23, 0.23)
      box(b, m.gray, -0.375, -0.015, 0.9, 0.925, -0.17, 0.17)
      box(b, m.gray, 0.025, 0.375, 0.9, 0.925, -0.17, 0.17)
    },
  },
  toilet: {
    label: 'トイレ',
    size: () => ({ w: 0.36, d: 0.62, h: 0.07 }),
    solid: false,
    build: (b, m) => {
      box(b, m.white, -0.18, 0.18, 0, 0.07, -0.31, 0.31)
      box(b, m.black, -0.11, 0.11, 0.071, 0.074, -0.21, 0.17)
    },
  },
  lamp: {
    label: '蛍光灯',
    size: () => ({ w: 0.6, d: 0.6, h: 0.55, y0: -0.55 }),
    solid: false,
    fixture: { y: -0.57, color: 0xf1f4ff, power: 3.2, dist: 7 },
    build: (b, m) => {
      b.add(SHADE, m.lampShade, at(0, -0.4, 0))
      b.add(RING, m.lampGlow, at(0, -0.45, 0, Math.PI / 2))
      box(b, m.cord, -0.006, 0.006, -0.38, 0, -0.006, 0.006)
    },
  },
  bulb: {
    label: '電球',
    size: () => ({ w: 0.15, d: 0.15, h: 0.42, y0: -0.42 }),
    solid: false,
    fixture: { y: -0.41, color: 0xffd9a6, power: 1.6, dist: 5.5 },
    build: (b, m) => {
      b.add(BULB, m.bulbGlow, at(0, -0.35, 0))
      box(b, m.cord, -0.006, 0.006, -0.31, 0, -0.006, 0.006)
    },
  },
}

/**
 * 家具の大きさ。y0 (下の端) と front (前に出る分) が無ければ 0
 */
export const propSize = (p) => {
  const s = PROP_TYPES[p.type].size(p)
  return { y0: 0, front: 0, ...s }
}

/**
 * 家具を、まとめて組み直せる入れ物を作る。build に家具の並びを渡すと、前の家具を捨てて組み直す
 */
export const createProps = (scene, mats) => {
  const root = new THREE.Group()
  scene.add(root)
  const corners = [
    new THREE.Vector3(),
    new THREE.Vector3(),
    new THREE.Vector3(),
    new THREE.Vector3(),
  ]

  /**
   * 前に組んだ家具の形を捨てる (マテリアルは使い回すので捨てない)
   */
  const clear = () => {
    root.children.slice().forEach((g) => {
      g.traverse((o) => {
        if (o.geometry) {
          o.geometry.dispose()
        }
      })
      root.remove(g)
    })
  }

  /**
   * 家具を1つ組む。ぶつかる線と、光を当てる場所も返す
   */
  const one = (p) => {
    const type = PROP_TYPES[p.type]
    const s = propSize(p)
    const group = new THREE.Group()
    const b = makeBuilder()
    type.build(b, mats, p, s)
    b.build(group)
    group.position.set(p.x, p.y, p.z)
    group.rotation.y = THREE.MathUtils.degToRad(p.rot ?? 0)
    group.updateMatrixWorld(true)
    root.add(group)
    const item = { p, group, size: s, walls: [], fixture: null }
    if (type.solid !== false && p.solid !== false) {
      const [x0, x1, z0, z1] = [-s.w / 2, s.w / 2, -s.d / 2, s.d / 2 + s.front]
      corners[0].set(x0, 0, z0)
      corners[1].set(x1, 0, z0)
      corners[2].set(x1, 0, z1)
      corners[3].set(x0, 0, z1)
      const pts = corners.map((c) => c.clone().applyMatrix4(group.matrixWorld))
      const y0 = p.y + s.y0
      const y1 = y0 + s.h
      pts.forEach((a, i) => {
        const c = pts[(i + 1) % 4]
        item.walls.push({ ax: a.x, az: a.z, bx: c.x, bz: c.z, y0, y1 })
      })
    }
    if (type.fixture) {
      item.fixture = {
        pos: new THREE.Vector3(p.x, p.y + type.fixture.y, p.z),
        color: new THREE.Color(type.fixture.color),
        power: type.fixture.power,
        dist: type.fixture.dist,
      }
    }
    return item
  }

  /**
   * 家具の並びから、全部組み直す
   */
  const build = (list) => {
    clear()
    const items = list.filter((p) => PROP_TYPES[p.type]).map(one)
    return {
      items,
      walls: items.flatMap((it) => it.walls),
      fixtures: items.filter((it) => it.fixture).map((it) => it.fixture),
    }
  }

  return { build }
}
