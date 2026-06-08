# 引き継ぎ資料 — 四神将棋

このファイルは、別のセッション／チャットで開発を引き継ぐための仕様・決定事項・残作業のまとめです。
**ルールは考案者のオリジナル**なので、コードだけでは読み取れない決定をここに記録しています。

最終更新: 2026-06-09（オンライン対戦＝Firebase＋Vercel デプロイ、駒画像・UIレイアウト刷新を追加）

---

## 1. ゲーム概要

- 4 人対戦の将棋バリアント。陣営テーマは四神（青龍・白虎・朱雀・玄武）。
- 駒の動きは**完全に将棋と同じ**。違いは「十字型の盤を 4 人で囲む」「前＝中央方向」という点。
- **目標だったオンラインのリアルタイム同期は実装済み**：各プレイヤーが自分の陣を手前に固定して遊べる。
  - 公開URL: **https://fourguardians.vercel.app**（Vercel。GitHub main への push で自動再デプロイ）。
  - 入口でモード選択：**オンライン対戦（Firebase 同期）** / **ローカル同卓（1 画面で交代）**。

---

## 2. 確定済みルール

### 盤
- **11×11 の十字（プラス）型**。四隅の 2×2 は盤外で、各プレイヤーの**駒台**として使う。
- 盤上判定：`col∈[2,8] または row∈[2,8]`（`isOnBoard`）。
- 座標は `(row, col)` の 0 始まり（0..10）。中心は `(5,5)`。

### 陣営（座席）
- 4 陣営：`south`（手前/下）・`west`（左）・`north`（上）・`east`（右）。
- **`south` を正本**とし、他は中心まわりに 90° ずつ時計回り回転して生成する。
  - quarterTurns: south=0, west=1, north=2, east=3。
- 各陣のホーム：**横 7 マス × 奥行 2 マス**（最奥段＝駒、その手前＝歩）。
  - south ホーム: rows 9–10, cols 2–8 / north: rows 0–1 / west: cols 0–1 / east: cols 9–10。

### 初期配置（south 正本）
- 最奥段（row 10, col 2→8）: **桂 金 飛 王 銀 角 香**（`N G R K S B L`）
- 歩段（row 9, col 2→8）: 歩 ×7
- → 1 人 14 枚、合計 56 枚。各種 1 枚ずつ（香桂銀金角飛が 1 枚ずつ）＋王＋歩 7。**駒の重複なし**。
- 他陣は回転コピー（`createInitialBoard` が生成。`check` で画像と一致を確認済み）。

### 駒の動き
- 将棋と同一。各駒の「前」＝中央方向。south=上(-row)、west=右(+col)、north=下(+row)、east=左(-col)。
- 実装は south 基準のベクトルを所有者の quarterTurns ぶん回転（`moves.ts: orientedPattern`）。
- 成り駒：と・成香・成桂・成銀＝金の動き、馬＝角＋王(縦横1)、龍＝飛＋王(斜め1)。金・王は成らない。

### 取る／持ち駒
- 4 人なので**自分以外の 3 陣営の駒はすべて取れる**。
- 取った駒は**未成りに戻して**手番側の持ち駒へ。**自分の向き**で打てる（将棋と同じ）。
- 打ち制限は**「行き所のない駒」だけ実装済み**。**二歩・打ち歩詰めは未実装**（要検討）。

### 成り（昇格）
- **成りゾーン = 中央 3×3（rows/cols 4–6）＋ 敵陣（自分以外のホーム 2 列）どこでも**。
- 任意成り：出発マスか到着マスが成りゾーンなら成れる。
- 強制成り：歩・香・桂が着地後に行き所がなくなる場合（`mustPromote`）。
- 中央 3×3 だけだと端列の歩が成れない問題があったため「敵陣でも成れる」を追加した経緯。

### 手番
- **時計回り**：south → west → north → east → …（`TURN_ORDER` / `nextSeat`）。
- 脱落者がいる場合は飛ばす（`nextLiveSeat`）。
- 視点は**固定**（手番では自動回転しない）。オンラインは自席を手前に固定、ローカルは「手前に見る陣」ボタンで手動切替。

### 勝敗・脱落（実装済み・切り替え式）
- 対局開始時に **案A（早抜け）/ 案B（生き残り）** を選ぶ（`GameState.rule` = `'first' | 'survivor'`）。ルール切替＝対局リセット。
- **着手の合法性**：自分の王が取られたままになる手は禁止（`legalMoves` / `isLegalDrop`）。UI も合法手だけをハイライト。
- **王手・詰み判定**（`rules.ts`）：`isInCheck` / `hasAnyLegalMove` / `isCheckmated`。現手番が王手中なら王のマスを赤くハイライト。
- **詰みの判定時点（決定事項）**：「**詰まされる人の手番**」で判定する。＝着手後にいったん次の生存者へ手番を送り、その人が合法手ゼロ（＋王手なら詰み／王手なしなら手詰まり）なら決着・脱落。
  - 効果：王手をかけられても、間に指す他の 2 人が割り込んで助け（取る・遮る）られる ＝ 4 人ならではの駆け引きが生まれる。
