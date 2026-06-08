// 四神将棋 — 駒の動き（合法手の生成）
//
// 動きは「完全に将棋と同じ」。各駒は所有者の向き（＝中央方向が前）に合わせて
// 基準ベクトル（south＝上向き, 前 = row 減少）を 90° ずつ回転して使う。

import {
  homeSeatOf,
  isCenterZone,
  isOnBoard,
  SEAT_INFO,
  type Board,
  type Piece,
  type PieceType,
  type Seat,
} from './game'

export type Vec = [number, number]

/** 駒の移動パターン：1 マスだけ動く steps と、利く限り伸びる slides */
interface Pattern {
  steps: Vec[]
  slides: Vec[]
}

// south（上向き）基準のベクトル。前 = (-1, 0)
const GOLD: Vec[] = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, 0],
]
const SILVER: Vec[] = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [1, -1],
  [1, 1],
]
const KING: Vec[] = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
]
const KNIGHT: Vec[] = [
  [-2, -1],
  [-2, 1],
]
const ORTHO: Vec[] = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
]
const DIAG: Vec[] = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
]

/** 成り前後を踏まえた、south 基準のパターン */
function basePattern(piece: Piece): Pattern {
  if (piece.promoted) {
    switch (piece.type) {
      case 'P':
      case 'L':
      case 'N':
      case 'S':
        return { steps: GOLD, slides: [] } // と・成香・成桂・成銀 = 金
      case 'B':
        return { steps: ORTHO, slides: DIAG } // 馬 = 角 + 王（縦横1）
      case 'R':
        return { steps: DIAG, slides: ORTHO } // 龍 = 飛 + 王（斜め1）
      default:
        break // 金・王は成らない
    }
  }
  switch (piece.type) {
    case 'P':
      return { steps: [[-1, 0]], slides: [] }
    case 'L':
      return { steps: [], slides: [[-1, 0]] }
    case 'N':
      return { steps: KNIGHT, slides: [] }
    case 'S':
      return { steps: SILVER, slides: [] }
    case 'G':
      return { steps: GOLD, slides: [] }
    case 'B':
      return { steps: [], slides: DIAG }
    case 'R':
      return { steps: [], slides: ORTHO }
    case 'K':
      return { steps: KING, slides: [] }
  }
}

/** ベクトルを時計回りに times 回 90° 回転（CW: (dr,dc)→(dc,-dr)） */
function rotateVec([dr, dc]: Vec, times: number): Vec {
  let r = dr
  let c = dc
  for (let i = 0; i < ((times % 4) + 4) % 4; i++) {
    const nr = c
    const nc = -r
    r = nr
    c = nc
  }
  return [r, c]
}

/** 所有者の向きに合わせて回転したパターン */
function orientedPattern(piece: Piece): Pattern {
  const t = SEAT_INFO[piece.owner].quarterTurns
  const base = basePattern(piece)
  return {
    steps: base.steps.map((v) => rotateVec(v, t)),
    slides: base.slides.map((v) => rotateVec(v, t)),
  }
}

/** 移動先 1 件 */
export interface Move {
  row: number
  col: number
  capture: boolean
}

/**
 * (fromR, fromC) の駒の擬似合法手（盤の内外・自駒衝突のみ判定。
 * 王手放置の判定は未実装）。
 */
export function generateMoves(board: Board, fromR: number, fromC: number): Move[] {
  const piece = board[fromR][fromC]
  if (!piece) return []
  const moves: Move[] = []
  const { steps, slides } = orientedPattern(piece)

  const consider = (r: number, c: number): 'stop' | 'continue' => {
    if (!isOnBoard(r, c)) return 'stop'
    const target = board[r][c]
    if (!target) {
      moves.push({ row: r, col: c, capture: false })
      return 'continue'
    }
    // 他陣の駒なら取れる（4 人なので自分以外は全部敵）
    if (target.owner !== piece.owner) {
      moves.push({ row: r, col: c, capture: true })
    }
    return 'stop' // 駒があればそこで止まる
  }

  for (const [dr, dc] of steps) {
    consider(fromR + dr, fromC + dc)
  }
  for (const [dr, dc] of slides) {
    let r = fromR + dr
    let c = fromC + dc
    while (consider(r, c) === 'continue') {
      r += dr
      c += dc
    }
  }
  return moves
}

/** その駒・その向きで (r,c) に置いたとき、盤内に利きが 1 つでもあるか（行き所のない駒の判定用） */
export function hasAnyMoveAt(piece: Piece, r: number, c: number): boolean {
  const { steps, slides } = orientedPattern(piece)
  for (const [dr, dc] of [...steps, ...slides]) {
    if (isOnBoard(r + dr, c + dc)) return true
  }
  return false
}

/** seat が (r,c) に type を打てるか（空マス＋行き所のない駒の禁止のみ。二歩等は未実装） */
export function canDrop(board: Board, seat: Seat, type: PieceType, r: number, c: number): boolean {
  if (!isOnBoard(r, c)) return false
  if (board[r][c]) return false
  const dummy: Piece = { type, owner: seat, promoted: false }
  return hasAnyMoveAt(dummy, r, c)
}

// ---- 成り（昇格） ----

const PROMOTABLE: ReadonlySet<PieceType> = new Set(['P', 'L', 'N', 'S', 'B', 'R'])

/** owner から見て (r,c) が成りゾーンか：中央 3×3、または他陣営のホーム（敵陣）。 */
export function isPromotionZone(owner: Seat, r: number, c: number): boolean {
  if (isCenterZone(r, c)) return true
  const home = homeSeatOf(r, c)
  return home !== null && home !== owner
}

/** (from)→(to) の移動で成れるか（任意成り。出発か到着のどちらかが成りゾーン） */
export function canPromote(
  piece: Piece,
  fromR: number,
  fromC: number,
  toR: number,
  toC: number,
): boolean {
  if (piece.promoted || !PROMOTABLE.has(piece.type)) return false
  return (
    isPromotionZone(piece.owner, fromR, fromC) || isPromotionZone(piece.owner, toR, toC)
  )
}

/** (to) に着いた後、行き所がなく成りが強制されるか（歩・香・桂のみ） */
export function mustPromote(piece: Piece, toR: number, toC: number): boolean {
  if (piece.promoted) return false
  if (piece.type !== 'P' && piece.type !== 'L' && piece.type !== 'N') return false
  return !hasAnyMoveAt(piece, toR, toC)
}
