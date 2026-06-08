// 四神将棋 — 王手・着手の合法性・詰み判定。
//
// すべて純粋関数。脱落者（eliminated）の駒は「動かない＝王手をかけない」が、
// 盤上には残るので、スライド駒の利きを遮る障害物・取られる対象としては機能する。

import { BOARD_SIZE, type Board, type Hand, type PieceType, type Seat } from './game'
import { canDrop, generateMoves, type Move } from './moves'

/** seat の王の位置。無ければ null（理屈上は起きないが防御的に）。 */
export function findKing(board: Board, seat: Seat): [number, number] | null {
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const p = board[r][c]
      if (p && p.type === 'K' && p.owner === seat) return [r, c]
    }
  }
  return null
}

/**
 * (r,c) が seat 以外の「生存」プレイヤーの利きに入っているか。
 * 脱落者の駒は王手をかけないので除外する。
 */
export function isSquareAttacked(
  board: Board,
  r: number,
  c: number,
  seat: Seat,
  eliminated: Record<Seat, boolean>,
): boolean {
  for (let fr = 0; fr < BOARD_SIZE; fr++) {
    for (let fc = 0; fc < BOARD_SIZE; fc++) {
      const p = board[fr][fc]
      if (!p || p.owner === seat || eliminated[p.owner]) continue
      for (const m of generateMoves(board, fr, fc)) {
        if (m.row === r && m.col === c) return true
      }
    }
  }
  return false
}

/** seat が王手されているか */
export function isInCheck(
  board: Board,
  seat: Seat,
  eliminated: Record<Seat, boolean>,
): boolean {
  const k = findKing(board, seat)
  if (!k) return false
  return isSquareAttacked(board, k[0], k[1], seat, eliminated)
}

/** seat の王に王手をかけている「生存」プレイヤーの集合（勝者の特定に使う） */
export function checkingSeats(
  board: Board,
  seat: Seat,
  eliminated: Record<Seat, boolean>,
): Seat[] {
  const k = findKing(board, seat)
  if (!k) return []
  const set = new Set<Seat>()
  for (let fr = 0; fr < BOARD_SIZE; fr++) {
    for (let fc = 0; fc < BOARD_SIZE; fc++) {
      const p = board[fr][fc]
      if (!p || p.owner === seat || eliminated[p.owner]) continue
      for (const m of generateMoves(board, fr, fc)) {
        if (m.row === k[0] && m.col === k[1]) {
          set.add(p.owner)
          break
        }
      }
    }
  }
  return [...set]
}

/** 盤面のごく軽量な複製（駒オブジェクトは共有。位置だけ動かす用） */
function cloneBoard(board: Board): Board {
  return board.map((row) => row.slice())
}

/**
 * (fromR,fromC) の駒の合法手。擬似合法手のうち、指した後に自分の王が
 * 王手されたままになる手を除外する（＝着手の合法性）。
 */
export function legalMoves(
  board: Board,
  fromR: number,
  fromC: number,
  eliminated: Record<Seat, boolean>,
): Move[] {
  const piece = board[fromR][fromC]
  if (!piece) return []
  const seat = piece.owner
  const out: Move[] = []
  for (const m of generateMoves(board, fromR, fromC)) {
    const nb = cloneBoard(board)
    nb[m.row][m.col] = piece
    nb[fromR][fromC] = null
    // 成り有無は自玉の安全性に影響しないので未成りのまま判定してよい
    if (!isInCheck(nb, seat, eliminated)) out.push(m)
  }
  return out
}

/** seat が type を (r,c) に「合法に」打てるか（打った後に自玉が王手にならない） */
export function isLegalDrop(
  board: Board,
  seat: Seat,
  type: PieceType,
  r: number,
  c: number,
  eliminated: Record<Seat, boolean>,
): boolean {
  if (!canDrop(board, seat, type, r, c)) return false
  const nb = cloneBoard(board)
  nb[r][c] = { type, owner: seat, promoted: false }
  return !isInCheck(nb, seat, eliminated)
}

/** seat に合法手（盤上の指し手 or 持ち駒打ち）が 1 つでもあるか */
export function hasAnyLegalMove(
  board: Board,
  seat: Seat,
  hand: Hand,
  eliminated: Record<Seat, boolean>,
): boolean {
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const p = board[r][c]
      if (p && p.owner === seat && legalMoves(board, r, c, eliminated).length > 0) {
        return true
      }
    }
  }
  for (const type of Object.keys(hand) as PieceType[]) {
    if ((hand[type] ?? 0) <= 0) continue
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (isLegalDrop(board, seat, type, r, c, eliminated)) return true
      }
    }
  }
  return false
}

/** 詰み：王手されていて、かつ合法手が 1 つも無い */
export function isCheckmated(
  board: Board,
  seat: Seat,
  hand: Hand,
  eliminated: Record<Seat, boolean>,
): boolean {
  return (
    isInCheck(board, seat, eliminated) &&
    !hasAnyLegalMove(board, seat, hand, eliminated)
  )
}
