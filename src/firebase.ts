// Firebase 初期化。設定は .env.local の VITE_FIREBASE_* から読む（公開キーなので埋め込みOK）。
// 設定が無ければ db=null・isFirebaseConfigured=false となり、UI 側で案内を出す。
import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getDatabase, type Database } from 'firebase/database'

const cfg = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
}

/** Realtime Database を使うのに最低限必要な値が揃っているか */
export const isFirebaseConfigured = Boolean(cfg.apiKey && cfg.databaseURL)

let app: FirebaseApp | null = null
let database: Database | null = null
if (isFirebaseConfigured) {
  app = initializeApp(cfg)
  database = getDatabase(app)
}

export const db = database
