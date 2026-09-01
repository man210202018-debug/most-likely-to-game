import { useState } from 'react'
import Background from './components/Background'
import Home from './components/Home'
import MltGame from './components/MltGame'
import TodGame from './components/TodGame'

export default function App() {
  const [game, setGame] = useState(null) // 'mlt' | 'tod' | null

  return (
    <div dir="rtl" className="font-tajawal">
      <Background />
      <div className="relative z-10">
        {game === null && <Home onSelect={setGame} />}
        {game === 'mlt' && <MltGame onBack={() => setGame(null)} />}
        {game === 'tod' && <TodGame onBack={() => setGame(null)} />}
      </div>
    </div>
  )
}