- **脱落者の駒（決定事項）**：盤上に残るが **王手をかけない**（動かない＝実際には王を取れないため）。スライド駒の利きを遮る障害物・取られる対象としては機能する。`rules.ts` は脱落者の駒を攻撃判定から除外する。
- **案A**：次の手番者が詰み／手詰まりなら即決着。勝者は王手をかけている陣（複数なら直前に指した人を優先、手詰まりはその局面を作った人）。`GameState.result`。
- **案B**：詰み／手詰まりの人を脱落させ（`eliminated[seat]=true`）、手番から外す。1 人になったら勝ち。脱落で他陣の利きが消え、玉が救われるカスケードも `engine.finalize` が処理。

---

## 3. 未確定・要決定（次に決めること）

### 勝敗ルール（**切り替え式で実装済み → 遊んで A/B を選定する段階**）
- 案A：**誰かの王を詰ませたら、その人の勝ち**（早抜け）。
- 案B：**詰まされたら脱落、最後の 1 人が勝ち**（生き残り）。
- → 対局開始時に選べる「切り替え式」で実装済み（§2「勝敗・脱落」）。**実際に遊んで A/B どちらを正式採用するか決める**のが次の判断。
- 関連の細則（**実装済みの既定**。遊んで違和感があれば再検討）：
  - 詰みは「詰まされる人の手番」で判定（割り込み可）。
  - 脱落者の駒は王手をかけない。
  - 手詰まり（合法手ゼロかつ王手なし＝ステイルメイト）は、案A は負け扱い・案B は脱落扱い（将棋準拠で「指せない＝負け」）。稀ケース。違う扱いにするなら `engine.finalize` を調整。

### 脱落者の駒（決定済み）
- 脱落したプレイヤーの盤上の駒は**盤上に残る**（動かない障害物として残り、誰かが取れば持ち駒になる）。**王手はかけない**（実装済み）。

### その他の検討事項
- **盤の幾何の副作用**：四隅で陣どうしが近く、**初手から桂が隣の陣の歩を取れる**。意図どおりか要確認（初期配置や桂の扱いの調整余地）。
- プレイヤー名は**記入制**（実装済み）。ローカルは4人ぶん入力＋「ランダム配置／入力順」、オンラインはロビーで各自入力し開始時に4席ランダム割当。

---

## 4. 実装状況

### 完了
- Vite + React + TS のセットアップ
- 盤の描画（十字型・駒台・中央ゾーン・視点切替）
- 合法手生成（全駒・回転対応・十字盤対応・スライド/ステップ）
- 選択→ハイライト→移動、取る→持ち駒、打つ
- 時計回りの手番（脱落者スキップ対応）
- 成り（ゾーン判定・任意/強制・選択モーダル）
- **王手判定**（`rules.isInCheck` / `isSquareAttacked`、脱落者の駒は除外）
- **着手の合法性**（`rules.legalMoves` / `isLegalDrop`、自玉が取られる手を禁止。UI も合法手のみ表示）
- **詰み判定**（`rules.hasAnyLegalMove` / `isCheckmated`）
- **勝敗・脱落（切り替え式 案A/案B）**（`engine.finalize`、`GameState.rule/eliminated/result`、決着モーダル・脱落表示・王手ハイライト）
- **UI 刷新**：駒を画像表示（`public/pieces/`。表＝黒字・裏＝赤字、所有者は縁取り色で識別）、持ち駒は十字盤の空き四隅、名前は各自の玉の下、視点固定。
- **参加者名の記入制＋ランダム配置**（ローカル・オンライン両方）。
- **オンライン対戦（Firebase Realtime Database）**：部屋作成/参加・参加者のリアルタイム表示・状態同期（`firebase.ts` / `room.ts` / `OnlineGame.tsx`）。
- **デプロイ**：Vercel（main 自動デプロイ、https://fourguardians.vercel.app ）。**ローカル開発**：Docker（`docker compose up` → http://localhost:5180/）。詳細は §6。

