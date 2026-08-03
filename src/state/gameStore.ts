import { create } from 'zustand'
import { resetInput } from './inputStore'
import type { SteeringId } from '../game/vehicle/steering'
import { PIPA_SPAWN } from '../game/vehicle/pipaParts'
import { balance } from '../game/balance'
import {
  CLIENTES,
  COLONIAS,
  newClientHistory,
  type ClientHistory,
} from '../game/systems/clients'
import { clampLiters, settleRefill, type Pedido } from '../game/systems/economy'
import { applyRep, newReputation } from '../game/systems/reputation'
import type { SaveData } from '../game/systems/persistence'

export type GameMode = 'ON_FOOT' | 'DRIVING'

/**
 * Acción disponible ahora mismo en el botón de contexto.
 *
 * Lleva su propio texto porque cada Interactable trae el suyo: el botón no
 * debe saber que existen los locales, ni traducir ids a etiquetas.
 */
export type ContextAction = {
  kind: 'BOARD' | 'EXIT' | 'SERVICE' | 'REFILL'
  label: string
  /** Id del Interactable, cuando la acción viene de uno. */
  targetId?: string
}

/** Dos acciones son «la misma» si apuntan a lo mismo; el texto no cuenta. */
export function sameAction(a: ContextAction | null, b: ContextAction | null) {
  if (a === null || b === null) return a === b
  return a.kind === b.kind && a.targetId === b.targetId
}

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
  /**
   * Nivel del tanque, 0 a 1, DERIVADO de economy.liters (sección 2.1 de
   * Fase 1: fillLevel = litrosActuales / capacidad). No se escribe directo:
   * se pasa por setLiters(), que mantiene los dos en sincronía. La física y
   * el chapoteo lo siguen leyendo igual que en Fase 0.
   */
  fillLevel: number
  /** Dónde está el agua dentro del tanque, en metros. Solo para debug y HUD. */
  slosh: { x: number; z: number }
  /** Temperatura del motor, 0 a 1. La sube «meterle segunda». */
  engineTemp: number
  /** Motor fundido: sin potencia y sin segunda hasta que enfríe. */
  overheated: boolean
  /** Si la segunda está entrando de verdad ahora mismo. */
  boostActive: boolean
  /*
   * Posición y rotación de la pipa. Viven AQUÍ y no en el componente, como
   * pide la sección 6: la pipa se queda exactamente donde la dejaste, y si el
   * componente se remontara volvería a nacer en el mismo lugar en vez de
   * saltar a su punto de partida. Se espejean del rigid body cada frame.
   */
  pos: { x: number; y: number; z: number }
  rot: { x: number; y: number; z: number; w: number }
}

/*
 * Estado económico (Paso 1 de Fase 1). A diferencia de player/vehicle, esto
 * NO cambia cada frame: cambia por eventos (entregar, cargar, cobrar), así
 * que va con set() inmutable y los componentes sí pueden suscribirse.
 */
type EconomyState = {
  /** Pesos en la cartera. */
  money: number
  /** Litros en el tanque. La fuente de verdad; fillLevel se deriva de aquí. */
  liters: number
  /** Día de juego, arranca en 1. La jornada (Paso 8) lo avanza. */
  day: number
  /** Reputación 0..100 POR COLONIA (sección 2.7). */
  reputation: Record<string, number>
  /** Historial por cliente, persiste entre jornadas. */
  clientHistory: Record<string, ClientHistory>
  /** Pedidos aceptados y pendientes de entregar. El reloj corre en Paso 4. */
  orders: Pedido[]
}

/*
 * Sesión de carga en el pozo (Paso 2). Mientras dura, los litros y el costo
 * se acumulan AQUÍ y no en economy: se liquidan de un golpe al cortar, así el
 * autoguardado (cada 5 s) nunca captura dinero y litros a medias. Lo que sí
 * se actualiza en vivo es vehicle.fillLevel, para que la masa y el chapoteo
 * respondan mientras cae el agua.
 *
 * `active` va con set() (monta y desmonta el medidor); litersLoaded y cost se
 * MUTAN cada tick, como el resto del estado por-frame, y el medidor los lee
 * con getState() dentro de un rAF.
 */
type RefillState = {
  active: boolean
  /** Litros cargados en esta sesión, aún sin sumar a economy.liters. */
  litersLoaded: number
  /** Costo acumulado en crudo; se redondea a centavos al liquidar. */
  cost: number
}

const economyInicial = (): EconomyState => ({
  money: balance.dineroInicial,
  liters: balance.tank.capacity * 0.5,
  day: 1,
  reputation: Object.fromEntries(
    Object.keys(COLONIAS).map((id) => [id, newReputation()]),
  ),
  clientHistory: Object.fromEntries(
    Object.keys(CLIENTES).map((id) => [id, newClientHistory()]),
  ),
  orders: [],
})

