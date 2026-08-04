import { create } from 'zustand'
import { resetInput } from './inputStore'
import type { SteeringId } from '../game/vehicle/steering'
import { PIPA_SPAWN } from '../game/vehicle/pipaParts'
import { balance } from '../game/balance'
import {
  CLIENTES,
  COLONIAS,
  getCliente,
  newClientHistory,
  withCancellation,
  withDecline,
  withDelivery,
  withSpill,
  type ClientHistory,
  type PerfilCliente,
} from '../game/systems/clients'
import {
  evaluarOferta,
  type MotivoRechazo,
} from '../game/systems/acceptance'
import {
  centavos,
  clampLiters,
  orderClock,
  settleDelivery,
  settleRefill,
  type Pedido,
  type Puntualidad,
} from '../game/systems/economy'
import { esLimpio } from '../game/systems/hose'
import {
  alternarPieza,
  aplicarCambio,
  inventarioDesdeGarage,
  inventarioInicial,
  type CambioEstilo,
  type InventarioEstilo,
  type Pieza,
} from '../game/systems/estilo'
import {
  comprarMejora as calcularCompra,
  comprarModelo as calcularCompraModelo,
  computeStats,
  MEJORAS,
  MODELOS,
  pipaDeFabrica,
  type Categoria,
  type ModeloId,
  type Nivel,
  type PipaConfig,
  type PipaStats,
} from '../game/systems/garage'
import type { EphemeralClient } from '../game/systems/ephemeral'
import {
  newDayStats,
  resumenJornada,
  type DayStats,
  type ResumenJornada,
} from '../game/systems/jornada'
import { DOMICILIOS, PLAYER_SPAWN } from '../game/world/layout'
import {
  prioridadTrasAceptar,
  prioridadTrasRechazo,
  type RadioCall,
} from '../game/systems/radio'
import {
  applyRep,
  deliveryRepDelta,
  eventRepDelta,
  isRadioUnlocked,
  isSegundaUnlocked,
  newReputation,
  tipRepFactor,
} from '../game/systems/reputation'
import type { SaveData } from '../game/systems/persistence'

export type GameMode = 'ON_FOOT' | 'DRIVING'

/**
 * Acción disponible ahora mismo en el botón de contexto.
 *
 * Lleva su propio texto porque cada Interactable trae el suyo: el botón no
 * debe saber que existen los locales, ni traducir ids a etiquetas.
 */
