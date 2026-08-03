import { balance, type Balance } from '../balance'
import { dentroDeHorario, generarOferta, type Rng } from './acceptance'
import type { Cliente, ClientHistory, PerfilCliente } from './clients'
import { centavos, type Pedido } from './economy'

/*
 * El radio de despacho (sección 2.8) como funciones puras: quién puede
 * llamar, cada cuánto suena según tu prioridad, y qué trae la llamada.
 * El sistema que corre por frame (RadioDispatch) solo junta estas piezas.
 */

/** Una llamada entrante: todo lo que enseña la tarjeta, ya resuelto. */
export type RadioCall = {
  clientId: string
  name: string
  perfil: PerfilCliente
  colonia: string
  litros: number
  windowMinutes: number
  /** Ya con el factor del radio: lo prometido es lo que se cobra. */
  estimate: number
  /** Segundos del reloj de la jornada en que la llamada se pierde. */
  expiresAt: number
}

/**
 * Quiénes pueden llamar por radio ahora mismo: sin pedido activo contigo,
 * sin agua de hoy, y con el negocio abierto (nadie pide agua a deshoras).
 */
export function elegiblesParaRadio(args: {
  clientes: Cliente[]
  orders: Pedido[]
  history: Record<string, ClientHistory>
  day: number
  hora: number
}): Cliente[] {
  const conPedido = new Set(args.orders.map((o) => o.clientId))
  return args.clientes.filter((c) => {
    if (conPedido.has(c.id)) return false
    if (args.history[c.id]?.lastServedDay === args.day) return false
    return dentroDeHorario(args.hora, c.horario)
  })
}

/**
 * Segundos hasta la siguiente llamada. La prioridad DIVIDE el intervalo:
 * con 0.5 el radio suena la mitad de seguido. Ese es todo el castigo por
 * rechazar de más — nunca te cortan, solo te dejan al final de la lista.
 */
export function intervaloLlamada(
  prioridad: number,
  b: Balance = balance,
  rng: Rng = Math.random,
): number {
  const r = b.radio
  const base = r.intervaloMin + rng() * (r.intervaloMax - r.intervaloMin)
  return base / Math.min(1, Math.max(r.prioridadMin, prioridad))
}

export function prioridadTrasRechazo(p: number, b: Balance = balance): number {
  return Math.max(b.radio.prioridadMin, p - b.radio.bajaPorRechazo)
}

export function prioridadTrasAceptar(p: number, b: Balance = balance): number {
  return Math.min(1, p + b.radio.recuperaPorAceptar)
}

/**
 * Arma la llamada: litros y ventana del perfil (misma generación que la
 * oferta a pie) y el estimado con la propina de tu reputación Y el factor
 * del radio encima. Pagan mejor porque no gastaste tiempo caminando.
 */
export function generarLlamada(
  cliente: Cliente,
  args: { tipFactor: number; ahora: number },
  b: Balance = balance,
  rng: Rng = Math.random,
): RadioCall {
  const oferta = generarOferta(cliente, b, rng, args.tipFactor)
  return {
    clientId: cliente.id,
    name: cliente.name,
    perfil: cliente.perfil,
    colonia: cliente.colonia,
    litros: oferta.litros,
    windowMinutes: oferta.windowMinutes,
    estimate: centavos(oferta.estimate * b.radio.payFactor),
    expiresAt: args.ahora + b.radio.timeoutLlamada,
  }
}
