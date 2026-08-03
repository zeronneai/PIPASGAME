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
  clampLiters,
  orderClock,
  settleDelivery,
  settleRefill,
  type Pedido,
  type Puntualidad,
} from '../game/systems/economy'
import { esLimpio } from '../game/systems/hose'
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
  kind: 'BOARD' | 'EXIT' | 'SERVICE' | 'REFILL' | 'DELIVER'
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
  /** Tu lugar en la lista del despacho, 0..1 (Paso 7). Baja al rechazar
   *  llamadas, se recupera al aceptarlas, y persiste entre sesiones. */
  radioPrioridad: number
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

/**
 * Aplica un delta de reputación a una colonia y avisa si ese cambio cruzó
 * el umbral del radio (el hito de la fase, sección 2.7) hacia arriba. Todas
 * las consecuencias del Paso 6 pasan por aquí para no repetir el cruce.
 */
function aplicarRep(
  economy: EconomyState,
  colonia: string,
  delta: number,
): { reputation: Record<string, number>; desbloqueaRadio: boolean } {
  const antes = economy.reputation[colonia] ?? newReputation()
  const despues = applyRep(antes, delta)
  return {
    reputation: { ...economy.reputation, [colonia]: despues },
    desbloqueaRadio: !isRadioUnlocked(antes) && isRadioUnlocked(despues),
  }
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
  radioPrioridad: 1,
})

type GameState = {
  mode: GameMode
  economy: EconomyState
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
  clock: { daySeconds: 0 },
  camera: { phi: 0 },
  offer: null,
  notice: null,
  delivery: null,
  radioCall: null,
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
  offerService: (clientId) => {
    const s = get()
    const cliente = getCliente(clientId)
    if (!cliente || s.offer) return

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
      set({
        offer: {
          clientId,
          name: cliente.name,
          perfil: cliente.perfil,
          colonia: cliente.colonia,
          litros,
          windowMinutes,
          estimate,
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
      colonia: offer.colonia,
      perfil: offer.perfil,
      liters: offer.litros,
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
  startDelivery: (clientId) => {
    const s = get()
    if (s.delivery) return
    const pedido = s.economy.orders.find((o) => o.clientId === clientId)
    if (!pedido) return
    const cliente = getCliente(clientId)
    const nombre = cliente?.name ?? clientId
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
    s.vehicle.fillLevel = settled.liters / balance.tank.capacity
    const nombre = getCliente(pedido.clientId)?.name ?? pedido.clientId
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
        economy: {
          ...st.economy,
          money: settled.money,
          liters: settled.liters,
          reputation: rep.reputation,
          orders: st.economy.orders.filter((o) => o.id !== pedido.id),
          clientHistory: { ...st.economy.clientHistory, [pedido.clientId]: h },
        },
      }
    })
  },
  abortDelivery: (spilled) => {
    const s = get()
    const d = s.delivery
    if (!d) return
    const liters = clampLiters(s.economy.liters - Math.max(0, spilled))
    s.vehicle.fillLevel = liters / balance.tank.capacity
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
      colonia: radioCall.colonia,
      perfil: radioCall.perfil,
      liters: radioCall.litros,
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
  addReputation: (colonia, delta) =>
    set((s) => {
      const rep = aplicarRep(s.economy, colonia, delta)
      return {
        economy: { ...s.economy, reputation: rep.reputation },
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
        radioPrioridad: save.radioPrioridad ?? 1,
      },
    })
  },
}))
