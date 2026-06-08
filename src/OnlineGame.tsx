// オンライン対戦モード（Firebase RTDB 同期）。
// 入口（名前＋部屋作成/参加）→ ロビー（参加者リアルタイム表示）→ 対局（自席を手前固定・自分の手番だけ操作可）。

import { useEffect, useMemo, useState } from 'react'
import GameBoard from './GameBoard'
import { type Seat, type WinRule } from './game'
import { isFirebaseConfigured } from './firebase'
import {
  createRoom,
  generateRoomCode,
  getPlayerId,
  getSavedName,
  joinRoom,
  leaveRoom,
  pushState,
  restartGame,
  roomExists,
  saveName,
  setRule,
  setupPresence,
  startGame,
  subscribeRoom,
  type RoomSnapshot,
} from './room'

const RULE_LABEL: Record<WinRule, string> = {
  first: '案A 早抜け',
  survivor: '案B 生き残り',
}

export default function OnlineGame({ onExit }: { onExit: () => void }) {
  const playerId = useMemo(getPlayerId, [])
  const [name, setName] = useState(getSavedName())
  const [code, setCode] = useState<string | null>(null)
  const [joinInput, setJoinInput] = useState('')
  const [snap, setSnap] = useState<RoomSnapshot | null>(null)
  const [view, setView] = useState<Seat>('south')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // URL の ?room= があれば参加コード欄に反映
  useEffect(() => {
    const r = new URLSearchParams(location.search).get('room')
    if (r) setJoinInput(r.toUpperCase())
  }, [])

  // 部屋に入ったら購読＋presence
  useEffect(() => {
    if (!code) return
    setupPresence(code, playerId)
    const unsub = subscribeRoom(code, setSnap)
    return () => unsub()
  }, [code, playerId])

  const meta = snap?.meta ?? null
  const players = snap?.players ?? {}
  const state = snap?.state ?? null
  const me = players[playerId]
  const mySeat = me?.seat ?? null
  const isHost = meta?.hostId === playerId
  const playerCount = Object.keys(players).length

  // 対局に入ったら自席を手前に
  useEffect(() => {
    if (meta?.phase === 'playing' && mySeat) setView(mySeat)
  }, [meta?.phase, mySeat])

  const seatNames = useMemo(() => {
    const n: Record<Seat, string> = { south: '—', west: '—', north: '—', east: '—' }
    for (const p of Object.values(players)) {
      if (p.seat) n[p.seat] = p.name
    }
    return n
  }, [players])

  function setRoomUrl(c: string | null) {
    const url = new URL(location.href)
    if (c) url.searchParams.set('room', c)
    else url.searchParams.delete('room')
    history.replaceState(null, '', url.toString())
  }

  async function handleCreate() {
    if (!name.trim()) return setError('名前を入力してください')
    setBusy(true)
    setError(null)
    try {
      saveName(name.trim())
      const c = generateRoomCode()
      await createRoom(c, playerId, name.trim(), 'first')
      setRoomUrl(c)
      setCode(c)
    } catch (e) {
      setError(String((e as Error).message ?? e))
    } finally {
      setBusy(false)
    }
  }

  async function handleJoin() {
    if (!name.trim()) return setError('名前を入力してください')
    const c = joinInput.trim().toUpperCase()
    if (!c) return setError('部屋コードを入力してください')
    setBusy(true)
    setError(null)
    try {
      if (!(await roomExists(c))) {
        setError('その部屋は見つかりませんでした')
        return
      }
      saveName(name.trim())
      await joinRoom(c, playerId, name.trim())
      setRoomUrl(c)
      setCode(c)
    } catch (e) {
      setError(String((e as Error).message ?? e))
    } finally {
      setBusy(false)
    }
  }

  async function handleLeave() {
    if (code) await leaveRoom(code, playerId).catch(() => {})
    setRoomUrl(null)
    setCode(null)
    setSnap(null)
  }

  // ---- 入口（未入室） ----
  if (!code) {
    return (
      <div className="app">
        <header>
          <h1>四神将棋（オンライン）</h1>
        </header>
        <div className="setup">
          {!isFirebaseConfigured && (
            <p className="error-box">Firebase が未設定です（.env.local を確認してください）。</p>
          )}
          <section className="setup-block">
            <h2>あなたの名前</h2>
            <input
              className="name-solo"
              type="text"
              value={name}
              maxLength={12}
              placeholder="名前"
              onChange={(e) => setName(e.target.value)}
            />
          </section>

          <section className="setup-block">
            <h2>部屋</h2>
            <div className="setup-actions">
              <button className="start random" disabled={busy} onClick={handleCreate}>
                ＋ 新しい部屋を作る
              </button>
              <div className="join-row">
                <input
                  type="text"
                  value={joinInput}
                  maxLength={6}
                  placeholder="部屋コード"
                  onChange={(e) => setJoinInput(e.target.value.toUpperCase())}
                />
                <button className="start" disabled={busy} onClick={handleJoin}>
                  参加
                </button>
              </div>
            </div>
          </section>

          {error && <p className="error-box">{error}</p>}
          <button className="link-btn" onClick={onExit}>
            ← モード選択に戻る
          </button>
        </div>
      </div>
    )
  }

  // 部屋に入ったがデータ未取得
  if (!snap) {
    return <div className="app"><p>接続中…</p></div>
  }
  if (!snap.exists) {
    return (
      <div className="app">
        <p>この部屋は存在しないか、閉じられました。</p>
        <button className="link-btn" onClick={handleLeave}>← 戻る</button>
      </div>
    )
  }

  const shareUrl = `${location.origin}${location.pathname}?room=${code}`

  // ---- ロビー ----
  if (meta?.phase === 'lobby') {
    const sorted = Object.entries(players).sort((a, b) => a[1].joinedAt - b[1].joinedAt)
    return (
      <div className="app">
        <header>
          <h1>ロビー</h1>
        </header>
        <div className="setup">
          <section className="setup-block">
            <h2>部屋コード</h2>
            <div className="room-code">
              <span className="code">{code}</span>
              <button
                className="link-btn"
                onClick={() => navigator.clipboard?.writeText(shareUrl)}
              >
                招待リンクをコピー
              </button>
            </div>
          </section>

          <section className="setup-block">
            <h2>参加者（{playerCount} / 4）</h2>
            <ul className="player-list">
              {sorted.map(([pid, p]) => (
                <li key={pid} className={p.online ? '' : 'offline'}>
                  <span className={`dot${p.online ? ' on' : ''}`} />
                  {p.name}
                  {pid === meta.hostId && <span className="tag host">ホスト</span>}
                  {pid === playerId && <span className="tag me">あなた</span>}
                </li>
              ))}
            </ul>
          </section>

          {isHost ? (
            <section className="setup-block">
              <h2>勝敗ルール</h2>
              <div className="rule-switch">
                {(Object.keys(RULE_LABEL) as WinRule[]).map((rule) => (
                  <button
                    key={rule}
                    className={rule === meta.rule ? 'active' : ''}
                    onClick={() => code && setRule(code, rule)}
                  >
                    {RULE_LABEL[rule]}
                  </button>
                ))}
              </div>
              <div className="setup-actions">
                <button
                  className="start random"
                  disabled={playerCount !== 4}
                  onClick={() => code && startGame(code, players, meta.rule)}
                >
                  {playerCount === 4 ? '🎮 対局開始（席はランダム）' : `あと ${4 - playerCount} 人`}
                </button>
              </div>
            </section>
          ) : (
            <p className="wait-note">
              ホストの開始を待っています…（ルール：{RULE_LABEL[meta.rule]}）
            </p>
          )}

          <button className="link-btn" onClick={handleLeave}>
            ← 退出する
          </button>
        </div>
      </div>
    )
  }

  // ---- 対局（playing / finished） ----
  if (!state) {
    return <div className="app"><p>対局を準備中…</p></div>
  }

  const myTurn = !!mySeat && state.turn === mySeat && !state.result

  return (
    <div className="app">
      <header>
        <div className="topbar">
          <h1>四神将棋</h1>
          <span className="rule-pill">{RULE_LABEL[state.rule]}</span>
          <span className="rule-pill code-pill">部屋 {code}</span>
          <div className="topbar-actions">
            {isHost && state.result && (
              <button onClick={() => code && restartGame(code, state.rule)}>再戦</button>
            )}
            <button onClick={handleLeave}>退出</button>
          </div>
        </div>
      </header>

      <GameBoard
        game={state}
        names={seatNames}
        view={view}
        setView={setView}
        controllable={myTurn}
        onCommit={(next) => code && void pushState(code, next)}
        turnNote={
          mySeat ? (
            <span className="turn-note">{myTurn ? '（あなたの番）' : '（あなたは ' + seatNames[mySeat] + '）'}</span>
          ) : (
            <span className="turn-note">（観戦中）</span>
          )
        }
        resultActions={
          <>
            {isHost && (
              <button className="promote" onClick={() => code && restartGame(code, state.rule)}>
                再戦
              </button>
            )}
            <button onClick={handleLeave}>退出</button>
          </>
        }
      />
    </div>
  )
}
