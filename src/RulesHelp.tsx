// ルール説明（ボタン＋モーダル）。自前で開閉状態を持つので、置きたい場所に <RulesButton/> を置くだけ。
// ※ ファイル名は rules.ts（判定ロジック）との大文字小文字衝突を避けて RulesHelp.tsx。

import { useState } from 'react'

export function RulesButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button className={className ?? 'link-btn'} onClick={() => setOpen(true)}>
        📖 ルール説明
      </button>
      {open && <RulesModal onClose={() => setOpen(false)} />}
    </>
  )
}

function RulesModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="rules-modal" onClick={(e) => e.stopPropagation()}>
        <h2>四神将棋のルール</h2>

        <h3>これは何？</h3>
        <p>
          十字型の盤を4人で囲んで戦う将棋です。<b>駒の動きはふつうの将棋と同じ</b>。各駒の「前」は
          <b>盤の中央に向かう方向</b>です（自分の陣が手前に見えます）。
        </p>

        <h3>手番</h3>
        <p>
          <b>時計回り</b>（手前 → 左 → 上 → 右）に1手ずつ。脱落した人は飛ばします。
        </p>

        <h3>駒を取る・打つ</h3>
        <ul>
          <li>自分以外の<b>3人の駒はすべて取れます</b>。</li>
          <li>取った駒は<b>持ち駒</b>になり、自分の向きで空きマスに打てます。</li>
          <li>行き所のなくなる駒（最奥の歩・香・桂など）は打てません。</li>
        </ul>

        <h3>成り（昇格）</h3>
        <ul>
          <li>
            成れる場所は <b>中央の3×3マス</b> と <b>敵陣（他の人の最奥2列）</b>。そこへ
            <b>入る・出る・中で動く</b>と成れます（任意）。
          </li>
          <li>歩・香・桂が動けなくなる場所では<b>強制的に成り</b>ます。</li>
          <li>成ると：歩・香・桂・銀 →「金」の動き／角 →「馬」／飛 →「龍」。<b>金と王は成りません</b>。</li>
        </ul>

        <h3>王手・詰み</h3>
        <ul>
          <li>自分の王が取られてしまう手は指せません。</li>
          <li>
            王手された人が<b>自分の手番までに逃げ切れなければ詰み</b>。4人いるので、
            <b>間に指す他の2人が割り込んで助けたり、王手している駒を取ったり</b>できます。
          </li>
        </ul>

        <h3>勝敗（対局開始時に選ぶ）</h3>
        <ul>
          <li><b>案A 早抜け</b>：誰かの王を詰ませたら、詰ませた人の勝ち。</li>
          <li><b>案B 生き残り</b>：詰まされたら脱落。最後の1人が勝ち。</li>
        </ul>

        <h3>脱落した人の駒（案B）</h3>
        <p>
          盤に残りますが<b>動かず、王手もしません</b>。通せんぼの壁になり、取れば持ち駒になります。
        </p>

        <div className="modal-buttons">
          <button className="promote rules-close" onClick={onClose}>
            閉じる
          </button>
        </div>
      </div>
    </div>
  )
}
