import { balance, type Balance } from '../balance'
import type { Cliente, ClientHistory } from './clients'
import { estimateOffer } from './economy'
import { tipRepFactor } from './reputation'

/*
 * El sistema de aceptación (sección 2.4) como funciones puras: entra el
 * estado del mundo, sale una probabilidad y sus factores. El resultado sigue
 * siendo aleatorio, pero cada factor es un número que se puede testear y
 * enseñar: cuando un cliente dice que no, se puede decir POR QUÉ.
 *
 * El azar entra solo por `rng`, inyectable: el juego pasa Math.random, los
 * tests pasan valores fijos.
 */

export type Rng = () => number

/* ---- El reloj de la jornada ---- */

/**
 * Hora del día (ej. 13.5 = 1:30 pm) a partir de los segundos transcurridos
 * de la jornada. Lineal entre startHour y endHour; pasada la jornada se queda
 * clavada en endHour (el fin del día es asunto del Paso 8).
 */
export function horaDelDia(daySeconds: number, b: Balance = balance): number {
  const j = b.jornada
  const progreso = Math.min(1, Math.max(0, daySeconds / (j.minutosReales * 60)))
  return j.startHour + progreso * (j.endHour - j.startHour)
}

/** «13.5» → «1:30 pm». Para el HUD y la pantalla del pedido. */
export function formatHora(hora: number): string {
  const h24 = Math.floor(hora)
  const min = Math.floor((hora - h24) * 60)
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  return `${h12}:${String(min).padStart(2, '0')} ${h24 < 12 ? 'am' : 'pm'}`
}

export function dentroDeHorario(
  hora: number,
  horario: { abre: number; cierra: number },
): boolean {
  return hora >= horario.abre && hora < horario.cierra
}

/* ---- Los factores ---- */

/**
 * Multiplicador por historial con ESTE cliente («si le has surtido bien,
 * casi siempre acepta; si le fallaste, casi nunca»). Sin trato previo es
 * neutro: el desconocido carga solo con la reputación de la colonia.
 * Tarde cuenta media entrega buena; muy tarde y cancelado cuentan cero.
 */
export function historialFactor(
  h: ClientHistory,
  b: Balance = balance,
): number {
  const total = h.entregas + h.cancelados
  if (total === 0) return 1
  const score = (h.aTiempo + 0.5 * h.tarde) / total
  const a = b.aceptacion
  return a.historyMin + (a.historyMax - a.historyMin) * score
}

/** Multiplicador por «ya tiene agua» (sección 2.4). */
export function aguaFactor(
  h: ClientHistory,
  day: number,
  b: Balance = balance,
): number {
  if (h.lastServedDay === day) return b.aceptacion.servedTodayFactor
  if (h.lastServedDay === day - 1) return b.aceptacion.servedYesterdayFactor
  return 1
}

/**
 * Minutos que faltan del enfriamiento tras un «no»; 0 = ya puede preguntar.
 * Solo aplica dentro del mismo día. Si el momento del rechazo no es un
 * pasado válido (guardado viejo sin el campo, o el reloj se reinició al
 * recargar), se perdona: sin evidencia, no hay castigo.
 */
export function cooldownRestante(
  h: ClientHistory,
  day: number,
  daySeconds: number,
  b: Balance = balance,
): number {
  if (h.lastDeclinedDay !== day) return 0
  const at = h.lastDeclinedSeconds ?? null
  if (at === null || at > daySeconds) return 0
  const restante = b.aceptacion.cooldownMinutes - (daySeconds - at) / 60
  return Math.max(0, restante)
}

export type FactoresAceptacion = {
  /** Probabilidad base que puso la reputación (el factor de mayor peso). */
  rep: number
  hora: number
  historial: number
  agua: number
}

/** La probabilidad ponderada de la sección 2.4, con su desglose. */
export function acceptanceChance(
  args: {
    cliente: Cliente
    /** Reputación 0..max en la colonia del cliente. */
    rep: number
    hora: number
    history: ClientHistory
    day: number
  },
  b: Balance = balance,
): { p: number; factores: FactoresAceptacion } {
  const a = b.aceptacion
  const repNorm = Math.min(1, Math.max(0, args.rep / b.reputacion.max))
  const factores: FactoresAceptacion = {
    rep: a.repChanceMin + (a.repChanceMax - a.repChanceMin) * repNorm,
    hora: dentroDeHorario(args.hora, args.cliente.horario)
      ? 1
      : a.offHoursFactor,
    historial: historialFactor(args.history, b),
    agua: aguaFactor(args.history, args.day, b),
  }
  const cruda = factores.rep * factores.hora * factores.historial * factores.agua
  return {
    p: Math.min(a.chanceMax, Math.max(a.chanceMin, cruda)),
    factores,
  }
}

