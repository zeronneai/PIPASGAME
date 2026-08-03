import { create } from 'zustand'
import { resetInput } from './inputStore'
import type { SteeringId } from '../game/vehicle/steering'

export type GameMode = 'ON_FOOT' | 'DRIVING'

type PlayerState = {
  /** Posición del cuerpo (la cámara y el debug la leen de aquí). */
  pos: { x: number; y: number; z: number }
  /** Resistencia 0..1. */
  stamina: number
  running: boolean
  /** true al llegar a 0 de resistencia; se limpia al recuperar staminaRecover. */
  exhausted: boolean
  /** Velocidad horizontal en m/s. */
  speed: number
}

type VehicleState = {
  /** Velocidad sobre su eje longitudinal en m/s; negativa en reversa. */
  speed: number
  /** Ángulo actual del volante en radianes, ya suavizado. */
  steer: number
  /** Cuántas de las 4 ruedas tocan el piso. Si baja de 4, algo pasó. */
  wheelsOnGround: number
}

type GameState = {
  mode: GameMode
  /**
   * Estado que cambia cada frame: se MUTA sobre estos objetos estables y se
   * lee con getState() (regla de la sección 5 del doc). El modo, que cambia
   * poco, sí va con set() y sí puede tener componentes suscritos.
   */
  player: PlayerState
  vehicle: VehicleState
  /** Fuente de volante activa. Se elige desde leva para compararlas. */
  steeringId: SteeringId
  setMode: (mode: GameMode) => void
  setSteeringId: (id: SteeringId) => void
}

export const useGameStore = create<GameState>((set) => ({
  mode: 'ON_FOOT',
  player: {
    pos: { x: 0, y: 1, z: 0 },
    stamina: 1,
    running: false,
    exhausted: false,
    speed: 0,
  },
  vehicle: {
    speed: 0,
    steer: 0,
    wheelsOnGround: 0,
  },
  steeringId: 'buttons',
  setMode: (mode) => {
    resetInput()
    set({ mode })
  },
  setSteeringId: (steeringId) => {
    resetInput()
    set({ steeringId })
  },
}))
