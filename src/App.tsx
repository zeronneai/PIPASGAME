import { lazy, Suspense, useState } from 'react'
import { Scene } from './game/Scene'
import { CameraDragArea } from './ui/CameraDragArea'
import { DebugOverlay } from './ui/DebugOverlay'
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

  return (
    <>
      <Scene />
      {started && (
        <>
          <VirtualJoystick />
          <CameraDragArea />
          <StaminaBar />
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
