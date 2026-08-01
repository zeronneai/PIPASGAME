import { useState } from 'react'
import { Scene } from './game/Scene'
import { OrientationGate } from './ui/OrientationGate'
import { TapToStart } from './ui/TapToStart'

export default function App() {
  const [started, setStarted] = useState(false)

  return (
    <>
      <Scene />
      {!started && <TapToStart onStart={() => setStarted(true)} />}
      <OrientationGate />
    </>
  )
}
