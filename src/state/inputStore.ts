import { create } from 'zustand'
import type { DriveInput } from '../game/vehicle/driveModel'

export type Vec2 = { x: number; y: number }

type InputState = {
  /** Joystick izquierdo, normalizado [-1, 1]. y positivo = adelante (arriba en pantalla). */
  move: Vec2
  /** Delta de arrastre de cámara en px, acumulado hasta que alguien lo consume. */
  look: Vec2
  drive: DriveInput
  /** pointerId dueño de cada control; null = libre. */
  pointers: { move: number | null; look: number | null }
}

// Regla de arquitectura (sección 5 del doc): move/look cambian cada frame,
// así que se escriben MUTANDO estos objetos estables y se leen con
// getState() dentro de useFrame o de un rAF. Nunca suscribas un componente
// de React a estos valores, o se re-renderiza 60 veces por segundo.
export const useInputStore = create<InputState>(() => ({
  move: { x: 0, y: 0 },
  look: { x: 0, y: 0 },
  drive: { steer: 0, throttle: 0, brake: 0 },
  pointers: { move: null, look: null },
}))

/** Suelta todos los controles. Se llama al cambiar de modo, o el acelerador
 *  se queda pegado si cambiaste de modo con el dedo encima del botón. */
export function resetInput() {
  const s = useInputStore.getState()
  s.move.x = 0
  s.move.y = 0
  s.look.x = 0
  s.look.y = 0
  s.drive.steer = 0
  s.drive.throttle = 0
  s.drive.brake = 0
  s.pointers.move = null
  s.pointers.look = null
}

/** Devuelve el delta de cámara acumulado y lo pone en cero. Lo llama la ThirdPersonCamera. */
export function consumeLook(out: Vec2): Vec2 {
  const { look } = useInputStore.getState()
  out.x = look.x
  out.y = look.y
  look.x = 0
  look.y = 0
  return out
}
