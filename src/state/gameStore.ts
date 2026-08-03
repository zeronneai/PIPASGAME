import { create } from 'zustand'
import { resetInput } from './inputStore'
import type { SteeringId } from '../game/vehicle/steering'
import { PIPA_SPAWN } from '../game/vehicle/pipaParts'

export type GameMode = 'ON_FOOT' | 'DRIVING'

/** Acción disponible ahora mismo en el botón de contexto. */
export type ContextAction = 'BOARD' | 'EXIT'

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
  /*
   * Posición y rotación de la pipa. Viven AQUÍ y no en el componente, como
   * pide la sección 6: la pipa se queda exactamente donde la dejaste, y si el
   * componente se remontara volvería a nacer en el mismo lugar en vez de
   * saltar a su punto de partida. Se espejean del rigid body cada frame.
   */
  pos: { x: number; y: number; z: number }
  rot: { x: number; y: number; z: number; w: number }
}

type GameState = {
  mode: GameMode
  /**
   * Estado que cambia cada frame: se MUTA sobre estos objetos estables y se
   * lee con getState() (regla de la sección 5 del doc). El modo y la acción de
   * contexto, que cambian poco, sí van con set() y sí tienen componentes
   * suscritos.
   */
  player: PlayerState
  vehicle: VehicleState
  /** Fuente de volante activa. Se elige desde leva para compararlas. */
  steeringId: SteeringId
  contextAction: ContextAction | null
  /** Acción pedida desde el DOM, pendiente de ejecutar dentro del Canvas. */
  pendingAction: ContextAction | null
  setMode: (mode: GameMode) => void
  setSteeringId: (id: SteeringId) => void
  setContextAction: (action: ContextAction | null) => void
  requestContextAction: () => void
  consumePendingAction: () => ContextAction | null
}

export const useGameStore = create<GameState>((set, get) => ({
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
    pos: { x: PIPA_SPAWN[0], y: PIPA_SPAWN[1], z: PIPA_SPAWN[2] },
    rot: { x: 0, y: 0, z: 0, w: 1 },
  },
  steeringId: 'buttons',
  contextAction: null,
  pendingAction: null,
  setMode: (mode) => {
    resetInput()
    set({ mode, contextAction: null })
  },
  setSteeringId: (steeringId) => {
    resetInput()
    set({ steeringId })
  },
  // El escaneo corre 10 veces por segundo; sin esta guarda cada pasada
  // dispararía un re-render del HUD aunque nada haya cambiado.
  setContextAction: (contextAction) => {
    if (get().contextAction !== contextAction) set({ contextAction })
  },
  requestContextAction: () => {
    const { contextAction } = get()
    if (contextAction) set({ pendingAction: contextAction })
  },
  consumePendingAction: () => {
    const { pendingAction } = get()
    if (pendingAction) set({ pendingAction: null })
    return pendingAction
  },
}))