type GameState = {
  mode: GameMode
  economy: EconomyState
  refill: RefillState
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
  /** Suma (o resta, con delta negativo) dinero. Validar ANTES de llamar. */
  addMoney: (delta: number) => void
  /** Fija los litros del tanque y sincroniza vehicle.fillLevel. */
  setLiters: (liters: number) => void
  /** Abre una sesión de carga en el pozo. El tick corre en Refill.tsx. */
  startRefill: () => void
  /** Liquida la sesión: litros al tanque, costo a la cartera. La llaman el
   *  botón de cortar, el tick al topar, y el sistema si la pipa se aleja. */
  stopRefill: () => void
  addReputation: (colonia: string, delta: number) => void
  setClientHistory: (clientId: string, history: ClientHistory) => void
  setOrders: (orders: Pedido[]) => void
  advanceDay: () => void
  /** Aplica una partida guardada. La llama initPersistence antes del render. */
  hydrate: (save: SaveData) => void
}

export const useGameStore = create<GameState>((set, get) => ({
  mode: 'ON_FOOT',
  economy: economyInicial(),
  refill: { active: false, litersLoaded: 0, cost: 0 },
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
    fillLevel: 0.5,
    slosh: { x: 0, z: 0 },
    engineTemp: 0,
    overheated: false,
    boostActive: false,
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
    if (!sameAction(get().contextAction, contextAction)) set({ contextAction })
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
  addMoney: (delta) =>
    set((s) => ({ economy: { ...s.economy, money: s.economy.money + delta } })),
  setLiters: (liters) => {
    const l = clampLiters(liters)
    // fillLevel se MUTA, no se reemplaza: es la regla de vehicle (estado por
    // frame, objeto estable). La física y el chapoteo lo leen tal cual.
    get().vehicle.fillLevel = l / balance.tank.capacity
    set((s) => ({ economy: { ...s.economy, liters: l } }))
  },
  startRefill: () => {
    // Objeto NUEVO por sesión: los ticks mutan sus campos, y si se reusara el
    // anterior el medidor arrancaría enseñando los litros de la carga pasada.
    if (!get().refill.active)
      set({ refill: { active: true, litersLoaded: 0, cost: 0 } })
  },
  stopRefill: () => {
    const { refill, economy, vehicle } = get()
    if (!refill.active) return
    const settled = settleRefill(economy, refill)
    // Misma sincronía que setLiters: fillLevel se muta, economy va con set().
    vehicle.fillLevel = settled.liters / balance.tank.capacity
    set((s) => ({
      refill: { active: false, litersLoaded: 0, cost: 0 },
      economy: { ...s.economy, liters: settled.liters, money: settled.money },
    }))
  },
  addReputation: (colonia, delta) =>
    set((s) => ({
      economy: {
        ...s.economy,
        reputation: {
          ...s.economy.reputation,
          [colonia]: applyRep(s.economy.reputation[colonia] ?? newReputation(), delta),
        },
      },
    })),
  setClientHistory: (clientId, history) =>
    set((s) => ({
      economy: {
        ...s.economy,
        clientHistory: { ...s.economy.clientHistory, [clientId]: history },
      },
    })),
  setOrders: (orders) => set((s) => ({ economy: { ...s.economy, orders } })),
  advanceDay: () =>
    set((s) => ({ economy: { ...s.economy, day: s.economy.day + 1 } })),
  hydrate: (save) => {
    const { vehicle } = get()
    // La pipa se queda donde la dejaste, también entre sesiones: el
    // componente lee esta posición del store al montar.
    vehicle.pos.x = save.vehiclePos.x
    vehicle.pos.y = save.vehiclePos.y
    vehicle.pos.z = save.vehiclePos.z
    vehicle.rot.x = save.vehicleRot.x
    vehicle.rot.y = save.vehicleRot.y
    vehicle.rot.z = save.vehicleRot.z
    vehicle.rot.w = save.vehicleRot.w
    const liters = clampLiters(save.liters)
    vehicle.fillLevel = liters / balance.tank.capacity
    // Se mezcla sobre lo inicial: si una versión nueva agrega clientes o
    // colonias, un guardado viejo no los deja fuera.
    const base = economyInicial()
    set({
      economy: {
        ...base,
        money: save.money,
        liters,
        day: save.day,
        reputation: { ...base.reputation, ...save.reputation },
        clientHistory: { ...base.clientHistory, ...save.clientHistory },
        orders: [],
      },
    })
  },
}))
