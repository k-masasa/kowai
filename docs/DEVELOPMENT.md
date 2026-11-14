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

| ファイル    | 中身                                                           |
| ----------- | -------------------------------------------------------------- |
| main.js     | 遊びの流れ。電車の動き、話の流れ、日数、難しさ、出来事、死に方 |
| kit.js      | 箱・壁・床・管・屋根などを組む共通の部品と、歩ける区画         |
| building.js | マンションとまわりの形 (最寄り駅までの道、家、駐輪場、掲示板)  |
| town.js     | 会社のある町 (ロビー、駅までの通りと店、交番)                  |
| station.js  | 駅 (改札、ホーム、線路)。乗る駅と最寄り駅で使い回す            |
| train.js    | 2両の電車と、走っている間に窓の外を流れる景色                  |
| lights.js   | 照明。近い照明にだけ、本物の光を割り当てる                     |
| people.js   | 階段ですれ違う住人と、おかしな人                               |
| figure.js   | 顔の無い人                                                     |
| sound.js    | 効果音。Web Audio でその場で作る                               |
| textures.js | 壁や看板などの絵。canvas で描く                                |

- 場所は、離して置いている。会社の町と乗る駅は x = -1000 のあたり、マンションと最寄り駅は x = -180 から 110、走っている間の電車は (800, 0, -300)。霧とカメラの遠さ (140m) で、ほかの場所は見えない。
- 歩ける区画の名前は、マンションの中がふつうの名前 (`H3` / `C20` など)、それ以外は `@` で始まる (`@OB` ロビー、`@CS` 通り、`@CP` 乗る駅のホーム、`@T` 電車、`@HP` 最寄り駅のホーム)。マンションの区画に入ると、建物の中の扱いになる。

### 3.2 開発中だけの入口

`npm run dev` の時だけ、`window.__ashioto` がある。ブラウザの console から使う。

| 名前                                              | すること                                          |
| ------------------------------------------------- | ------------------------------------------------- |
| `start(level)`                                    | 難しさを決めて始める (`easy` / `normal` / `hard`) |
| `tp(x, floor, z, yaw)`                            | 指定の場所へ移る                                  |
| `look(yaw, pitch)`                                | 向きを変える                                      |
| `home()`                                          | 2012号室に入った時の流れを始める                  |
| `walker({ strange, up, mimic })`                  | 階段に人を出す                                    |
| `lamp()`                                          | うしろの街灯の下に人を立たせる                    |
| `lift(floor)`                                     | その階にエレベーターを着ける                      |
| `pick(nx, ny)`                                    | 画面の点に何が写っているかを返す                  |
| `S` / `building` / `figure` / `person` / `crouch` | 遊びの状態と、建物・人の中身                      |
| `train` / `town` / `workStation` / `homeStation`  | 電車と、町と、2つの駅                             |
| `renderer` / `scene` / `camera`                   | 描く回数や時間を測る時に使う                      |

```js
__ashioto.start('normal')
__ashioto.tp(2.15, 2, -1.05, 0)
__ashioto.walker({ strange: true })
```

### 3.3 遊んだ記録

- localStorage の `kowai.ashioto` に、`{ visits, last }` (遊んだ回数と前の結果) を残す。タイトルの一言がこれで変わる。
- 確かめるために始めると、`visits` が増える。前に値を退避しておき、終わったら戻す。

### 3.4 注意点 (作りの癖)

- 照明は330個あるが、本物の光が当たるのは目に近い10個だけ。遠い街灯などは、近づくまで暗い。
- 20階建てなので、扉・窓・照明の光る部分などは階ごとの入れ物 (`floorGroups`) に入れ、中にいる間は上下2階分、外にいる間は下の4階分だけ描く。
- 建物の奥は中の詰まった箱で、2012号室の玄関と廊下、エレベーターの昇降路だけをくり抜いてある (`boxWithout`)。奥に何かを作る時は、くり抜いてから、内向きの壁を置く。
- 雨だれなどの汚れは、透ける板を面の数 mm 手前に貼っている (`depthWrite: false`)。
- 手元の dev サーバーが、ファイルの変更を拾わないことがある (古い中身を返し続ける)。その時は起動し直す。
  - ほかのセッションが起動したサーバーで止められない時は、`main.js?v=1` のようにクエリを付けると新しい中身が返る。Chrome で `/ashioto/style.css` を開き、`index.html` の script の src を `/ashioto/main.js?v=1` に書き換えて `document.write` すると、そのまま遊べる。
- Claude in Chrome から開いたタブでは、マウスのロックが取れない (`WrongDocumentError`)。ロックが効いた時の動きは、`HTMLCanvasElement.prototype.requestPointerLock` と `document.pointerLockElement` を差し替え、`pointerlockchange` を自分で投げて確かめる。
