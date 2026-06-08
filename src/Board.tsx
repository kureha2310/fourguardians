import type { CSSProperties } from 'react'
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
  /** 各陣の表示名（セットアップで入力＆配置） */
  names: Record<Seat, string>
  view: Seat
  selection: Selection
  targets: Set<string>
  /** 王手されている現手番の王の位置（ハイライト用） */
  checkKing: { row: number; col: number } | null
  onCellClick: (row: number, col: number) => void
  onHandClick: (seat: Seat, type: PieceType) => void
}

// 持ち駒：盤(11×11)の十字の空き四隅へ絶対配置（内側の角にアンカーし外側へ伸びる）。
// slot = quarterDiff(seat, view)（0=手前,1=左,2=上,3=右）。
const C9 = 'calc(var(--cell) * 9)'
const KOMADAI_POS: Record<number, CSSProperties> = {
  0: { left: C9, top: C9 }, // 手前 → 右下
  1: { right: C9, top: C9 }, // 左 → 左下
  2: { right: C9, bottom: C9 }, // 上 → 左上
  3: { left: C9, bottom: C9 }, // 右 → 右上
}

// 名前：各プレイヤーの玉の下＝自陣の外側中央（盤の縁のすぐ外）に絶対配置。
const B = 'calc(var(--cell) * 11)'
const NAME_POS: Record<number, CSSProperties> = {
  0: { left: '50%', top: B, transform: 'translate(-50%, 6px)' }, // 手前 → 盤の下・中央
  1: { top: '50%', left: 0, transform: 'translate(calc(-100% - 6px), -50%)' }, // 左 → 盤の左・中央
  2: { left: '50%', top: 0, transform: 'translate(-50%, calc(-100% - 6px))' }, // 上 → 盤の上・中央
  3: { top: '50%', left: B, transform: 'translate(6px, -50%)' }, // 右 → 盤の右・中央
}

// 持ち駒の表示順
const HAND_ORDER: PieceType[] = ['R', 'B', 'G', 'S', 'N', 'L', 'P']

// 駒種 → 画像ファイル名（public/pieces 配下）。成り駒は _p（金・王は成らない）。
const PIECE_IMG: Record<PieceType, string> = {
  P: 'pawn',
  L: 'lance',
  N: 'knight',
  S: 'silver',
  G: 'gold',
  B: 'bishop',
  R: 'rook',
  K: 'king',
}

function pieceSrc(type: PieceType, promoted: boolean): string {
  const suffix = promoted && type !== 'G' && type !== 'K' ? '_p' : ''
  return `${import.meta.env.BASE_URL}pieces/${PIECE_IMG[type]}${suffix}.png`
}

function PieceTile({
  piece,
  view,
  eliminated,
}: {
  piece: Piece
  view: Seat
  eliminated: boolean
}) {
  const deg = quarterDiff(piece.owner, view) * 90
  const accent = SEAT_INFO[piece.owner].accent
  // 所有者が一目で分かるよう accent 色のふちどり。脱落者は灰色＋半透明。
  const filter = eliminated
    ? 'grayscale(0.9) opacity(0.5)'
    : `drop-shadow(0 0 1.5px ${accent}) drop-shadow(0 0 1.5px ${accent})`
  return (
    <img
      className="piece"
      src={pieceSrc(piece.type, piece.promoted)}
      alt={KANJI[piece.type]}
      draggable={false}
      style={{ transform: `rotate(${deg}deg)`, filter }}
    />
  )
}

export default function Board({
  game,
  names,
  view,
  selection,
  targets,
  checkKing,
  onCellClick,
  onHandClick,
}: BoardProps) {
  const { board, hands, turn, eliminated } = game

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
      const isCheck = checkKing != null && checkKing.row === r && checkKing.col === c
      const cls = `cell${isSel ? ' sel' : ''}${isTarget ? (piece ? ' target-capture' : ' target') : ''}${isCheck ? ' in-check' : ''}`

      cells.push(
        <div
          key={key}
          className={cls}
          style={{ background: bg }}
          onClick={() => onCellClick(r, c)}
        >
          {piece && <PieceTile piece={piece} view={view} eliminated={eliminated[piece.owner]} />}
        </div>,
      )
    }
  }

  return (
    <div className="table">
      <div className="board">{cells}</div>


      {TURN_ORDER.map((seat) => {
        const slot = quarterDiff(seat, view)
        const info = SEAT_INFO[seat]
        const isOut = eliminated[seat]
        return (
          <div
            key={`name-${seat}`}
            className={`seat-name${seat === turn ? ' turn' : ''}${isOut ? ' eliminated' : ''}`}
            style={{ ...NAME_POS[slot], color: info.accent }}
          >
            {names[seat]}
            {seat === turn && <span className="turn-badge">手番</span>}
            {isOut && <span className="out-badge">脱落</span>}
          </div>
        )
      })}

      {TURN_ORDER.map((seat) => {
        const slot = quarterDiff(seat, view)
        const info = SEAT_INFO[seat]
        const hand = hands[seat]
        const isMine = seat === turn
        const isOut = eliminated[seat]
        const deg = quarterDiff(seat, view) * 90
        return (
          <div
            key={`komadai-${seat}`}
            className={`komadai${isOut ? ' eliminated' : ''}`}
            style={{ ...KOMADAI_POS[slot], background: info.tint, borderColor: info.accent }}
          >
            <div className="hand-pieces">
              {HAND_ORDER.filter((t) => (hand[t] ?? 0) > 0).map((t) => {
                const selected = isMine && selection?.kind === 'hand' && selection.type === t
                return (
                  <button
                    key={t}
                    className={`hand-piece${isMine ? ' mine' : ''}${selected ? ' sel' : ''}`}
                    disabled={!isMine}
                    onClick={() => onHandClick(seat, t)}
                  >
                    <img
                      className="hand-img"
                      src={pieceSrc(t, false)}
                      alt={KANJI[t]}
                      draggable={false}
                      style={{ transform: `rotate(${deg}deg)` }}
                    />
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
