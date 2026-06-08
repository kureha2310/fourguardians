// 四神将棋 — 状態遷移（指し手の適用）。すべて純粋関数（新しい state を返す）。

import { nextSeat, type GameState, type PieceType } from './game'

/** 盤上の駒を移動。取った駒は手番側の持ち駒へ（未成りに戻す）。 */
export function applyMove(
  state: GameState,
  fromR: number,
  fromC: number,
  toR: number,
  toC: number,
  promote: boolean,
): GameState {
  const next: GameState = structuredClone(state)
  const piece = next.board[fromR][fromC]
  if (!piece) return state

  const target = next.board[toR][toC]
  if (target) {
    const t = target.type // 成り駒も基本種に戻して持ち駒へ
    const hand = next.hands[state.turn]
    hand[t] = (hand[t] ?? 0) + 1
  }

  if (promote) piece.promoted = true
  next.board[toR][toC] = piece
  next.board[fromR][fromC] = null
  next.turn = nextSeat(state.turn)
  return next
}

/** 持ち駒を打つ。 */
export function applyDrop(
  state: GameState,
  type: PieceType,
  toR: number,
  toC: number,
): GameState {
  const next: GameState = structuredClone(state)
  const hand = next.hands[state.turn]
  const count = hand[type] ?? 0
  if (count <= 0 || next.board[toR][toC]) return state

  if (count === 1) delete hand[type]
  else hand[type] = count - 1

  next.board[toR][toC] = { type, owner: state.turn, promoted: false }
  next.turn = nextSeat(state.turn)
  return next
}
