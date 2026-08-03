import { useCallback, useRef } from 'react'
import { useInputStore } from '../../../state/inputStore'
import { HoldButton } from '../../../ui/HoldButton'

/**
 * Opción A de la sección 4: botones táctiles izquierda/derecha, abajo a la
 * izquierda de la pantalla.
 *
 * Solo escribe la intención cruda (-1, 0, 1) en `input.drive.steer`. El
 * suavizado y el tope por velocidad viven en useVehicleController, para que
 * el giroscopio y el joystick hereden el mismo tacto sin repetir nada.
 */
export function ButtonSteering() {
  const held = useRef({ left: 0, right: 0 })

  // Apretar los dos a la vez se cancela, que es lo que esperas de un volante.
  const apply = useCallback(() => {
    useInputStore.getState().drive.steer = held.current.right - held.current.left
  }, [])

  const setLeft = useCallback(
    (value: number) => {
      held.current.left = value
      apply()
    },
    [apply],
  )

  const setRight = useCallback(
    (value: number) => {
      held.current.right = value
      apply()
    },
    [apply],
  )

  return (
    <div className="steer-buttons">
      <HoldButton
        className="steer"
        ariaLabel="Girar a la izquierda"
        label="◀"
        onChange={setLeft}
      />
      <HoldButton
        className="steer"
        ariaLabel="Girar a la derecha"
        label="▶"
        onChange={setRight}
      />
    </div>
  )
}
