import { useState } from 'react'
import { Scene } from './game/Scene'
import { CameraDragArea } from './ui/CameraDragArea'
import { DebugOverlay } from './ui/DebugOverlay'
import { OrientationGate } from './ui/OrientationGate'
import { TapToStart } from './ui/TapToStart'
import { VirtualJoystick } from './ui/VirtualJoystick'

export default function App() {
  const [started, setStarted] = useState(false)

  return (
    <>
      <Scene />
      {started && (
        <>
          <VirtualJoystick />
          <CameraDragArea />
          <DebugOverlay />
        </>
      )}
      {!started && <TapToStart onStart={() => setStarted(true)} />}
      <OrientationGate />
    </>
  )
}
