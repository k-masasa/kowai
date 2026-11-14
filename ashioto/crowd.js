import * as THREE from 'three'
import { createPerson } from './people.js'

// 町や電車にいる、名前の無い人たち。決まった人数を作っておき、使い回す。
// 人ごとに、置く (立つ / 座る) と、道すじに沿って歩かせる、を受け持つ。
// 座標は、その人を入れた入れ物 (parent) の中の座標。電車の乗客は電車の中に入れるので、電車と一緒に動く

/**
 * 人の群れを作る
 * @param count - 作っておく人数
 */
export const createCrowd = (count) => {
  const people = Array.from({ length: count }, (_, k) => {
    const p = createPerson({ shadow: false })
    p.group.visible = false
    return {
      k,
      p,
      used: false,
      tag: '',
      path: null,
      seg: 0,
      along: 0,
      phase: 0,
      speed: 1.2,
      wait: 0,
      done: null,
    }
  })

  /**
   * 空いている人を1人借りる。tag は、あとで探すための印。空いている人がいなければ null
   */
  const take = (tag = '') => {
    const m = people.find((x) => !x.used)
    if (!m) return null
    m.used = true
    m.tag = tag
    m.path = null
    return m
  }

  /**
   * 人を返す。見えなくして、入れ物から外す
   */
  const release = (m) => {
    m.used = false
    m.tag = ''
    m.path = null
    m.p.blank(false)
    m.p.group.visible = false
    m.p.group.removeFromParent()
  }

  /**
   * 借りている人を全員返す
   */
  const releaseAll = () => {
    people.filter((m) => m.used).forEach(release)
  }

  /**
   * 人を、入れ物の中のある場所に置く
   * @param pose - 'stand' (立つ) か 'sit' (座る)。座る時の y は、座面の高さ - 0.83
   * @param seed - 上着の色と、スマホとかばんのどちらを持つか
   * @param items - スマホかかばんを持たせるか
   */
  const put = (m, parent, x, y, z, rotY, pose = 'stand', seed = m.k, items = true) => {
    m.p.dress(seed, false, items)
    parent.add(m.p.group)
    m.p.group.position.set(x, y, z)
    m.p.group.rotation.set(0, rotY, 0)
    if (pose === 'sit') m.p.sit()
    m.p.group.visible = true
  }

  /**
   * 道すじに沿って歩かせる。今いる場所から、points (入れ物の中の座標の点) を順にたどる。
   * 座っていれば立ち上がる。wait 秒待ってから歩き出し、着いたら done を呼ぶ
   */
  const walk = (m, points, { speed = 1.2, wait = 0, done = null } = {}) => {
    m.p.stand()
    m.path = [m.p.group.position.clone(), ...points]
    m.seg = 0
    m.along = 0
    m.speed = speed
    m.wait = wait
    m.done = done
  }

  /**
   * 歩いている途中の人を、すぐに着いたことにする
   */
  const finish = (m) => {
    if (!m.path) return
    m.p.group.position.copy(m.path[m.path.length - 1])
    m.path = null
    m.p.stand()
    if (m.done) m.done(m)
  }

  /**
   * 歩いている人の数 (tag を渡すと、その印の人だけ)
   */
  const walking = (tag = null) =>
    people.filter((m) => m.used && m.path && (tag === null || m.tag === tag)).length

  /**
   * 歩いている人を、1フレーム分進める
   */
  const update = (dt) => {
    people.forEach((m) => {
      if (!m.used || !m.path) return
      if (m.wait > 0) {
        m.wait -= dt
        return
      }
      let left = m.speed * dt
      while (left > 0 && m.seg < m.path.length - 1) {
        const rest = m.path[m.seg].distanceTo(m.path[m.seg + 1]) - m.along
        if (left < rest) {
          m.along += left
          left = 0
        } else {
          left -= rest
          m.seg += 1
          m.along = 0
        }
      }
      const g = m.p.group
      if (m.seg >= m.path.length - 1) {
        g.position.copy(m.path[m.path.length - 1])
        m.path = null
        m.p.stand()
        if (m.done) m.done(m)
        return
      }
      const a = m.path[m.seg]
      const b = m.path[m.seg + 1]
      g.position.lerpVectors(a, b, m.along / Math.max(a.distanceTo(b), 0.0001))
      if (Math.hypot(b.x - a.x, b.z - a.z) > 0.01) {
        g.rotation.y = Math.atan2(b.x - a.x, b.z - a.z)
      }
      m.phase += (m.speed * dt) / 0.7
      m.p.walk(m.phase)
    })
  }

  return { people, take, release, releaseAll, put, walk, finish, walking, update }
}

/**
 * 点を作る短い書き方
 */
export const v3 = (x, y, z) => new THREE.Vector3(x, y, z)
