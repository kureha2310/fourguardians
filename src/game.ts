// 四神将棋 — 盤とゲーム状態の定義
//
// 盤は 11×11 の十字（プラス）型。四隅の 2×2 は盤外（駒台）。
// 4 陣営は上下左右に配置され、各陣は「最奥段(7) + 歩段(7)」を持つ。
// 下(South)の陣を「正本」とし、90° ずつ回転して他の 3 陣を生成する。

export const BOARD_SIZE = 11;
export const CENTER = 5; // 0..10 の中心

/** 駒の種類（成り前） */
export type PieceType = 'P' | 'L' | 'N' | 'S' | 'G' | 'B' | 'R' | 'K';
// 歩  香  桂  銀  金  角  飛  王

/** 座席（盤上の位置）。south=手前(あなた) を基準にする。 */
export type Seat = 'south' | 'west' | 'north' | 'east';

/** 時計回りの手番順（手前 → 左 → 上 → 右） */
export const TURN_ORDER: Seat[] = ['south', 'west', 'north', 'east'];

export interface SeatInfo {
  seat: Seat;
  /** 90° 回転を何回かけて south から生成するか（座標・字の向きの両方） */
  quarterTurns: number;
  /** 表示名（暫定。あとで変更可能） */
  name: string;
  /** アクセント色 */
  accent: string;
  /** ホームマスの淡い塗り */
  tint: string;
}

export const SEAT_INFO: Record<Seat, SeatInfo> = {
  south: { seat: 'south', quarterTurns: 0, name: 'あなた', accent: '#e05a5a', tint: '#f7c9c9' },
  west: { seat: 'west', quarterTurns: 1, name: 'ざつだ…', accent: '#46a85a', tint: '#c9efcf' },
  north: { seat: 'north', quarterTurns: 2, name: 'hunter', accent: '#8a8a8a', tint: '#dcdcdc' },
  east: { seat: 'east', quarterTurns: 3, name: 'kisaragi', accent: '#5a6fd0', tint: '#cdd6f7' },
};

/** 駒 → 漢字 */
export const KANJI: Record<PieceType, string> = {
  P: '歩',
  L: '香',
  N: '桂',
  S: '銀',
  G: '金',
  B: '角',
  R: '飛',
  K: '王',
};

export interface Piece {
  type: PieceType;
  owner: Seat;
  promoted: boolean;
}

/** board[row][col] = 駒 or null。盤外（隅）も null。 */
export type Board = (Piece | null)[][];

/** (row,col) が盤上（十字型の内側）かどうか */
export function isOnBoard(row: number, col: number): boolean {
  if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) return false;
  // 縦の腕（col 2..8）か 横の腕（row 2..8）のいずれかなら盤上
  const inVerticalArm = col >= 2 && col <= 8;
  const inHorizontalArm = row >= 2 && row <= 8;
  return inVerticalArm || inHorizontalArm;
}

/** 中央 3×3 の特殊ゾーン（rows/cols 4..6） */
export function isCenterZone(row: number, col: number): boolean {
  return row >= 4 && row <= 6 && col >= 4 && col <= 6;
}

/** マスがどの陣のホームか（なければ null） */
export function homeSeatOf(row: number, col: number): Seat | null {
  if (!isOnBoard(row, col)) return null;
  if (row >= 9 && col >= 2 && col <= 8) return 'south'; // 下 2 段
  if (row <= 1 && col >= 2 && col <= 8) return 'north'; // 上 2 段
  if (col <= 1 && row >= 2 && row <= 8) return 'west'; // 左 2 列
  if (col >= 9 && row >= 2 && row <= 8) return 'east'; // 右 2 列
  return null;
}

/** (row,col) を中心まわりに 90° 時計回りで times 回 回転 */
export function rotateCW(row: number, col: number, times: number): [number, number] {
  let r = row;
  let c = col;
  for (let i = 0; i < ((times % 4) + 4) % 4; i++) {
    const nr = c;
    const nc = BOARD_SIZE - 1 - r;
    r = nr;
    c = nc;
  }
  return [r, c];
}

/**
 * owner の駒・陣を view 視点で見たときの「4 分の何回転ぶんずれているか」(0..3)。
 * 0 = 手前(下), 1 = 左, 2 = 奥(上), 3 = 右。
 * owner === view なら 0（自分の陣は常に手前）。
 */
export function quarterDiff(owner: Seat, view: Seat): number {
  const d = SEAT_INFO[owner].quarterTurns - SEAT_INFO[view].quarterTurns;
  return ((d % 4) + 4) % 4;
}

/** view 視点での画面マス(dr,dc) に対応する実際の盤マス(row,col) */
export function viewToBoard(dr: number, dc: number, view: Seat): [number, number] {
  return rotateCW(dr, dc, SEAT_INFO[view].quarterTurns);
}

/** south（正本）の最奥段：col 2..8（左→右） */
const SOUTH_BACK_RANK: PieceType[] = ['N', 'G', 'R', 'K', 'S', 'B', 'L'];
// 桂 金 飛 王 銀 角 香

/** 空の盤 */
function emptyBoard(): Board {
  return Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, () => null as Piece | null),
  );
}

/** 持ち駒（種類ごとの枚数）。種類は未成りのもののみ。 */
export type Hand = Partial<Record<PieceType, number>>

/** ゲーム全体の状態 */
export interface GameState {
  board: Board
  hands: Record<Seat, Hand>
  turn: Seat
}

/** 盤クリック or 持ち駒クリックの選択状態 */
export type Selection =
  | { kind: 'board'; row: number; col: number }
  | { kind: 'hand'; type: PieceType }
  | null

/** 次の手番（時計回り）。脱落は未実装なので単純に巡回。 */
export function nextSeat(seat: Seat): Seat {
  const i = TURN_ORDER.indexOf(seat)
  return TURN_ORDER[(i + 1) % TURN_ORDER.length]
}

/** 初期ゲーム状態 */
export function createInitialState(): GameState {
  return {
    board: createInitialBoard(),
    hands: { south: {}, west: {}, north: {}, east: {} },
    turn: TURN_ORDER[0],
  }
}

/** 初期配置を生成（4 陣営すべて） */
export function createInitialBoard(): Board {
  const board = emptyBoard();

  for (const seat of TURN_ORDER) {
    const { quarterTurns } = SEAT_INFO[seat];

    // 最奥段（south では row=10, col 2..8）
    SOUTH_BACK_RANK.forEach((type, i) => {
      const [r, c] = rotateCW(10, 2 + i, quarterTurns);
      board[r][c] = { type, owner: seat, promoted: false };
    });

    // 歩段（south では row=9, col 2..8）
    for (let i = 0; i < 7; i++) {
      const [r, c] = rotateCW(9, 2 + i, quarterTurns);
      board[r][c] = { type: 'P', owner: seat, promoted: false };
    }
  }

  return board;
}
