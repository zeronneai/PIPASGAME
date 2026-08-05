import { useGameStore } from '../state/gameStore'
import { CameraDragArea } from './CameraDragArea'
import { ClockChip } from './ClockChip'
import { ContextButton } from './ContextButton'
import { DebugOverlay } from './DebugOverlay'
import { DriveControls } from './DriveControls'
import { HoseMinigame } from './HoseMinigame'
import { HUD } from './HUD'
import { LogroSegunda } from './LogroSegunda'
import { Minimap } from './Minimap'
import { NoticeToast } from './NoticeToast'
import { OfferPanel } from './OfferPanel'
import { OrdersHUD } from './OrdersHUD'
import { RadioCallCard } from './RadioCallCard'
import { RefillMeter } from './RefillMeter'
import { RescueFade } from './RescueFade'
import { StatusBar } from './StatusBar'
import { SummaryScreen } from './SummaryScreen'
import { TallerScreen } from './TallerScreen'
import { TuningDrawer } from './TuningDrawer'
import { VirtualJoystick } from './VirtualJoystick'

/*
 * TODO EL HUD, en un solo módulo y fuera del arranque.
 *
 * Antes esto vivía en `App.tsx` con imports estáticos, así que el chunk
 * inicial cargaba las veintitantas pantallas del juego —el taller entero, el
 * minijuego de la manguera, el minimapa con la geometría de la colonia
 * detrás— para poder dibujar un botón que dice «toca para empezar». Nada de
 * esto se monta hasta que el jugador toca, y ahora tampoco se descarga hasta
 * entonces: viaja con el motor 3D, que es lo que de verdad hace falta para
 * que exista una partida.
 *
 * El árbol de abajo es el mismo de antes, en el mismo orden. El orden ES la
 * pila visual: lo que se lee arriba, lo que se toca en medio, y lo que
 * interrumpe (oferta, manguera, taller, logro, resumen) encima de lo jugable.
 */
export function GameUI() {
  // El modo cambia poco, así que sí puede re-renderizar el HUD.
  const mode = useGameStore((s) => s.mode)
  const minimapExpanded = useGameStore((s) => s.minimapExpanded)
  const tallerAbierto = useGameStore((s) => s.tallerAbierto)

  return (
    <>
      {/* Lo que se lee va en el HUD; lo que se toca, aparte */}
      <HUD />
      <StatusBar />
      <ClockChip />
      <OrdersHUD />
      <Minimap />
      {/* Con el mapa a pantalla completa, los controles de manejo se
          esconden: nadie maneja mirando el mapa. */}
      {mode === 'ON_FOOT' ? (
        <VirtualJoystick />
      ) : (
        !minimapExpanded && !tallerAbierto && <DriveControls />
      )}
      <CameraDragArea />
      <ContextButton />
      <RefillMeter />
      <RadioCallCard />
      <NoticeToast />
      {/* Encima de todo lo jugable: aceptar un pedido es LA decisión. */}
      <OfferPanel />
      <HoseMinigame />
      {/* El taller: encima de lo jugable, debajo del fin de día. */}
      <TallerScreen />
      {/* El momento del logro de la segunda: el mundo espera. */}
      <LogroSegunda />
      {/* El último de la pila jugable: cuando aparece, el día terminó. */}
      <SummaryScreen />
      <RescueFade />
      <DebugOverlay />
      <TuningDrawer />
    </>
  )
}
