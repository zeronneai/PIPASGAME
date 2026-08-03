import type { ComponentType } from 'react'
import { ButtonSteering } from './ButtonSteering'

/*
 * El volante es intercambiable a propósito. La sección 4 del documento dice
 * que las tres opciones (botones, giroscopio, joystick horizontal) hay que
 * probarlas en el teléfono y no decidirlas en papel, así que la que gane se
 * elige cambiando una línea, no reescribiendo el controlador.
 *
 * Contrato de una fuente: escribir `input.drive.steer` en [-1, 1] y nada más.
 * Ni suavizado, ni tope por velocidad, ni curvas de respuesta: todo eso vive
 * en useVehicleController y así lo hereda cualquier fuente nueva.
 */

export type SteeringId = 'buttons' | 'gyro' | 'joystick'

export type SteeringSource = {
  id: SteeringId
  label: string
  /** HUD de la fuente. null para una fuente sin UI, como el giroscopio. */
  Control: ComponentType | null
  /**
   * true si iOS exige un gesto del usuario antes de activarla. El giroscopio
   * necesita DeviceOrientationEvent.requestPermission() tras un tap.
   */
  requiresGesture?: boolean
}

/*
 * Un arreglo y no un Record<SteeringId, ...>: así no hay entradas muertas
 * mientras las otras dos no existan. Agregar el giroscopio es un archivo
 * nuevo más una línea aquí; el desplegable de leva se arma solo desde esta
 * lista.
 */
export const STEERING_SOURCES: SteeringSource[] = [
  { id: 'buttons', label: 'Botones', Control: ButtonSteering },
]

export function getSteeringSource(id: SteeringId): SteeringSource {
  return STEERING_SOURCES.find((s) => s.id === id) ?? STEERING_SOURCES[0]
}
