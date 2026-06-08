import { useState } from 'react'
import LocalGame from './LocalGame'
import OnlineGame from './OnlineGame'

type Mode = 'home' | 'local' | 'online'

function App() {
  // URL に ?room= があれば、最初からオンラインの入口へ
  const [mode, setMode] = useState<Mode>(() =>
    new URLSearchParams(location.search).get('room') ? 'online' : 'home',
  )

  if (mode === 'local') return <LocalGame onExit={() => setMode('home')} />
  if (mode === 'online') return <OnlineGame onExit={() => setMode('home')} />

  return (
    <div className="app">
      <header>
        <h1>四神将棋</h1>
        <p className="turn-line">四陣営で戦う将棋バリアント</p>
      </header>
      <div className="home-menu">
        <button className="start random" onClick={() => setMode('online')}>
          🌐 オンラインで対戦
        </button>
        <button className="start" onClick={() => setMode('local')}>
          🪑 ローカル同卓（1画面で交代）
        </button>
      </div>
    </div>
  )
}

export default App
