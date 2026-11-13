# 開発の手順

## 1. 作り

- ゲームは1本ずつ、リポ直下のディレクトリに置く。(`ashioto/` など)
- `vite.config.js` が、`index.html` を持つディレクトリをビルドの入口に集める。新しいゲームはディレクトリを作るだけで入る。
- Vite 8 (rolldown) と three.js 0.187 で作っている。
- 公開は GitHub Pages。main に push すると、`.github/workflows/pages.yml` がビルドして公開する。

## 2. 動かす / 確かめる

```bash
$ npm run dev
```

- http://localhost:5180/ で一覧が開く。port は 5180 で固定している。
- push の前に、ビルドと整形が通るのを確かめる。

```bash
$ npm run build
$ npx prettier --check .
```

## 3. あしおと

### 3.1 ファイル

| ファイル    | 中身                                                       |
| ----------- | ---------------------------------------------------------- |
| main.js     | 遊びの流れ。日数、難しさ、出来事、死に方                   |
| building.js | 建物とまわりの形。歩ける範囲 (区画) と、階段を下りる道すじ |
| lights.js   | 照明。近い照明にだけ、本物の光を割り当てる                 |
| people.js   | 階段ですれ違う住人と、おかしな人                           |
| figure.js   | 顔の無い人                                                 |
| sound.js    | 効果音。Web Audio でその場で作る                           |
| textures.js | 壁や看板などの絵。canvas で描く                            |

### 3.2 開発中だけの入口

`npm run dev` の時だけ、`window.__ashioto` がある。ブラウザの console から使う。

| 名前                                   | すること                                          |
| -------------------------------------- | ------------------------------------------------- |
| `start(level)`                         | 難しさを決めて始める (`easy` / `normal` / `hard`) |
| `tp(x, floor, z, yaw)`                 | 指定の場所へ移る                                  |
| `look(yaw, pitch)`                     | 向きを変える                                      |
| `home()`                               | 412号室に入った時の流れを始める                   |
| `walker({ strange, up })`              | 階段に人を出す                                    |
| `lamp()`                               | うしろの街灯の下に人を立たせる                    |
| `lift(floor)`                          | その階にエレベーターを着ける                      |
| `pick(nx, ny)`                         | 画面の点に何が写っているかを返す                  |
| `S` / `building` / `figure` / `person` | 遊びの状態と、建物・人の中身                      |

```js
__ashioto.start('normal')
__ashioto.tp(2.15, 2, -1.05, 0)
__ashioto.walker({ strange: true })
```

### 3.3 遊んだ記録

- localStorage の `kowai.ashioto` に、`{ visits, last }` (遊んだ回数と前の結果) を残す。タイトルの一言がこれで変わる。
- 確かめるために始めると、`visits` が増える。前に値を退避しておき、終わったら戻す。

### 3.4 注意点 (作りの癖)

- 照明は70個あるが、本物の光が当たるのは目に近い10個だけ。遠い街灯などは、近づくまで暗い。
- 建物の奥は中の詰まった箱で、412号室の玄関と廊下、エレベーターの昇降路だけをくり抜いてある (`boxWithout`)。奥に何かを作る時は、くり抜いてから、内向きの壁を置く。
- 雨だれなどの汚れは、透ける板を面の数 mm 手前に貼っている (`depthWrite: false`)。
