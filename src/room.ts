// オンライン対戦の同期レイヤー（Firebase Realtime Database）。
//
// データ構造:
//   rooms/{code}/meta    : { phase, rule, hostId, createdAt }
//   rooms/{code}/players : { [playerId]: { name, seat, online, joinedAt } }
//   rooms/{code}/state   : GameState を JSON 文字列化したもの（対局中の唯一の真実）
//
// GameState の盤は null/配列を含むため、RTDB の配列・null の癖を避けて
// まるごと JSON 文字列で持つ（ターン制で書き込み頻度が低いので十分）。

import { get, onDisconnect, onValue, ref, remove, set, update } from 'firebase/database'
import { db } from './firebase'
import { TURN_ORDER, createInitialState, type GameState, type Seat, type WinRule } from './game'

export type Phase = 'lobby' | 'playing' | 'finished'

export interface PlayerInfo {
  name: string
  seat: Seat | null
  online: boolean
  joinedAt: number
}

export interface RoomMeta {
  phase: Phase
  rule: WinRule
  hostId: string
  createdAt: number
}

export interface RoomSnapshot {
  exists: boolean
  meta: RoomMeta | null
  players: Record<string, PlayerInfo>
  state: GameState | null
}

// ---- 自分の識別子・名前（リロードしても同一人物） ----
const PID_KEY = 'fg_player_id'
const NAME_KEY = 'fg_player_name'

export function getPlayerId(): string {
  // テスト用：?pid=... があれば上書き（同一ブラウザの複数タブで別人として参加できる）
  const override = new URLSearchParams(location.search).get('pid')
  if (override) return override
  let id = localStorage.getItem(PID_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(PID_KEY, id)
  }
  return id
}

export function getSavedName(): string {
  return localStorage.getItem(NAME_KEY) ?? ''
}
export function saveName(name: string): void {
  localStorage.setItem(NAME_KEY, name)
}

// ---- 部屋コード（紛らわしい字を除外した 4 文字） ----
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export function generateRoomCode(len = 4): string {
  let s = ''
  for (let i = 0; i < len; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  return s
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ---- パス ----
function requireDb() {
  if (!db) throw new Error('Firebase 未設定です（.env.local を確認してください）')
  return db
}
const pRoom = (code: string) => ref(requireDb(), `rooms/${code}`)
const pMeta = (code: string) => ref(requireDb(), `rooms/${code}/meta`)
const pPlayer = (code: string, pid: string) => ref(requireDb(), `rooms/${code}/players/${pid}`)
const pOnline = (code: string, pid: string) => ref(requireDb(), `rooms/${code}/players/${pid}/online`)

// ---- 部屋の作成・参加 ----
export async function roomExists(code: string): Promise<boolean> {
  const snap = await get(pMeta(code))
  return snap.exists()
}

export async function createRoom(code: string, playerId: string, name: string, rule: WinRule): Promise<void> {
  const meta: RoomMeta = { phase: 'lobby', rule, hostId: playerId, createdAt: Date.now() }
  await set(pMeta(code), meta)
  await joinRoom(code, playerId, name)
}

export async function joinRoom(code: string, playerId: string, name: string): Promise<void> {
  // 既に参加済みなら席を保持したまま名前だけ更新
  const existing = (await get(pPlayer(code, playerId))).val() as PlayerInfo | null
  const info: PlayerInfo = {
    name,
    seat: existing?.seat ?? null,
    online: true,
    joinedAt: existing?.joinedAt ?? Date.now(),
  }
  await set(pPlayer(code, playerId), info)
}

export async function leaveRoom(code: string, playerId: string): Promise<void> {
  await remove(pPlayer(code, playerId))
}

/** 切断検知：オンライン状態を online=true にし、切れたら自動で false に。 */
export function setupPresence(code: string, playerId: string): void {
  const onlineRef = pOnline(code, playerId)
  set(onlineRef, true)
  onDisconnect(onlineRef).set(false)
}

// ---- 購読 ----
export function subscribeRoom(code: string, cb: (snap: RoomSnapshot) => void): () => void {
  return onValue(pRoom(code), (snapshot) => {
    const val = snapshot.val() as
      | { meta?: RoomMeta; players?: Record<string, PlayerInfo>; state?: string }
      | null
    if (!val) {
      cb({ exists: false, meta: null, players: {}, state: null })
      return
    }
    let state: GameState | null = null
    if (typeof val.state === 'string') {
      try {
        state = JSON.parse(val.state) as GameState
      } catch {
        state = null
      }
    }
    cb({ exists: true, meta: val.meta ?? null, players: val.players ?? {}, state })
  })
}

// ---- 進行 ----
export async function setRule(code: string, rule: WinRule): Promise<void> {
  await update(pMeta(code), { rule })
}

/** ホストが対局開始：参加者を 4 席にランダム割当し、初期状態を書き込む。 */
export async function startGame(
  code: string,
  players: Record<string, PlayerInfo>,
  rule: WinRule,
): Promise<void> {
  const ids = shuffle(Object.keys(players))
  const updates: Record<string, unknown> = {}
  TURN_ORDER.forEach((seat, i) => {
    const pid = ids[i]
    if (pid) updates[`players/${pid}/seat`] = seat
  })
  updates['state'] = JSON.stringify(createInitialState(rule))
  updates['meta/phase'] = 'playing'
  await update(pRoom(code), updates)
}

/** 着手後の新しい GameState を共有（current turn のプレイヤーだけが呼ぶ）。 */
export async function pushState(code: string, state: GameState): Promise<void> {
  await update(pRoom(code), {
    state: JSON.stringify(state),
    'meta/phase': state.result ? 'finished' : 'playing',
  })
}

/** 同じメンバー・同じ席のまま盤だけ初期化（再戦）。 */
export async function restartGame(code: string, rule: WinRule): Promise<void> {
  await update(pRoom(code), {
    state: JSON.stringify(createInitialState(rule)),
    'meta/phase': 'playing',
  })
}
