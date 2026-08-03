import { lazy, Suspense, useState } from 'react'
import { Scene } from './game/Scene'
import { useGameStore } from './state/gameStore'
import { CameraDragArea } from './ui/CameraDragArea'
import { ContextButton } from './ui/ContextButton'
import { DebugOverlay } from './ui/DebugOverlay'
import { DriveControls } from './ui/DriveControls'
import { OrientationGate } from './ui/OrientationGate'
import { StaminaBar } from './ui/StaminaBar'
import { TapToStart } from './ui/TapToStart'
import { VirtualJoystick } from './ui/VirtualJoystick'

// lazy: leva no entra al bundle de producción
const TuningPanel = import.meta.env.DEV
  ? lazy(() => import('./ui/TuningPanel'))
  : null

export default function App() {
  const [started, setStarted] = useState(false)
  // El modo cambia poco, así que sí puede re-renderizar el HUD.
  const mode = useGameStore((s) => s.mode)

  return (
    <>
      <Scene />
      {started && (
        <>
          {mode === 'ON_FOOT' ? (
            <>
              <VirtualJoystick />
              <StaminaBar />
            </>
          ) : (
            <DriveControls />
          )}
          <CameraDragArea />
          <ContextButton />
          <DebugOverlay />
          {TuningPanel && (
            <Suspense fallback={null}>
              <TuningPanel />
            </Suspense>
          )}
        </>
      )}
      {!started && <TapToStart onStart={() => setStarted(true)} />}
      <OrientationGate />
    </>
  )
}
