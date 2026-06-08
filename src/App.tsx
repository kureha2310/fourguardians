import { useMemo, useState } from 'react'
import Board from './Board'
import {
  KANJI,
  TURN_ORDER,
  SEAT_INFO,
  createInitialState,
  type PieceType,
  type Seat,
  type Selection,
} from './game'
import { applyDrop, applyMove } from './engine'
import { canDrop, canPromote, generateMoves, mustPromote } from './moves'

interface PendingPromo {
  fromR: number
  fromC: number
  toR: number
  toC: number
}

function App() {
  const [game, setGame] = useState(() => createInitialState())
  const [view, setView] = useState<Seat>('south')
  const [selection, setSelection] = useState<Selection>(null)
  const [pendingPromo, setPendingPromo] = useState<PendingPromo | null>(null)

  // 選択中の駒／持ち駒に対する合法な移動先（"r-c" の集合）
  const targets = useMemo(() => {
    const set = new Set<string>()
    if (!selection) return set
    if (selection.kind === 'board') {
      for (const m of generateMoves(game.board, selection.row, selection.col)) {
        set.add(`${m.row}-${m.col}`)
      }
    } else {
      for (let r = 0; r < 11; r++) {
        for (let c = 0; c < 11; c++) {
          if (canDrop(game.board, game.turn, selection.type, r, c)) set.add(`${r}-${c}`)
        }
      }
    }
    return set
  }, [selection, game])

  function advanceView(turn: Seat) {
    // 手番が進んだら、その人の陣を手前に（ローカル対戦向け）
    setView(turn)
  }

  function commitMove(fromR: number, fromC: number, toR: number, toC: number, promote: boolean) {
    const next = applyMove(game, fromR, fromC, toR, toC, promote)
    setGame(next)
    setSelection(null)
    setPendingPromo(null)
    advanceView(next.turn)
  }

  function doMove(fromR: number, fromC: number, toR: number, toC: number) {
    const piece = game.board[fromR][fromC]
    if (!piece) return
    if (canPromote(piece, fromR, fromC, toR, toC)) {
      if (mustPromote(piece, toR, toC)) {
        commitMove(fromR, fromC, toR, toC, true) // 行き所がないので強制成り
      } else {
        setPendingPromo({ fromR, fromC, toR, toC }) // 成る／成らずを選んでもらう
        setSelection(null)
      }
    } else {
      commitMove(fromR, fromC, toR, toC, false)
    }
  }

  function handleCellClick(r: number, c: number) {
    const piece = game.board[r][c]

    // 持ち駒を打つモード
    if (selection?.kind === 'hand') {
      if (targets.has(`${r}-${c}`)) {
        const next = applyDrop(game, selection.type, r, c)
        setGame(next)
        setSelection(null)
        advanceView(next.turn)
        return
      }
      if (piece && piece.owner === game.turn) {
        setSelection({ kind: 'board', row: r, col: c })
        return
      }
      setSelection(null)
      return
    }

    // 盤上の駒を選択中
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

    // 未選択：自分の手番の駒なら選択
    if (piece && piece.owner === game.turn) {
      setSelection({ kind: 'board', row: r, col: c })
    }
  }

  function handleHandClick(seat: Seat, type: PieceType) {
    if (seat !== game.turn) return
    if (selection?.kind === 'hand' && selection.type === type) {
      setSelection(null)
    } else {
      setSelection({ kind: 'hand', type })
    }
  }

  function reset() {
    setGame(createInitialState())
    setSelection(null)
    setView('south')
  }

  const turnInfo = SEAT_INFO[game.turn]

  return (
    <div className="app">
      <header>
        <h1>四神将棋</h1>
        <p className="turn-line">
          手番：<b style={{ color: turnInfo.accent }}>{turnInfo.name}</b>
        </p>
        <div className="view-switch">
          <span className="view-label">手前に見る陣：</span>
          {TURN_ORDER.map((seat) => (
            <button
              key={seat}
              className={seat === view ? 'active' : ''}
              style={seat === view ? { background: SEAT_INFO[seat].accent } : undefined}
              onClick={() => setView(seat)}
            >
              {SEAT_INFO[seat].name}
            </button>
          ))}
          <button className="reset" onClick={reset}>
            最初から
          </button>
        </div>
      </header>

      <Board
        game={game}
        view={view}
        selection={selection}
        targets={targets}
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
    </div>
  )
}

export default App
