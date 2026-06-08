// 対局UI（ローカル同卓・オンライン共通）。
// 選択／合法手ハイライト／成り選択／決着表示を内包し、
// 着手後の新しい GameState を onCommit で親に渡す（親が setGame か RTDB 書き込みを選ぶ）。

import { useMemo, useState, type ReactNode } from 'react'
import Board from './Board'
import {
  KANJI,
  SEAT_INFO,
  TURN_ORDER,
  type GameState,
  type PieceType,
  type Seat,
  type Selection,
} from './game'
import { applyDrop, applyMove } from './engine'
import { canPromote, mustPromote } from './moves'
import { findKing, isInCheck, isLegalDrop, legalMoves } from './rules'

interface PendingPromo {
  fromR: number
  fromC: number
  toR: number
  toC: number
}

interface Props {
  game: GameState
  names: Record<Seat, string>
  view: Seat
  setView: (s: Seat) => void
  /** 現在の手番をこのクライアントが操作できるか（ローカルは常に true、オンラインは自席が手番のとき） */
  controllable: boolean
  /** 着手後の新しい GameState を渡す（local: setGame / online: pushState） */
  onCommit: (next: GameState) => void
  /** 決着モーダルのボタン群（親が用意） */
  resultActions?: ReactNode
  /** 手番行に添える注記（例：「あなたの番」） */
  turnNote?: ReactNode
}

export default function GameBoard({
  game,
  names,
  view,
  setView,
  controllable,
  onCommit,
  resultActions,
  turnNote,
}: Props) {
  const [selection, setSelection] = useState<Selection>(null)
  const [pendingPromo, setPendingPromo] = useState<PendingPromo | null>(null)

  const targets = useMemo(() => {
    const set = new Set<string>()
    if (!selection || game.result) return set
    if (selection.kind === 'board') {
      for (const m of legalMoves(game.board, selection.row, selection.col, game.eliminated)) {
        set.add(`${m.row}-${m.col}`)
      }
    } else {
      for (let r = 0; r < 11; r++) {
        for (let c = 0; c < 11; c++) {
          if (isLegalDrop(game.board, game.turn, selection.type, r, c, game.eliminated)) {
            set.add(`${r}-${c}`)
          }
        }
      }
    }
    return set
  }, [selection, game])

  const checkKing = useMemo(() => {
    if (game.result || !isInCheck(game.board, game.turn, game.eliminated)) return null
    const k = findKing(game.board, game.turn)
    return k ? { row: k[0], col: k[1] } : null
  }, [game])

  function commitMove(fromR: number, fromC: number, toR: number, toC: number, promote: boolean) {
    onCommit(applyMove(game, fromR, fromC, toR, toC, promote))
    setSelection(null)
    setPendingPromo(null)
  }

  function doMove(fromR: number, fromC: number, toR: number, toC: number) {
    const piece = game.board[fromR][fromC]
    if (!piece) return
    if (canPromote(piece, fromR, fromC, toR, toC)) {
      if (mustPromote(piece, toR, toC)) {
        commitMove(fromR, fromC, toR, toC, true)
      } else {
        setPendingPromo({ fromR, fromC, toR, toC })
        setSelection(null)
      }
    } else {
      commitMove(fromR, fromC, toR, toC, false)
    }
  }

  function handleCellClick(r: number, c: number) {
    if (game.result || !controllable) return
    const piece = game.board[r][c]

    if (selection?.kind === 'hand') {
      if (targets.has(`${r}-${c}`)) {
        onCommit(applyDrop(game, selection.type, r, c))
        setSelection(null)
        return
      }
      if (piece && piece.owner === game.turn) {
        setSelection({ kind: 'board', row: r, col: c })
        return
      }
      setSelection(null)
      return
    }

    if (selection?.kind === 'board') {
      if (targets.has(`${r}-${c}`)) {
        doMove(selection.row, selection.col, r, c)
        return
      }
      if (piece && piece.owner === game.turn) {
        setSelection({ kind: 'board', row: r, col: c })
        return
      }
      setSelection(null)
      return
    }

    if (piece && piece.owner === game.turn) {
      setSelection({ kind: 'board', row: r, col: c })
    }
  }

  function handleHandClick(seat: Seat, type: PieceType) {
    if (game.result || !controllable || seat !== game.turn) return
    if (selection?.kind === 'hand' && selection.type === type) {
      setSelection(null)
    } else {
      setSelection({ kind: 'hand', type })
    }
  }

  const turnInfo = SEAT_INFO[game.turn]

  return (
    <>
      {!game.result && (
        <p className="turn-line">
          手番：<b style={{ color: turnInfo.accent }}>{names[game.turn]}</b>
          {checkKing && <span className="check-badge">王手</span>}
          {turnNote}
        </p>
      )}

      <div className="view-switch">
        <span className="view-label">手前に見る陣：</span>
        {TURN_ORDER.map((seat) => (
          <button
            key={seat}
            className={seat === view ? 'active' : ''}
            style={seat === view ? { background: SEAT_INFO[seat].accent } : undefined}
            onClick={() => setView(seat)}
          >
            {names[seat]}
            {game.eliminated[seat] && '（脱落）'}
          </button>
        ))}
      </div>

      <Board
        game={game}
        names={names}
        view={view}
        selection={selection}
        targets={targets}
        checkKing={checkKing}
        onCellClick={handleCellClick}
        onHandClick={handleHandClick}
      />

      {pendingPromo &&
        (() => {
          const p = game.board[pendingPromo.fromR][pendingPromo.fromC]
          const { fromR, fromC, toR, toC } = pendingPromo
          return (
            <div className="modal-overlay">
              <div className="modal">
                <p>
                  <b>{p && KANJI[p.type]}</b> を成りますか？
                </p>
                <div className="modal-buttons">
                  <button className="promote" onClick={() => commitMove(fromR, fromC, toR, toC, true)}>
                    成る
                  </button>
                  <button onClick={() => commitMove(fromR, fromC, toR, toC, false)}>成らず</button>
                </div>
              </div>
            </div>
          )
        })()}

      {game.result && (
        <div className="modal-overlay">
          <div className="modal">
            <p className="result-winner" style={{ color: SEAT_INFO[game.result.winner].accent }}>
              {names[game.result.winner]} の勝ち！
            </p>
            <p className="result-reason">{resultReason(game, names)}</p>
            <div className="modal-buttons">{resultActions}</div>
          </div>
        </div>
      )}
    </>
  )
}

function resultReason(game: GameState, names: Record<Seat, string>): string {
  const { result } = game
  if (!result) return ''
  if (result.reason === 'survivor') return '最後の 1 人になりました'
  const loser = result.loser ? names[result.loser] : ''
  return result.reason === 'checkmate' ? `${loser} を詰ませました` : `${loser} が手詰まりになりました`
}
