import { useGameStore } from '../state/gameStore'
import { useInputStore } from '../state/inputStore'
import { getSteeringSource } from '../game/vehicle/steering'
import { HoldButton } from './HoldButton'
import { SegundaButton } from './SegundaButton'

/**
 * HUD de manejo: acelerador y freno a la derecha, y la fuente de volante
 * activa (hoy los botones) a la izquierda.
 *
 * El volante no se dibuja aquí a propósito: lo aporta la fuente seleccionada,
 * así que probar giroscopio o joystick horizontal no toca este archivo.
 */
export function DriveControls() {
  // El id de fuente cambia poco, así que sí puede estar suscrito a React.
  const steeringId = useGameStore((s) => s.steeringId)
  const { Control } = getSteeringSource(steeringId)

  const setThrottle = (v: number) => {
    useInputStore.getState().drive.throttle = v
  }
  const setBrake = (v: number) => {
    useInputStore.getState().drive.brake = v
  }

  return (
    <>
      {Control && <Control />}
      <SegundaButton />
      <div className="drive-pedals">
        {/* El freno también da reversa cuando ya estás parado: un botón menos */}
        <HoldButton
          className="brake"
          ariaLabel="Frenar y reversa"
          label="FRENO"
          onChange={setBrake}
        />
        <HoldButton
          className="throttle"
          ariaLabel="Acelerar"
          label="▲"
          onChange={setThrottle}
        />
      </div>
    </>
  )
}
