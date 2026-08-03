import { useState } from 'react'
import { Scene } from './game/Scene'
import { useGameStore } from './state/gameStore'
import { CameraDragArea } from './ui/CameraDragArea'
import { ContextButton } from './ui/ContextButton'
import { DebugOverlay } from './ui/DebugOverlay'
import { DriveControls } from './ui/DriveControls'
import { HUD } from './ui/HUD'
import { OrientationGate } from './ui/OrientationGate'
import { TapToStart } from './ui/TapToStart'
import { TuningDrawer } from './ui/TuningDrawer'
import { VirtualJoystick } from './ui/VirtualJoystick'

export default function App() {
  const [started, setStarted] = useState(false)
  // El modo cambia poco, así que sí puede re-renderizar el HUD.
  const mode = useGameStore((s) => s.mode)

  return (
    <>
      <Scene />
      {started && (
        <>
          {/* Lo que se lee va en el HUD; lo que se toca, aparte */}
          <HUD />
          {mode === 'ON_FOOT' ? <VirtualJoystick /> : <DriveControls />}
          <CameraDragArea />
          <ContextButton />
          <DebugOverlay />
          <TuningDrawer />
        </>
      )}
      {!started && <TapToStart onStart={() => setStarted(true)} />}
      <OrientationGate />
    </>
  )
}
