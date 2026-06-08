// 四神将棋 — 状態遷移（指し手の適用）。すべて純粋関数（新しい state を返す）。

import {
  liveSeats,
  nextLiveSeat,
  type GameState,
  type PieceType,
  type Seat,
} from './game'
import { checkingSeats, hasAnyLegalMove, isInCheck } from './rules'

/** 盤上の駒を移動。取った駒は手番側の持ち駒へ（未成りに戻す）。 */
export function applyMove(
  state: GameState,
  fromR: number,
  fromC: number,
  toR: number,
  toC: number,
  promote: boolean,
): GameState {
  if (state.result) return state // 決着後は何もしない
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
  return finalize(next, state.turn)
}

/** 持ち駒を打つ。 */
export function applyDrop(
  state: GameState,
  type: PieceType,
  toR: number,
  toC: number,
): GameState {
  if (state.result) return state // 決着後は何もしない
  const next: GameState = structuredClone(state)
  const hand = next.hands[state.turn]
  const count = hand[type] ?? 0
  if (count <= 0 || next.board[toR][toC]) return state

  if (count === 1) delete hand[type]
  else hand[type] = count - 1

  next.board[toR][toC] = { type, owner: state.turn, promoted: false }
  return finalize(next, state.turn)
}

/**
 * 着手後の後処理：手番を次の生存者に送り、その人の詰み／手詰まりを判定する。
 * - 詰みは「詰まされる人の手番」で判定する方針（間の他陣は割り込んで助けられる）。
 * - 脱落者の駒は王手をかけない（rules 側で考慮済み）。
 *
 * 案A(first)    ：次の手番者が指せない（詰み or 手詰まり）なら即決着。勝者は王手をかけている陣。
 * 案B(survivor) ：指せない陣を脱落させて手番から外し、残り 1 人になったらその人の勝ち。
 */
function finalize(next: GameState, mover: Seat): GameState {
  let candidate = nextLiveSeat(mover, next.eliminated)

  if (next.rule === 'first') {
    if (!hasAnyLegalMove(next.board, candidate, next.hands[candidate], next.eliminated)) {
      const inCheck = isInCheck(next.board, candidate, next.eliminated)
      next.result = {
        winner: pickWinner(next, candidate, mover, inCheck),
        loser: candidate,
        reason: inCheck ? 'checkmate' : 'stalemate',
      }
    }
    next.turn = candidate
    return next
  }

  // 案B：指せない陣を脱落させながら、指せる生存者に手番が回るまで進める
  for (;;) {
    const live = liveSeats(next.eliminated)
    if (live.length <= 1) {
      next.result = { winner: live[0], reason: 'survivor' }
      next.turn = live[0] ?? mover
      return next
    }
    if (hasAnyLegalMove(next.board, candidate, next.hands[candidate], next.eliminated)) {
      next.turn = candidate
      return next
    }
    // candidate は詰み or 手詰まり → 脱落（駒は盤上に残す）
    next.eliminated[candidate] = true
    candidate = nextLiveSeat(candidate, next.eliminated)
  }
}

/**
 * 案A で詰み／手詰まりになった loser に対する勝者を決める。
 * 王手をかけている陣が 1 つならその陣。複数なら直前に指した mover を優先。
 * 手詰まり（王手なし）なら、その局面を作った mover。
 */
function pickWinner(
  next: GameState,
  loser: Seat,
  mover: Seat,
  inCheck: boolean,
): Seat {
  if (inCheck) {
    const checkers = checkingSeats(next.board, loser, next.eliminated)
    if (checkers.length === 1) return checkers[0]
    if (checkers.includes(mover)) return mover
    if (checkers.length > 0) return checkers[0]
  }
  return mover
}
