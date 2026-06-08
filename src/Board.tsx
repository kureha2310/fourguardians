import {
  BOARD_SIZE,
  KANJI,
  SEAT_INFO,
  TURN_ORDER,
  isCenterZone,
  isOnBoard,
  homeSeatOf,
  quarterDiff,
  viewToBoard,
  type GameState,
  type Piece,
  type PieceType,
  type Seat,
  type Selection,
} from './game'

interface BoardProps {
  game: GameState
  view: Seat
  selection: Selection
  targets: Set<string>
  onCellClick: (row: number, col: number) => void
  onHandClick: (seat: Seat, type: PieceType) => void
}

const NAME_POS: Record<number, { gridColumn: number; gridRow: number }> = {
  0: { gridColumn: 2, gridRow: 3 },
  1: { gridColumn: 1, gridRow: 2 },
  2: { gridColumn: 2, gridRow: 1 },
  3: { gridColumn: 3, gridRow: 2 },
}

const KOMADAI_POS: Record<number, { gridColumn: number; gridRow: number }> = {
  0: { gridColumn: 3, gridRow: 3 },
  1: { gridColumn: 1, gridRow: 3 },
  2: { gridColumn: 1, gridRow: 1 },
  3: { gridColumn: 3, gridRow: 1 },
}

// 持ち駒の表示順
const HAND_ORDER: PieceType[] = ['R', 'B', 'G', 'S', 'N', 'L', 'P']

function PieceTile({ piece, view }: { piece: Piece; view: Seat }) {
  const deg = quarterDiff(piece.owner, view) * 90
  const accent = SEAT_INFO[piece.owner].accent
  return (
    <div
      className={`piece${piece.promoted ? ' promoted' : ''}`}
      style={{ transform: `rotate(${deg}deg)`, borderColor: accent }}
    >
      {KANJI[piece.type]}
    </div>
  )
}

export default function Board({
  game,
  view,
  selection,
  targets,
  onCellClick,
  onHandClick,
}: BoardProps) {
  const { board, hands, turn } = game

  const cells = []
  for (let dr = 0; dr < BOARD_SIZE; dr++) {
    for (let dc = 0; dc < BOARD_SIZE; dc++) {
      const [r, c] = viewToBoard(dr, dc, view)
      const key = `${dr}-${dc}`

      if (!isOnBoard(r, c)) {
        cells.push(<div key={key} className="cell off" />)
        continue
      }

      let bg: string | undefined
      if (isCenterZone(r, c)) {
        bg = '#f3c6ee'
      } else {
        const home = homeSeatOf(r, c)
        bg = home ? SEAT_INFO[home].tint : '#fbf3c0'
      }

      const piece = board[r][c]
      const isSel =
        selection?.kind === 'board' && selection.row === r && selection.col === c
      const isTarget = targets.has(`${r}-${c}`)
      const cls = `cell${isSel ? ' sel' : ''}${isTarget ? (piece ? ' target-capture' : ' target') : ''}`

      cells.push(
        <div
          key={key}
          className={cls}
          style={{ background: bg }}
          onClick={() => onCellClick(r, c)}
        >
          {piece && <PieceTile piece={piece} view={view} />}
        </div>,
      )
    }
  }

  return (
    <div className="table">
      <div className="board" style={{ gridColumn: 2, gridRow: 2 }}>
        {cells}
      </div>

      {TURN_ORDER.map((seat) => {
        const slot = quarterDiff(seat, view)
        const info = SEAT_INFO[seat]
        return (
          <div
            key={`name-${seat}`}
            className={`seat-name${seat === turn ? ' turn' : ''}`}
            style={{ ...NAME_POS[slot], color: info.accent }}
          >
            {info.name}
            {seat === turn && <span className="turn-badge">手番</span>}
          </div>
        )
      })}

      {TURN_ORDER.map((seat) => {
        const slot = quarterDiff(seat, view)
        const info = SEAT_INFO[seat]
        const hand = hands[seat]
        const isMine = seat === turn
        const deg = quarterDiff(seat, view) * 90
        return (
          <div
            key={`komadai-${seat}`}
            className="komadai"
            style={{ ...KOMADAI_POS[slot], background: info.tint, borderColor: info.accent }}
          >
            <span className="komadai-label">持ち駒</span>
            <div className="hand-pieces">
              {HAND_ORDER.filter((t) => (hand[t] ?? 0) > 0).map((t) => {
                const selected = isMine && selection?.kind === 'hand' && selection.type === t
                return (
                  <button
                    key={t}
                    className={`hand-piece${isMine ? ' mine' : ''}${selected ? ' sel' : ''}`}
                    style={{ borderColor: info.accent }}
                    disabled={!isMine}
                    onClick={() => onHandClick(seat, t)}
                  >
                    <span style={{ display: 'inline-block', transform: `rotate(${deg}deg)` }}>
                      {KANJI[t]}
                    </span>
                    {(hand[t] ?? 0) > 1 && <sub className="hand-count">{hand[t]}</sub>}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
