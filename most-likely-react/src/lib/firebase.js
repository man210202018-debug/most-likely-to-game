import { initializeApp } from 'firebase/app'
import { getDatabase, ref, set, update, get, onValue, onDisconnect, remove } from 'firebase/database'

const firebaseConfig = {
  apiKey: 'AIzaSyDKTMTowQyXi-pwWlinIikbHXRq1s9AfG0',
  authDomain: 'couples-game-ce5e8.firebaseapp.com',
  projectId: 'couples-game-ce5e8',
  storageBucket: 'couples-game-ce5e8.firebasestorage.app',
  messagingSenderId: '677433397286',
  appId: '1:677433397286:web:ea7a5fdab08b73e55b96e7',
}

const app = initializeApp(firebaseConfig)
export const db = getDatabase(app)

export const dbRef = ref
export const dbGet = get
export const dbSet = set
export const dbUpdate = update
export const dbOnValue = onValue
export const dbOnDisconnect = onDisconnect
export const dbRemove = remove

export function genCode() {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export function shuffle(a) {
  const s = [...a]
  for (let i = s.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[s[i], s[j]] = [s[j], s[i]]
  }
  return s
}
