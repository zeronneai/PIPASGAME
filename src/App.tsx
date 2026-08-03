import { lazy, Suspense, useState } from 'react'
import { useGameStore } from './state/gameStore'
import { CameraDragArea } from './ui/CameraDragArea'
import { ClockChip } from './ui/ClockChip'
import { ContextButton } from './ui/ContextButton'
import { DebugOverlay } from './ui/DebugOverlay'
import { DriveControls } from './ui/DriveControls'
import { HoseMinigame } from './ui/HoseMinigame'
import { HUD } from './ui/HUD'
import { NoticeToast } from './ui/NoticeToast'
import { OfferPanel } from './ui/OfferPanel'
import { OrdersHUD } from './ui/OrdersHUD'
import { OrientationGate } from './ui/OrientationGate'
import { StatusBar } from './ui/StatusBar'
import { RefillMeter } from './ui/RefillMeter'
import { TapToStart } from './ui/TapToStart'
import { TuningDrawer } from './ui/TuningDrawer'
import { VirtualJoystick } from './ui/VirtualJoystick'

/*
 * El motor 3D (three + fiber + rapier) pesa ~1 MB gzip, así que va en chunks
 * aparte y el chunk inicial queda solo con React y el HUD. La descarga
 * arranca ya mismo (import() a nivel de módulo), en paralelo con la pantalla
 * de "Toca para empezar", no cuando el jugador toca.
 */
const scenePromise = import('./game/Scene')
const Scene = lazy(() => scenePromise.then((m) => ({ default: m.Scene })))

export default function App() {
  const [started, setStarted] = useState(false)
  // El modo cambia poco, así que sí puede re-renderizar el HUD.
  const mode = useGameStore((s) => s.mode)

  return (
    <>
      <Suspense fallback={null}>
        <Scene />
      </Suspense>
      {started && (
        <>
          {/* Lo que se lee va en el HUD; lo que se toca, aparte */}
          <HUD />
          <StatusBar />
          <ClockChip />
          <OrdersHUD />
          {mode === 'ON_FOOT' ? <VirtualJoystick /> : <DriveControls />}
          <CameraDragArea />
          <ContextButton />
          <RefillMeter />
          <NoticeToast />
          {/* Encima de todo lo jugable: aceptar un pedido es LA decisión. */}
          <OfferPanel />
          <HoseMinigame />
          <DebugOverlay />
          <TuningDrawer />
        </>
      )}
      {!started && <TapToStart onStart={() => setStarted(true)} />}
      <OrientationGate />
    </>
  )
}
