import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vite 設定は Node 上で実行されるので process が使える。
// @types/node を足さずに型だけ最小宣言する（コンテナ再ビルド回避）。
declare const process: { env: Record<string, string | undefined> }

// Docker コンテナ内で動かすとき（compose が VITE_DOCKER=1 を設定）だけ、
// ファイル監視をポーリングにする。Windows のバインドマウントでは
// ネイティブのファイル変更通知がコンテナに伝わらず HMR が効かないため。
const inDocker = !!process.env.VITE_DOCKER

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: inDocker ? { watch: { usePolling: true, interval: 100 } } : {},
})
