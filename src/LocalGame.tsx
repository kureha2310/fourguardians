// ローカル同卓モード（1画面で4人が順に指す）。名前入力＋ランダム配置のセットアップ付き。

import { useState } from 'react'
import GameBoard from './GameBoard'
import { createInitialState, type GameState, type Seat, type WinRule } from './game'

const RULE_LABEL: Record<WinRule, string> = {
  first: '案A 早抜け（誰かを詰ませたら勝ち）',
  survivor: '案B 生き残り（最後の1人が勝ち）',
}

const PLACE_ORDER: Seat[] = ['south', 'west', 'north', 'east']
const DEFAULT_NAMES = ['プレイヤー1', 'プレイヤー2', 'プレイヤー3', 'プレイヤー4']

type SeatNames = Record<Seat, string>

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default function LocalGame({ onExit }: { onExit: () => void }) {
  const [phase, setPhase] = useState<'setup' | 'playing'>('setup')
  const [nameInputs, setNameInputs] = useState<string[]>(DEFAULT_NAMES)
  const [setupRule, setSetupRule] = useState<WinRule>('first')
  const [names, setNames] = useState<SeatNames>({
    south: DEFAULT_NAMES[0],
    west: DEFAULT_NAMES[1],
    north: DEFAULT_NAMES[2],
    east: DEFAULT_NAMES[3],
  })
  const [game, setGame] = useState<GameState>(() => createInitialState('first'))
  const [view, setView] = useState<Seat>('south')

  function startGame(random: boolean) {
    const filled = nameInputs.map((n, i) => n.trim() || `プレイヤー${i + 1}`)
    const order = random ? shuffle(filled) : filled
    const assigned = {} as SeatNames
    PLACE_ORDER.forEach((seat, i) => {
      assigned[seat] = order[i]
    })
    setNames(assigned)
    setGame(createInitialState(setupRule))
    setView('south')
    setPhase('playing')
  }

  function restart() {
    setGame(createInitialState(game.rule))
  }

  if (phase === 'setup') {
    return (
      <div className="app">
        <header>
          <h1>四神将棋（ローカル同卓）</h1>
        </header>

        <div className="setup">
          <section className="setup-block">
            <h2>勝敗ルール</h2>
            <div className="rule-switch">
              {(Object.keys(RULE_LABEL) as WinRule[]).map((rule) => (
                <button
                  key={rule}
                  className={rule === setupRule ? 'active' : ''}
                  onClick={() => setSetupRule(rule)}
                >
                  {RULE_LABEL[rule]}
                </button>
              ))}
            </div>
          </section>

          <section className="setup-block">
            <h2>参加者の名前</h2>
            <div className="name-inputs">
              {nameInputs.map((n, i) => (
                <label key={i} className="name-row">
                  <span className="name-no">{i + 1}</span>
                  <input
                    type="text"
                    value={n}
                    maxLength={12}
                    placeholder={`プレイヤー${i + 1}`}
                    onChange={(e) => {
                      const next = [...nameInputs]
                      next[i] = e.target.value
                      setNameInputs(next)
                    }}
                  />
                </label>
              ))}
            </div>
          </section>

          <div className="setup-actions">
            <button className="start random" onClick={() => startGame(true)}>
              🎲 ランダム配置で開始
            </button>
            <button className="start" onClick={() => startGame(false)}>
              入力順で開始
            </button>
            <button className="link-btn" onClick={onExit}>
              ← モード選択に戻る
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <header>
        <div className="topbar">
          <h1>四神将棋</h1>
          <span className="rule-pill">{game.rule === 'first' ? '案A 早抜け' : '案B 生き残り'}</span>
          <div className="topbar-actions">
            <button onClick={restart}>最初から</button>
            <button onClick={() => setPhase('setup')}>メンバー変更</button>
            <button onClick={onExit}>モード選択</button>
          </div>
        </div>
      </header>

      <GameBoard
        game={game}
        names={names}
        view={view}
        setView={setView}
        controllable={true}
        onCommit={setGame}
        resultActions={
          <>
            <button className="promote" onClick={restart}>
              もう一度
            </button>
            <button onClick={() => setPhase('setup')}>メンバー変更</button>
          </>
        }
      />
    </div>
  )
}