### 未実装（TODO）
1. **打ち制限**：二歩（十字盤での「筋」の定義に注意）・打ち歩詰め。
2. **勝敗ルール A/B の正式決定**：遊んで案A（早抜け）/案B（生き残り）どちらを採用するか決める（切替実装は済み）。
3. **4人未満での開始**：現状オンラインは **4人ちょうど**で開始（空席を扱えない）。2〜3人で遊ぶなら「空席＝不在席（駒なし or 最初から脱落）」対応が要る。
4. **古い部屋の自動削除**：`rooms/{code}` が溜まり続ける。作成時刻での掃除（入室時に期限切れ削除 or Cloud Functions）。
5. **匿名認証でルール強化（任意）**：今は `/rooms` を誰でも読み書き可。Firebase Anonymous Auth で `auth != null` に締められる（`firebase/auth` 追加＋再デプロイ）。
6. （余裕があれば）連続王手の千日手・持将棋などの細則。

---

## 5. アーキテクチャ / コード地図

| ファイル | 役割 |
|---|---|
| `src/game.ts` | 盤の幾何（`isOnBoard` / `isCenterZone` / `homeSeatOf`）、型（`Piece` / `Board` / `GameState`{`board,hands,turn,rule,eliminated,result`} / `WinRule` / `GameResult` / `Selection`）、回転（`rotateCW` / `quarterDiff` / `viewToBoard`）、初期配置（`createInitialBoard` / `createInitialState(rule)`）、手番（`nextSeat` / `nextLiveSeat` / `liveSeats` / `TURN_ORDER`）、`SEAT_INFO`、`KANJI` |
| `src/moves.ts` | 擬似合法手生成（`generateMoves`：盤内・自駒衝突のみ。王手放置は見ない）、駒パターン、成りゾーン判定（`isPromotionZone` / `canPromote` / `mustPromote`）、打ち判定（`canDrop`） |
| `src/rules.ts` | **王手・着手の合法性・詰み判定**。`findKing` / `isSquareAttacked` / `isInCheck` / `checkingSeats`（勝者特定）/ `legalMoves`（自玉が取られる手を除外）/ `isLegalDrop` / `hasAnyLegalMove` / `isCheckmated`。脱落者の駒は攻撃判定から除外。 |
| `src/engine.ts` | 状態遷移の純粋関数（`applyMove` / `applyDrop`）。取り→持ち駒、成り反映、`finalize`（手番送り＋詰み/手詰まり判定＋案A決着・案B脱落カスケード） |
| `src/Board.tsx` | 盤・駒（画像）・持ち駒・名前の描画、クリック処理。`view` に応じて盤と駒を回転。持ち駒は十字の空き四隅、名前は各自の玉の下。脱落者の淡色表示・王手の赤ハイライト（`checkKing`） |
| `src/GameBoard.tsx` | **対局UIの共通部品**（ローカル/オンライン兼用）。選択・合法手ハイライト・成り選択・決着表示を内包。着手後の新 `GameState` を `onCommit` で親へ。`controllable` で操作可否を制御 |
| `src/App.tsx` | 入口ルーター（ホーム→ローカル/オンライン）。URL に `?room=` があれば最初からオンラインへ |
| `src/LocalGame.tsx` | ローカル同卓（名前入力＋ランダム配置のセットアップ→`GameBoard`、`onCommit=setGame`） |
| `src/OnlineGame.tsx` | オンライン（名前→部屋作成/参加→ロビー→対局）。`room.ts` を購読、自席手前固定・自手番のみ操作・`onCommit=pushState` |
| `src/firebase.ts` | Firebase 初期化（`.env.local` の `VITE_FIREBASE_*` を読む。未設定なら `db=null`・`isFirebaseConfigured=false`） |
| `src/room.ts` | オンライン同期レイヤー（RTDB）。部屋作成/参加・presence・参加者購読・席ランダム割当・状態書き込み。`playerId` は localStorage（`?pid=` で上書き＝多タブテスト用） |
| `src/index.css` | スタイル全般 |

### 座標と回転の要点（重要）
- `rotateCW(r,c,times)`：中心(5,5)まわりに 90°×times 時計回り。`(r,c) → (c, 10-r)`。
- 各陣は south を quarterTurns ぶん回転して生成（座標も字の向きも同じ回転量）。
- 表示は `viewToBoard(dr,dc,view)` で画面マス→実マスに変換。`view` の陣が常に下に来る。
- 駒の字の回転角は `quarterDiff(owner, view) * 90` 度。自分の駒は常に正立（0°）。
- 名前・駒台の配置スロットも `quarterDiff(seat, view)`（0=下,1=左,2=上,3=右）で決まる。

### 動作確認のしかた（Node 単体で）
内部の相対 import が拡張子なしのため、`node` 直実行は解決に失敗する。esbuild でバンドルして実行する：