export type ContextAction = {
  kind: 'BOARD' | 'EXIT' | 'SERVICE' | 'REFILL' | 'DELIVER' | 'TALLER' | 'ENDEREZAR'
  label: string
  /** Id del Interactable (o del cliente, en DELIVER). */
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
  /** Rumbo del personaje en radianes (atan2(x, z), como el visual). Lo
   *  escribe usePlayerMovement; lo persisten el guardado y lee el minimapa. */
  yaw: number
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
  /** Pedido de asentar el agua de golpe (lo deja el enderezado de una
   *  volcadura; lo consume el paso de física). Sin esto, el chapoteo que
   *  quedó de estar de lado vuelve a inclinar la pipa recién derecha. */
  sloshReset: boolean
  /** Temperatura del motor, 0 a 1. La sube «meterle segunda». */
  engineTemp: number
  /** Motor fundido: sin potencia y sin segunda hasta que enfríe. */
  overheated: boolean
  /** Si la segunda está entrando de verdad ahora mismo. */
  boostActive: boolean
  /** VOLCADA de verdad (inclinación sostenida, la evalúa Volcadura.tsx).
   *  Mientras esté en true, el botón de contexto ofrece «Enderezar». */
  volcada: boolean
  /** |velocidad| máxima registrada mientras se iba de lado: lo brusco del
   *  golpe, de donde sale cuánta agua se derrama al enderezar. */
  golpeVuelco: number
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
  /** Tu lugar en la lista del despacho, 0..1 (Paso 7). Baja al rechazar
   *  llamadas, se recupera al aceptarlas, y persiste entre sesiones. */
  radioPrioridad: number
  /**
   * La segunda GANADA (Fase 2, Paso 6). Permanente a propósito, a diferencia
   * del radio (que es derivado y se pierde con la reputación): un logro no
   * se devuelve. Cruzar el umbral una vez la deja en true para siempre.
   */
  segundaDesbloqueada: boolean
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

/**
 * Oferta sobre la mesa (pantalla del Paso 3). Trae todo lo que la pantalla
 * enseña, ya resuelto: la UI no debe buscar clientes ni calcular pagos.
 */
export type OfferState = {
  clientId: string
  name: string
  perfil: PerfilCliente
  colonia: string
  litros: number
  windowMinutes: number
  /** Mejor caso: a tiempo y con propina. */
  estimate: number
  /** Dónde se entrega (el domicilio del fijo o el spot del efímero). */
  delivery: [number, number, number]
  /** Metros en línea recta desde donde estás parado: el dato para decidir. */
  deliveryDist: number
}

/** Aviso pasajero (rechazos, enfriamiento). El id reinicia el timer del toast
 *  cuando llega un mensaje nuevo mientras el anterior sigue en pantalla. */
export type Notice = { id: number; text: string }

/**
 * Entrega en curso (Paso 5). La puntualidad se FIJA al conectar: el pago no
 * cambia de escalón a media manguera, o los últimos segundos del minijuego
 * se sentirían una trampa. El minijuego vive en el DOM (HoseMinigame) y
 * reporta al terminar; aquí solo quién, qué pedido y a qué escalón.
 */
export type DeliveryState = { pedido: Pedido; puntualidad: Puntualidad }

/** Lo que el cliente contesta cuando no hay trato, en su voz. */
const VOZ_RECHAZO: Record<MotivoRechazo, string> = {
  FUERA_DE_HORARIO: '«A esta hora ya no, joven»',
  YA_SURTIDO: '«Todavía tengo agua, gracias»',
  HISTORIAL: '«La última vez me quedaste mal…»',
  REPUTACION: '«No te conozco. ¿Eres nuevo por aquí?»',
  SUERTE: '«Hoy no, gracias»',
}

/** Correlativo de avisos; ver Notice. */
let noticeSeq = 0

/** La colonia que enseñan el resumen y la barra de estado (en Fase 1, la
 *  única). La Fase 3 la volverá «la colonia donde estás parado». */
const COLONIA_PRINCIPAL = Object.keys(COLONIAS)[0]

const PUNTUALIDAD_STAT: Record<Puntualidad, keyof DayStats['entregas']> = {
  A_TIEMPO: 'aTiempo',
  TARDE: 'tarde',
  MUY_TARDE: 'muyTarde',
}

/**
 * Aplica un delta de reputación a una colonia y avisa si ese cambio cruzó
 * el umbral del radio (el hito de la fase, sección 2.7) hacia arriba. Todas
 * las consecuencias del Paso 6 pasan por aquí para no repetir el cruce.
 */
function aplicarRep(
  economy: EconomyState,
  colonia: string,
  delta: number,
): {
  reputation: Record<string, number>
  desbloqueaRadio: boolean
  desbloqueaSegunda: boolean
} {
  const antes = economy.reputation[colonia] ?? newReputation()
  const despues = applyRep(antes, delta)
  return {
    reputation: { ...economy.reputation, [colonia]: despues },
    desbloqueaRadio: !isRadioUnlocked(antes) && isRadioUnlocked(despues),
    // La segunda se compara contra el FLAG y no contra el número de antes:
    // es un logro permanente, y si ya la ganaste ningún cruce se repite.
    desbloqueaSegunda:
      !economy.segundaDesbloqueada && isSegundaUnlocked(despues),
  }
}

/**
 * El garage: con qué pipas cuentas y cuál traes. Va por eventos (comprar,
 * equipar), no por frame, así que es inmutable como `economy`.
 *
 * Se llavea por modelo porque «conservas la anterior» pero nunca tienes dos
 * iguales: comprar la grandota no te quita la heredada, y cada una guarda SUS
 * mejoras (sección 4 del documento de Fase 2).
 */
export type GarageState = {
  pipas: Partial<Record<ModeloId, PipaConfig>>
  equipada: ModeloId
}

/** Con la que empiezas: la heredada, pelona. */
const garageInicial = (): GarageState => ({
  pipas: { heredada: pipaDeFabrica('heredada') },
  equipada: 'heredada',
})

/**
 * Estadísticas de la pipa equipada. Es de donde la física saca TODOS sus
 * números desde la Fase 2: modelo base más mejoras, no constantes fijas.
 *
 * Se recalcula en cada llamada a propósito: leva muta `tuning` y `balance` sin
 * avisarle a nadie, así que una copia guardada se quedaría vieja al primer
 * slider. Es un objeto chico y el paso de física lo pide una vez.
 */
export function statsPipa(): PipaStats {
  const g = useGameStore.getState().garage
  return computeStats(g.pipas[g.equipada] ?? pipaDeFabrica(g.equipada))
}

/** Litros que le caben a la pipa equipada. Sustituye a `balance.tank.capacity`
 *  en todo lo que antes daba por hecho que la pipa era una sola. */
export function capacidadPipa(): number {
  return statsPipa().capacidadLitros
}

const economyInicial = (): EconomyState => ({
  money: balance.dineroInicial,
  liters: computeStats(pipaDeFabrica('heredada')).capacidadLitros * 0.5,
  day: 1,
  reputation: Object.fromEntries(
    Object.keys(COLONIAS).map((id) => [id, newReputation()]),
  ),
  clientHistory: Object.fromEntries(
    Object.keys(CLIENTES).map((id) => [id, newClientHistory()]),
  ),
  orders: [],
  radioPrioridad: 1,
  segundaDesbloqueada: false,
})

type GameState = {
  mode: GameMode
  economy: EconomyState
  /** Las pipas que posees y cuál traes. La física lee de aquí. */
  garage: GarageState
  /** Lo COMPRADO del estilo (colores, calcas, piezas): del jugador, global y
   *  para siempre. Lo aplicado vive en cada PipaConfig.estilo. */
  inventarioEstilo: InventarioEstilo
  refill: RefillState
  /**
   * Reloj de la jornada en segundos reales. Se MUTA cada frame (DayClock.tsx)
   * y se lee con getState(), como player/vehicle. La hora del día se deriva
   * con horaDelDia(). No persiste: recargar arranca la mañana de nuevo (la
   * jornada completa es del Paso 8).
   */
  clock: { daySeconds: number }
  /**
   * Orientación horizontal de la vista, como atan2(x, z) del frente de la
   * cámara. La escribe ThirdPersonCamera cada frame (MUTADA, como vehicle);
   * las flechas de pedidos del HUD giran contra ella para que «arriba»
   * siempre sea «hacia donde miras».
   */
  camera: { phi: number }
  offer: OfferState | null
  notice: Notice | null
  delivery: DeliveryState | null
  /** Llamada del despacho en pantalla (Paso 7). La genera RadioDispatch. */
  radioCall: RadioCall | null
  /** true = la pantalla fundida a negro (rescate por caída o enderezado de
   *  volcadura — el overlay es el mismo). El DOM anima la opacidad contra
   *  este flag; el ritmo lo llevan Rescue.tsx y Volcadura.tsx. */
  rescueFade: boolean
  /** El jugador pidió enderezar la pipa volcada. Lo deja el botón (DOM) y lo
   *  consume Volcadura.tsx dentro del Canvas, que es quien toca Rapier. */
  enderezando: boolean
  /** Minimapa a pantalla completa. Vive en el store y no en el componente
   *  porque App oculta los controles de manejo mientras está abierto. */
  minimapExpanded: boolean
  /**
   * El taller abierto (Fase 2). Igual que el minimapa: vive en el store
   * porque App tiene que esconder los controles de manejo mientras esté.
   *
   * El reloj de la jornada NO se detiene: el documento pide que ir al taller
   * cueste, y lo que cuesta es tiempo del día.
   */
  tallerAbierto: boolean
  /**
   * La tarjeta del logro de la segunda está en pantalla (Paso 6). Como el
   * resumen de jornada: mientras exista, el mundo espera (reloj, radio y
   * efímeros la chequean). Transitoria — el flag permanente vive en economy.
   */
  logroSegunda: boolean
  /**
   * Depuración visual (Fase 2, reforma del mundo): `colliders` dibuja las
   * aristas de TODOS los colliders estáticos sobre la escena (barato: una
   * geometría estática, +1 draw call); `physics` prende el debugRender de
   * rapier (caro, ~33k vértices POR FRAME, pero es el único que enseña los
   * cuerpos dinámicos — herramienta de escritorio). Viven aquí y no en leva
   * porque leva se desmonta al cerrar el cajón.
   */
  debug: { colliders: boolean; physics: boolean }
  /** Clientes efímeros activos (casas y obras). Los administra el sistema
   *  Ephemerals; transitorios, nunca se guardan. */
  ephemeral: EphemeralClient[]
  /** Acumulador del día (Paso 8). Lo consume el resumen; no persiste. */
  stats: DayStats
  /** Pantalla de fin de día. Mientras exista, el mundo espera. */
  summary: ResumenJornada | null
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
  /** «Ofrecer servicio» (Paso 3): evalúa la aceptación ponderada y deja una
   *  oferta sobre la mesa o un aviso con el porqué del no. */
  offerService: (clientId: string) => void
  /** El jugador acepta la oferta: entra a la cola de pedidos con su reloj. */
  acceptOffer: () => void
  /** El jugador la rechaza. También enfría: si preguntar de nuevo fuera
   *  gratis, rechazar sería una tómbola de litros hasta que salga la buena. */
  rejectOffer: () => void
  clearNotice: (id: number) => void
  /** Aviso suelto desde un sistema (rescate, etc.). */
  showNotice: (text: string) => void
  setRescueFade: (on: boolean) => void
  setEnderezando: (on: boolean) => void
  setMinimapExpanded: (on: boolean) => void
  setTallerAbierto: (on: boolean) => void
  setLogroSegunda: (on: boolean) => void
  setDebugColliders: (on: boolean) => void
  setDebugPhysics: (on: boolean) => void
  setEphemeral: (list: EphemeralClient[]) => void
  /** Llegaste con la pipa a un local con pedido: abre el minijuego, o
   *  resuelve sin abrirlo (exigente que cancela, tanque que no alcanza). */
  startDelivery: (clientId: string) => void
  /** El minijuego terminó: litros fuera, dinero dentro, pedido cerrado. */
  finishDelivery: (result: { delivered: number; spilled: number }) => void
  /** Soltaste la manguera (o no conectaste): el pedido sigue activo y lo
   *  derramado sí se perdió. */
  abortDelivery: (spilled: number) => void
  /** Suena el radio: RadioDispatch pone la llamada en pantalla. */
  offerRadioCall: (call: RadioCall) => void
  /** Contestar que sí: el pedido entra a la cola con el pago del radio. */
  acceptRadioCall: () => void
  /** Que no (o dejarla sonar hasta perderla): baja tu prioridad. */
  rejectRadioCall: (motivo: 'RECHAZO' | 'EXPIRO') => void
  /** Cierra la jornada (Paso 8): cancela lo pendiente con consecuencias y
   *  arma el resumen. La dispara DayClock al agotarse los minutos del día. */
  endDay: () => void
  /** Del botón del resumen: día siguiente, reloj a la mañana, estadísticas
   *  en ceros. Dinero, reputación, historial y la pipa se quedan como están. */
  startNextDay: () => void
  addReputation: (colonia: string, delta: number) => void
  setClientHistory: (clientId: string, history: ClientHistory) => void
  setOrders: (orders: Pedido[]) => void
  advanceDay: () => void
  /**
   * Cambia la pipa con la que sales. Sin lógica de dinero: comprar es del
   * Paso 3 y equipar desde el taller es del Paso 4; esto existe para que leva
   * y los tests puedan mover la configuración.
   *
   * Los litros se recortan a la capacidad de la pipa nueva: pasarte a la
   * heredada con el tanque de la grandota lleno tira agua que ya pagaste,
   * pero guardarla en un tanque que no existe es peor.
   */
  equiparPipa: (id: ModeloId) => void
  /** Fija el nivel de una mejora SIN cobrar. Es la puerta de leva y de los
   *  tests; el jugador compra con `comprarMejora`. */
  setMejora: (categoria: Categoria, nivel: Nivel) => void
  /**
   * Sube una mejora un nivel cobrándola (Paso 3). Valida que alcance y que no
   * esté al tope; si no, deja un aviso y no toca nada.
   *
   * El efecto es INMEDIATO: la física lee las estadísticas del garage en cada
   * paso, así que el motor empuja más desde el siguiente frame, sin recargar
   * ni volver a montar la pipa.
   */
  comprarMejora: (categoria: Categoria) => void
  /**
   * Compra un modelo del lote (Paso 4): cobra, lo da de alta DE FÁBRICA y te
   * lo deja puesto — la acabas de comprar; volver a la anterior es un toque en
   * el mismo Lote. Si no alcanza (o ya la tienes), deja un aviso y no toca nada.
   */
  comprarPipa: (id: ModeloId) => void
  /**
   * Un cambio de estilo sobre la pipa equipada (Paso 5): pintura, rótulo,
   * calca o pieza. Cobra lo que diga balance.garage.estilo; quitar es gratis.
   * Cosmético puro — la física ni se entera.
   */
  comprarEstilo: (cambio: CambioEstilo) => void
  /** Pone o quita una pieza YA comprada. Gratis; si no es tuya, no hace nada. */
  togglePiezaEstilo: (pieza: Pieza) => void
  /** Aplica una partida guardada. La llama initPersistence antes del render. */
  hydrate: (save: SaveData) => void
}

export const useGameStore = create<GameState>((set, get) => {
  // Compartido para que la foto de reputación del día 1 sea la del arranque.
  const eco0 = economyInicial()
  return {
  mode: 'ON_FOOT',
  economy: eco0,
  garage: garageInicial(),
  inventarioEstilo: inventarioInicial(),
  refill: { active: false, litersLoaded: 0, cost: 0 },
  clock: { daySeconds: 0 },
  camera: { phi: 0 },
  offer: null,
  notice: null,
  delivery: null,
  radioCall: null,
  rescueFade: false,
  enderezando: false,
  minimapExpanded: false,
  tallerAbierto: false,
  logroSegunda: false,
  debug: { colliders: false, physics: false },
  ephemeral: [],
  stats: newDayStats(eco0.reputation),
  summary: null,
  player: {
    pos: { x: PLAYER_SPAWN[0], y: PLAYER_SPAWN[1], z: PLAYER_SPAWN[2] },
    yaw: 0,
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
    sloshReset: false,
    engineTemp: 0,
    overheated: false,
    boostActive: false,
    volcada: false,
    golpeVuelco: 0,
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
    // La capacidad es la de la pipa EQUIPADA, no una constante: cada modelo
    // tiene la suya y la mejora de tanque la mueve.
    const capacidad = capacidadPipa()
    const l = clampLiters(liters, balance, capacidad)
    // fillLevel se MUTA, no se reemplaza: es la regla de vehicle (estado por
    // frame, objeto estable). La física y el chapoteo lo leen tal cual.
    get().vehicle.fillLevel = l / capacidad
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
    const capacidad = capacidadPipa()
    const settled = settleRefill(economy, refill, balance, capacidad)
    // Misma sincronía que setLiters: fillLevel se muta, economy va con set().
    vehicle.fillLevel = settled.liters / capacidad
    set((s) => ({
      refill: { active: false, litersLoaded: 0, cost: 0 },
      economy: { ...s.economy, liters: settled.liters, money: settled.money },
      // El gasto real es la diferencia liquidada, ya redondeada.
      stats: {
        ...s.stats,
        gastoAgua: centavos(s.stats.gastoAgua + (s.economy.money - settled.money)),
      },
    }))
  },
  offerService: (clientId) => {
    const s = get()
    // Fijo del directorio o efímero activo: el resto del flujo no distingue.
    const cliente =
      getCliente(clientId) ?? s.ephemeral.find((e) => e.id === clientId) ?? null
    if (!cliente || s.offer) return
    // El domicilio del fijo, o el propio spot del efímero (pide para sí).
    const delivery =
      'pos' in cliente
        ? (cliente as EphemeralClient).pos
        : DOMICILIOS[clientId]
    if (!delivery) return

    const { economy, clock } = s
    const history = economy.clientHistory[clientId] ?? newClientHistory()
    const resultado = evaluarOferta({
      cliente,
      rep: economy.reputation[cliente.colonia] ?? newReputation(),
      history,
      day: economy.day,
      daySeconds: clock.daySeconds,
      tienePedidoActivo: economy.orders.some((o) => o.clientId === clientId),
    })

    if (resultado.kind === 'OFERTA') {
      const { litros, windowMinutes, estimate } = resultado.oferta
      const p = s.player.pos
      set({
        offer: {
          clientId,
          name: cliente.name,
          perfil: cliente.perfil,
          colonia: cliente.colonia,
          litros,
          windowMinutes,
          estimate,
          delivery,
          deliveryDist: Math.hypot(delivery[0] - p.x, delivery[2] - p.z),
        },
      })
      return
    }

    if (resultado.kind === 'RECHAZO') {
      // Solo el «no» del CLIENTE arranca enfriamiento nuevo; las guardas de
      // NO_DISPONIBLE no lo reinician, o insistir alargaría el castigo.
      s.setClientHistory(
        clientId,
        withDecline(history, economy.day, clock.daySeconds),
      )
      set({
        notice: { id: ++noticeSeq, text: `${cliente.name}: ${VOZ_RECHAZO[resultado.motivo]}` },
      })
      return
    }

    const text =
      resultado.motivo === 'YA_PIDIO'
        ? `${cliente.name} ya te encargó un pedido — entrégalo`
        : `${cliente.name} acaba de decirte que no — vuelve en ${Math.ceil(resultado.cooldownMin)} min`
    set({ notice: { id: ++noticeSeq, text } })
  },
  acceptOffer: () => {
    const { offer, economy, clock } = get()
    if (!offer) return
    const pedido: Pedido = {
      // Único aunque el mismo cliente pida dos veces el mismo día: el reloj
      // de la jornada nunca marca dos veces lo mismo.
      id: `${offer.clientId}-d${economy.day}-${Math.round(clock.daySeconds * 10)}`,
      clientId: offer.clientId,
      clientName: offer.name,
      colonia: offer.colonia,
      perfil: offer.perfil,
      liters: offer.litros,
      delivery: offer.delivery,
      acceptedAt: clock.daySeconds,
      windowMinutes: offer.windowMinutes,
      pagoFactor: 1,
    }
    set((s) => ({
      offer: null,
      economy: { ...s.economy, orders: [...s.economy.orders, pedido] },
    }))
  },
  rejectOffer: () => {
    const { offer, economy, clock } = get()
    if (!offer) return
    const history = economy.clientHistory[offer.clientId] ?? newClientHistory()
    get().setClientHistory(
      offer.clientId,
      withDecline(history, economy.day, clock.daySeconds),
    )
    set({ offer: null })
  },
  clearNotice: (id) => {
    // Solo si sigue siendo el mismo aviso: uno nuevo trae su propio timer.
    if (get().notice?.id === id) set({ notice: null })
  },
  showNotice: (text) => set({ notice: { id: ++noticeSeq, text } }),
  setRescueFade: (rescueFade) => set({ rescueFade }),
  setEnderezando: (enderezando) => set({ enderezando }),
  setMinimapExpanded: (minimapExpanded) => set({ minimapExpanded }),
  setTallerAbierto: (tallerAbierto) => set({ tallerAbierto }),
  setLogroSegunda: (logroSegunda) => set({ logroSegunda }),
  setDebugColliders: (on) => set((s) => ({ debug: { ...s.debug, colliders: on } })),
  setDebugPhysics: (on) => set((s) => ({ debug: { ...s.debug, physics: on } })),
  setEphemeral: (ephemeral) => set({ ephemeral }),
  startDelivery: (clientId) => {
    const s = get()
    if (s.delivery) return
    const pedido = s.economy.orders.find((o) => o.clientId === clientId)
    if (!pedido) return
    // Del pedido, no del directorio: un efímero puede haberse ido ya.
    const nombre = pedido.clientName
    const { economy, clock } = s
    const reloj = orderClock(pedido, clock.daySeconds)

    // El exigente no espera (sección 2.5): muy tarde, al llegar ya no hay
    // pedido. Se cancela aquí y no antes para que el jugador VEA el momento.
    if (reloj.puntualidad === 'MUY_TARDE' && pedido.perfil === 'exigente') {
      const h = economy.clientHistory[clientId] ?? newClientHistory()
      s.setClientHistory(
        clientId,
        withCancellation(h, economy.day, clock.daySeconds),
      )
      set((st) => {
        // Solo el evento de cancelación, no también el veryLate del perfil:
        // es UN pecado, no dos. El delta del evento ya es de los duros.
        const rep = aplicarRep(
          st.economy,
          pedido.colonia,
          eventRepDelta('CANCELACION'),
        )
        return {
          economy: {
            ...st.economy,
            reputation: rep.reputation,
            orders: st.economy.orders.filter((o) => o.id !== pedido.id),
          },
          stats: { ...st.stats, canceladas: st.stats.canceladas + 1 },
          notice: {
            id: ++noticeSeq,
            text: `${nombre}: «Demasiado tarde — cancelo el pedido»`,
          },
        }
      })
      return
    }

    if (economy.liters < pedido.liters) {
      set({
        notice: {
          id: ++noticeSeq,
          text: `No te alcanza el agua para ${pedido.liters.toLocaleString('es-MX')} L — pasa al pozo`,
        },
      })
      return
    }

    set({ delivery: { pedido, puntualidad: reloj.puntualidad } })
  },
  finishDelivery: (result) => {
    const s = get()
    const d = s.delivery
    if (!d) return
    const { pedido } = d
    const clean = esLimpio(result.spilled, pedido.liters)
    // La propina paga con la reputación que TENÍAS al entregar, no con la
    // que deja esta entrega: primero se cobra, luego se aprende.
    const repActual =
      s.economy.reputation[pedido.colonia] ?? newReputation()
    const settled = settleDelivery(s.economy, {
      delivered: result.delivered,
      spilled: result.spilled,
      perfil: pedido.perfil,
      puntualidad: d.puntualidad,
      clean,
      tipFactor: tipRepFactor(repActual),
      payFactor: pedido.pagoFactor,
    })

    let h = s.economy.clientHistory[pedido.clientId] ?? newClientHistory()
    h = withDelivery(h, d.puntualidad, s.economy.day)
    if (!clean) h = withSpill(h)

    // Las consecuencias del Paso 6, todas juntas: la puntualidad según el
    // perfil, más limpio premia, más derramar castiga.
    let delta = deliveryRepDelta(d.puntualidad, pedido.perfil)
    if (clean) delta += eventRepDelta('MINIJUEGO_LIMPIO')
    if (!clean && result.spilled > 0) delta += eventRepDelta('DERRAME')

    // Misma sincronía que el pozo: fillLevel se muta, economy va con set().
    s.vehicle.fillLevel = settled.liters / capacidadPipa()
    const nombre = pedido.clientName
    const cobrado = settled.pago.total + settled.bonus
    const partes = [`${nombre}: +$${cobrado.toFixed(2)}`]
    if (settled.bonus > 0) partes.push('limpio')
    if (result.spilled > 0 && !clean)
      partes.push(`${Math.round(result.spilled)} L derramados`)
    set((st) => {
      const rep = aplicarRep(st.economy, pedido.colonia, delta)
      if (rep.desbloqueaRadio) partes.push('¡radio de despacho desbloqueado!')
      return {
        delivery: null,
        notice: { id: ++noticeSeq, text: partes.join(' · ') },
        // El momento del logro es el momento del mérito: la tarjeta de la
        // segunda sale al cerrar ESTA entrega, en el mismo set().
        ...(rep.desbloqueaSegunda && { logroSegunda: true }),
        economy: {
          ...st.economy,
          money: settled.money,
          liters: settled.liters,
          reputation: rep.reputation,
          segundaDesbloqueada:
            st.economy.segundaDesbloqueada || rep.desbloqueaSegunda,
          orders: st.economy.orders.filter((o) => o.id !== pedido.id),
          clientHistory: { ...st.economy.clientHistory, [pedido.clientId]: h },
        },
        stats: {
          ...st.stats,
          litrosVendidos: st.stats.litrosVendidos + Math.round(result.delivered),
          ingresos: centavos(st.stats.ingresos + cobrado),
          entregas: {
            ...st.stats.entregas,
            [PUNTUALIDAD_STAT[d.puntualidad]]:
              st.stats.entregas[PUNTUALIDAD_STAT[d.puntualidad]] + 1,
          },
        },
      }
    })
  },
  abortDelivery: (spilled) => {
    const s = get()
    const d = s.delivery
    if (!d) return
    const liters = clampLiters(s.economy.liters - Math.max(0, spilled))
    s.vehicle.fillLevel = liters / capacidadPipa()
    set((st) => {
      // Derramar castiga aunque sueltes la manguera: el agua ya está en la
      // banqueta del cliente.
      const rep =
        spilled > 0
          ? aplicarRep(st.economy, d.pedido.colonia, eventRepDelta('DERRAME'))
          : null
      return {
        delivery: null,
        notice: {
          id: ++noticeSeq,
          text: 'Entrega interrumpida — el pedido sigue activo',
        },
        economy: {
          ...st.economy,
          liters,
          reputation: rep ? rep.reputation : st.economy.reputation,
        },
      }
    })
  },
  offerRadioCall: (call) => {
    if (!get().radioCall) set({ radioCall: call })
  },
  acceptRadioCall: () => {
    const { radioCall, economy, clock } = get()
    if (!radioCall) return
    const pedido: Pedido = {
      // La r distingue el id de los pedidos a pie del mismo instante.
      id: `${radioCall.clientId}-d${economy.day}-r${Math.round(clock.daySeconds * 10)}`,
      clientId: radioCall.clientId,
      clientName: radioCall.name,
      colonia: radioCall.colonia,
      perfil: radioCall.perfil,
      liters: radioCall.litros,
      delivery: radioCall.delivery,
      acceptedAt: clock.daySeconds,
      windowMinutes: radioCall.windowMinutes,
      // Copiado al aceptar, como windowMinutes: leva no mueve lo pactado.
      pagoFactor: balance.radio.payFactor,
    }
    set((s) => ({
      radioCall: null,
      economy: {
        ...s.economy,
        orders: [...s.economy.orders, pedido],
        radioPrioridad: prioridadTrasAceptar(s.economy.radioPrioridad),
      },
    }))
  },
  rejectRadioCall: (motivo) => {
    const { radioCall } = get()
    if (!radioCall) return
    set((s) => {
      const prioridad = prioridadTrasRechazo(s.economy.radioPrioridad)
      // El aviso solo al tocar fondo: la mecánica se enseña cuando duele,
      // no en cada rechazo. El número exacto vive en el debug.
      const tocoFondo =
        prioridad <= balance.radio.prioridadMin &&
        s.economy.radioPrioridad > balance.radio.prioridadMin
      return {
        radioCall: null,
        economy: { ...s.economy, radioPrioridad: prioridad },
        ...((tocoFondo || motivo === 'EXPIRO') && {
          notice: {
            id: ++noticeSeq,
            text: tocoFondo
              ? 'Despacho: «Órale. Hasta el final de la lista»'
              : 'Se perdió la llamada del despacho',
          },
        }),
      }
    })
  },
  endDay: () => {
    const s = get()
    if (s.summary) return
    // DayClock espera a que carga y entrega cierren, pero por si acaso.
    if (s.refill.active) s.stopRefill()

    set((st) => {
      /*
       * Los pedidos que el cierre alcanzó se cancelan CON consecuencias:
       * aceptaste y no entregaste, y el día se sabía cuándo terminaba. Eso
       * es lo que convierte «aceptar a las 6:50 pm» en una decisión.
       */
      let reputation = st.economy.reputation
      let clientHistory = st.economy.clientHistory
      let canceladas = st.stats.canceladas
      for (const o of st.economy.orders) {
        const h = clientHistory[o.clientId] ?? newClientHistory()
        clientHistory = {
          ...clientHistory,
          [o.clientId]: withCancellation(h, st.economy.day, st.clock.daySeconds),
        }
        reputation = aplicarRep(
          { ...st.economy, reputation },
          o.colonia,
          eventRepDelta('CANCELACION'),
        ).reputation
        canceladas++
      }

      const stats = { ...st.stats, canceladas }
      return {
        summary: resumenJornada({
          stats,
          day: st.economy.day,
          repFinal: reputation,
          colonia: COLONIA_PRINCIPAL,
        }),
        stats,
        economy: { ...st.economy, reputation, clientHistory, orders: [] },
        // El día se llevó lo que estaba a medias, sin castigo extra.
        offer: null,
        radioCall: null,
        contextAction: null,
        // Y cierra el taller: si el día terminó estando adentro, lo que toca
        // ver es el resumen, no el catálogo.
        tallerAbierto: false,
      }
    })
  },
  startNextDay: () => {
    const s = get()
    if (!s.summary) return
    // El reloj es estado por-frame: se muta, como lo escribe DayClock.
    s.clock.daySeconds = 0
    set((st) => ({
      summary: null,
      stats: newDayStats(st.economy.reputation),
      economy: { ...st.economy, day: st.economy.day + 1 },
    }))
  },
  addReputation: (colonia, delta) =>
    set((s) => {
      const rep = aplicarRep(s.economy, colonia, delta)
      return {
        economy: {
          ...s.economy,
          reputation: rep.reputation,
          segundaDesbloqueada:
            s.economy.segundaDesbloqueada || rep.desbloqueaSegunda,
        },
        ...(rep.desbloqueaSegunda && { logroSegunda: true }),
        ...(rep.desbloqueaRadio && {
          notice: {
            id: ++noticeSeq,
            text: '¡Radio de despacho desbloqueado!',
          },
        }),
      }
    }),
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
  equiparPipa: (id) => {
    const s = get()
    if (!s.garage.pipas[id] || s.garage.equipada === id) return
    set({ garage: { ...s.garage, equipada: id } })
    // Con la pipa ya cambiada: setLiters mide contra la capacidad nueva y de
    // paso vuelve a sincronizar fillLevel, que es lo que ve la física.
    get().setLiters(s.economy.liters)
  },
  comprarMejora: (categoria) => {
    const s = get()
    const actual = s.garage.pipas[s.garage.equipada]
    if (!actual) return
    const compra = calcularCompra(actual, categoria, s.economy.money)
    if (!compra.ok) {
      s.showNotice(
        compra.motivo === 'AL_TOPE'
          ? `${MEJORAS[categoria].nombre} ya está al tope`
          : `No alcanza: faltan $${centavos((compra.costo ?? 0) - s.economy.money)}`,
      )
      return
    }
    /*
     * TODO en un solo set(): el autoguardado corre cada 5 s y no puede
     * sorprender la compra a medias, con el dinero cobrado y la mejora sin
     * poner. Por eso los litros se recalculan aquí y no con setLiters.
     */
    const capacidad = computeStats(compra.pipa).capacidadLitros
    const liters = clampLiters(s.economy.liters, balance, capacidad)
    s.vehicle.fillLevel = liters / capacidad
    set({
      garage: {
        ...s.garage,
        pipas: { ...s.garage.pipas, [s.garage.equipada]: compra.pipa },
      },
      economy: {
        ...s.economy,
        money: centavos(s.economy.money - compra.costo),
        liters,
      },
    })
    s.showNotice(`${MEJORAS[categoria].nombre} nivel ${compra.nivel}`)
  },
  comprarPipa: (id) => {
    const s = get()
    const compra = calcularCompraModelo(id, !!s.garage.pipas[id], s.economy.money)
    if (!compra.ok) {
      s.showNotice(
        compra.motivo === 'YA_LA_TIENES'
          ? `${MODELOS[id].nombre} ya es tuya`
          : `No alcanza: faltan $${centavos((compra.costo ?? 0) - s.economy.money)}`,
      )
      return
    }
    // Un solo set(), como en comprarMejora: el autoguardado no puede
    // sorprender la compra con el dinero cobrado y la pipa sin entregar.
    const capacidad = computeStats(compra.pipa).capacidadLitros
    const liters = clampLiters(s.economy.liters, balance, capacidad)
    s.vehicle.fillLevel = liters / capacidad
    set({
      garage: {
        pipas: { ...s.garage.pipas, [id]: compra.pipa },
        equipada: id,
      },
      economy: {
        ...s.economy,
        money: centavos(s.economy.money - compra.costo),
        liters,
      },
    })
    s.showNotice(`${MODELOS[id].nombre} es tuya`)
  },
  comprarEstilo: (cambio) => {
    const s = get()
    const actual = s.garage.pipas[s.garage.equipada]
    if (!actual) return
    const compra = aplicarCambio(actual, s.inventarioEstilo, cambio, s.economy.money)
    if (!compra.ok) {
      if (compra.motivo === 'SIN_DINERO')
        s.showNotice(`No alcanza: faltan $${centavos((compra.costo ?? 0) - s.economy.money)}`)
      // SIN_CAMBIO se queda callado: tocar lo puesto no es un error.
      return
    }
    // Un solo set(), como toda compra: el autoguardado de 5 s no puede
    // sorprenderla a medias. Comprar da de alta en el inventario; aplicar lo
    // tuyo pasa por aquí igual, con costo cero y el inventario intacto.
    set({
      garage: {
        ...s.garage,
        pipas: { ...s.garage.pipas, [s.garage.equipada]: compra.pipa },
      },
      inventarioEstilo: compra.inv,
      economy: { ...s.economy, money: centavos(s.economy.money - compra.costo) },
    })
    s.showNotice(compra.aviso)
  },
  togglePiezaEstilo: (pieza) => {
    const s = get()
    const actual = s.garage.pipas[s.garage.equipada]
    if (!actual) return
    const pipa = alternarPieza(actual, s.inventarioEstilo, pieza)
    if (!pipa) return
    set({
      garage: {
        ...s.garage,
        pipas: { ...s.garage.pipas, [s.garage.equipada]: pipa },
      },
    })
  },
  setMejora: (categoria, nivel) => {
    const s = get()
    const actual = s.garage.pipas[s.garage.equipada]
    if (!actual) return
    const pipa = {
      ...actual,
      mejoras: { ...actual.mejoras, [categoria]: nivel },
    }
    set({
      garage: {
        ...s.garage,
        pipas: { ...s.garage.pipas, [s.garage.equipada]: pipa },
      },
    })
    // El tanque cambia de tamaño con la mejora: los litros se recortan si ya
    // no caben (bajar de nivel) y fillLevel se re-deriva de la capacidad nueva.
    get().setLiters(s.economy.liters)
  },
  hydrate: (save) => {
    const { vehicle, player } = get()
    // El jugador también se queda donde estaba (guardados viejos no lo
    // traen: esos despiertan en el centro, como antes).
    if (save.playerPos) {
      player.pos.x = save.playerPos.x
      player.pos.y = save.playerPos.y
      player.pos.z = save.playerPos.z
    }
    player.yaw = save.playerYaw ?? 0
    // La pipa se queda donde la dejaste, también entre sesiones: el
    // componente lee esta posición del store al montar.
    vehicle.pos.x = save.vehiclePos.x
    vehicle.pos.y = save.vehiclePos.y
    vehicle.pos.z = save.vehiclePos.z
    vehicle.rot.x = save.vehicleRot.x
    vehicle.rot.y = save.vehicleRot.y
    vehicle.rot.z = save.vehicleRot.z
    vehicle.rot.w = save.vehicleRot.w
    /*
     * El garage va PRIMERO: la capacidad con la que se recortan los litros
     * sale de la pipa equipada, así que hidratarlo después dejaría el tanque
     * medido contra la pipa que no es. Un guardado sin garage (anterior a la
     * Fase 2) cae en el inicial, igual que el resto.
     */
    const garage = save.garage
      ? {
          pipas: { ...garageInicial().pipas, ...save.garage.pipas },
          equipada: save.garage.equipada,
        }
      : garageInicial()
    set({
      garage,
      // Guardados anteriores al inventario: amnistía — lo que las pipas
      // traían puesto o comprado se da por pagado.
      inventarioEstilo: save.inventarioEstilo ?? inventarioDesdeGarage(garage.pipas),
    })

    const capacidad = capacidadPipa()
    const liters = clampLiters(save.liters, balance, capacidad)
    vehicle.fillLevel = liters / capacidad
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
        radioPrioridad: save.radioPrioridad ?? 1,
        // Guardados anteriores al Paso 6: si la reputación ya estaba arriba
        // del umbral, la segunda se conserva sin ceremonia; si no, se pierde
        // — eso pide el paso («quítala del inicio»).
        segundaDesbloqueada:
          save.segundaDesbloqueada ??
          Object.values(save.reputation).some((r) => isSegundaUnlocked(r)),
      },
      // La foto del día es la reputación con la que se despierta.
      stats: newDayStats({ ...base.reputation, ...save.reputation }),
      summary: null,
    })
  },
  }
})