/* ---- La oferta ---- */

/** Lo que el cliente pone sobre la mesa; el jugador decide (pantalla Paso 3). */
export type Oferta = {
  clientId: string
  litros: number
  windowMinutes: number
  /** Pago del mejor caso —a tiempo, con propina—, que es lo que está en juego. */
  estimate: number
}

export function generarOferta(
  cliente: Cliente,
  b: Balance = balance,
  rng: Rng = Math.random,
  /** De tipRepFactor con la reputación actual: se promete lo que se pagaría. */
  tipFactor: number = 1,
): Oferta {
  const perfil = b.perfiles[cliente.perfil]
  const paso = b.aceptacion.litersStep
  const min = Math.ceil(perfil.litros.min / paso)
  const max = Math.max(min, Math.floor(perfil.litros.max / paso))
  const litros = Math.min(max, min + Math.floor(rng() * (max - min + 1))) * paso
  return {
    clientId: cliente.id,
    litros,
    windowMinutes: perfil.windowMinutes,
    estimate: estimateOffer(litros, cliente.perfil, tipFactor, b),
  }
}

/* ---- El veredicto ---- */

export type MotivoRechazo =
  | 'FUERA_DE_HORARIO'
  | 'YA_SURTIDO'
  | 'HISTORIAL'
  | 'REPUTACION'
  | 'SUERTE'

export type ResultadoOferta =
  /** Ni siquiera tira el dado: pedido activo o enfriamiento vigente. */
  | { kind: 'NO_DISPONIBLE'; motivo: 'YA_PIDIO' | 'ENFRIAMIENTO'; cooldownMin: number }
  | { kind: 'OFERTA'; oferta: Oferta; p: number }
  | { kind: 'RECHAZO'; motivo: MotivoRechazo; p: number }

/**
 * El motivo que se le da al jugador cuando el dado sale mal: el multiplicador
 * que MÁS castigó. Si ninguno castigó y la base de reputación quedó por
 * debajo del punto medio de su rango, fue la reputación; si tampoco, fue
 * pura suerte y se dice tal cual.
 */
export function motivoDominante(
  f: FactoresAceptacion,
  b: Balance = balance,
): MotivoRechazo {
  const castigos: [number, MotivoRechazo][] = [
    [f.hora, 'FUERA_DE_HORARIO'],
    [f.agua, 'YA_SURTIDO'],
    [f.historial, 'HISTORIAL'],
  ]
  let peor = 1
  let motivo: MotivoRechazo = 'SUERTE'
  for (const [factor, m] of castigos) {
    if (factor < peor) {
      peor = factor
      motivo = m
    }
  }
  if (motivo !== 'SUERTE') return motivo
  const a = b.aceptacion
  return f.rep < (a.repChanceMin + a.repChanceMax) / 2 ? 'REPUTACION' : 'SUERTE'
}

/**
 * Todo el «Ofrecer servicio» en una llamada: guardas primero (pedido activo,
 * enfriamiento), luego el dado contra la probabilidad ponderada, y si acepta,
 * la oferta generada. Quien llama aplica las consecuencias al estado.
 */
export function evaluarOferta(
  args: {
    cliente: Cliente
    rep: number
    history: ClientHistory
    day: number
    daySeconds: number
    tienePedidoActivo: boolean
  },
  b: Balance = balance,
  rng: Rng = Math.random,
): ResultadoOferta {
  if (args.tienePedidoActivo)
    return { kind: 'NO_DISPONIBLE', motivo: 'YA_PIDIO', cooldownMin: 0 }

  const cd = cooldownRestante(args.history, args.day, args.daySeconds, b)
  if (cd > 0)
    return { kind: 'NO_DISPONIBLE', motivo: 'ENFRIAMIENTO', cooldownMin: cd }

  const { p, factores } = acceptanceChance(
    {
      cliente: args.cliente,
      rep: args.rep,
      hora: horaDelDia(args.daySeconds, b),
      history: args.history,
      day: args.day,
    },
    b,
  )
  if (rng() < p)
    return {
      kind: 'OFERTA',
      oferta: generarOferta(args.cliente, b, rng, tipRepFactor(args.rep, b)),
      p,
    }
  return { kind: 'RECHAZO', motivo: motivoDominante(factores, b), p }
}