```bash
npx esbuild check.ts --bundle --format=esm --platform=node --outfile=check.mjs && node check.mjs
```

（これまで初期配置・各駒の動き・成り判定をこの方法で検証した。検証用スクリプトはコミットに含めていない。）

---

## 6. オンライン対戦・デプロイ・開発環境

### データ構造（Firebase Realtime Database）
```
rooms/{code}/
  meta    : { phase: 'lobby'|'playing'|'finished', rule, hostId, createdAt }
  players : { [playerId]: { name, seat, online, joinedAt } }
  state   : GameState を JSON 文字列化したもの（対局中の唯一の真実）
```
- 盤は null/配列を含むため、RTDB の配列・null の癖を避けて **`state` は GameState まるごとを JSON 文字列**で持つ（ターン制で書き込み頻度が低いので十分）。
- 着手は「その手番のクライアント」だけが `engine.applyMove/applyDrop` → `room.pushState` で `state` を上書き。全員が `subscribeRoom` で購読して再描画（単一の真実）。
- `playerId` は localStorage 永続（リロードで同一人物）。`?pid=` で上書きでき、同一ブラウザの複数タブを別人としてテストできる。

### フロー
入口でモード選択 →（オンライン）名前入力 → 部屋を作る（4文字コード生成）/コードで参加 → ロビー（参加者リアルタイム表示）→ **4人ちょうど**でホストが開始 → 席をランダム割当 → 対局（自席手前固定・自手番のみ操作）→ 決着でホストが「再戦」。

### 設定（環境変数）
- `.env.local`（gitignore 済み）に `VITE_FIREBASE_*` の5つ。`.env.example` がテンプレート。
- 公開キーなので秘密ではない（セキュリティは DB ルールで担保）。
- **Vercel にも同じ5つを環境変数登録**（未登録だと本番で繋がらない）。env を変えたら**再デプロイ必須**（Vite がビルド時に焼き込むため）。Firebase プロジェクトは `fourguardians-fabc8`。

### DB ルール（公開済み・期限なし）
```json
{ "rules": { ".read": false, ".write": false, "rooms": { ".read": true, ".write": true } } }
```
- root は拒否、`/rooms` のみ読み書き可。テストモード（30日で失効）は置換済み。

### デプロイ（Vercel）
- GitHub `kureha2310/fourguardians` を連携。**main に push で自動再デプロイ**。Framework=Vite / build=`npm run build` / output=`dist`。

### ローカル開発（Docker）
- `docker compose up` → http://localhost:5180/。ソースはバインドマウントで HMR、`node_modules` はコンテナ側。
- Windows のバインドマウント対策で、`vite.config.ts` は `VITE_DOCKER` 時のみ watch をポーリングに。
- 依存を増やしたら（例：`firebase` 追加時）`docker compose up -d --build --renew-anon-volumes` で再構築（匿名 node_modules ボリュームを作り直す）＋ `.env.local` 再読込。

---

## 7. 既知の注意点・設計判断
- `moves.generateMoves` は**擬似合法手**（盤内・自駒衝突のみ）。**王手放置のフィルタは `rules.legalMoves` / `isLegalDrop` 側**で行う。UI（`App.targets`）と詰み判定（`hasAnyLegalMove`）は必ず `rules` 側を通すこと。`generateMoves` を直接 UI に使うと違法手が指せてしまう。
- 攻撃・詰み判定は素朴な総当たり（全駒 × `generateMoves` × 着手シミュレーション）。盤が小さく手番制なので実用上問題ないが、重くなったら攻撃テーブル化を検討。
- 勝敗の判定時点は「詰まされる人の手番」。`applyMove`/`applyDrop` → `engine.finalize` の中で次手番者を判定する流れ。決着後は `applyMove`/`applyDrop` が `state.result` を見て何もしない。
- `structuredClone` で `GameState` を複製している（`eliminated`/`result` も含めて深いコピー。駒は素のオブジェクトなので問題なし）。`rules` 内のシミュレーションは行配列の浅いコピー（駒は共有・不変）で高速化。
- React は StrictMode。状態は不変更新。
- オンライン同期は楽観更新しない：着手したクライアントも `pushState` の購読エコー（onValue）で再描画する（＝全員が同じ `state` を見る）。
- `GameBoard` の `controllable` が操作可否（local=常時 / online=自席が手番）。`Board` の持ち駒は「手番席」を mine 扱いするため、オンラインで相手手番の駒台が押せそうに見えるが、操作はガードで無効（軽微な見た目の問題のみ）。
- 検証用の `check.ts`（esbuild→node、§5）はコミットに含めない運用。
