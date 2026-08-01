import { create } from 'zustand'

export type GameMode = 'ON_FOOT' | 'DRIVING' // DRIVING llega en el Paso 8

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

type GameState = {
  mode: GameMode
  /**
   * Estado que cambia cada frame: se MUTA sobre este objeto estable y se
   * lee con getState() (regla de la sección 5 del doc). El modo, que
   * cambia poco, sí irá con set() cuando llegue el Paso 8.
   */
  player: PlayerState
}

export const useGameStore = create<GameState>(() => ({
  mode: 'ON_FOOT',
  player: {
    pos: { x: 0, y: 1, z: 0 },
    stamina: 1,
    running: false,
    exhausted: false,
    speed: 0,
  },
}))
