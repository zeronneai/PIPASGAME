import { balance, type Balance } from '../balance'
import type { PerfilCliente } from './clients'
import type { Puntualidad } from './economy'

/*
 * Reputación como funciones puras. La reputación es POR COLONIA (sección
 * 2.7): estas funciones operan sobre el número de una colonia; el store
 * guarda el Record<colonia, number>.
 */

/** Reputación inicial de una colonia recién conocida. */
export function newReputation(b: Balance = balance): number {
  return b.reputacion.start
}

/** Aplica un delta y lo mantiene dentro de [min, max]. */
export function applyRep(
  current: number,
  delta: number,
  b: Balance = balance,
): number {
  return Math.min(b.reputacion.max, Math.max(b.reputacion.min, current + delta))
}

/**
 * Delta por una entrega. Sale del perfil: surtir a un exigente a tiempo es
 * lo que más sube (sección 2.7), y fallarle es lo que más tumba —su
 * `veryLate` ya es el castigo de la cancelación.
 */
export function deliveryRepDelta(
  puntualidad: Puntualidad,
  perfil: PerfilCliente,
  b: Balance = balance,
): number {
  const rep = b.perfiles[perfil].rep
  switch (puntualidad) {
    case 'A_TIEMPO':
      return rep.onTime
    case 'TARDE':
      return rep.late
    case 'MUY_TARDE':
      return rep.veryLate
  }
}

export type RepEvent = 'MINIJUEGO_LIMPIO' | 'DERRAME' | 'CANCELACION'

/** Deltas que no dependen del perfil (minijuego del Paso 5, cancelaciones). */
export function eventRepDelta(event: RepEvent, b: Balance = balance): number {
  switch (event) {
    case 'MINIJUEGO_LIMPIO':
      return b.reputacion.minijuegoLimpio
    case 'DERRAME':
      return b.reputacion.derrame
    case 'CANCELACION':
      return b.reputacion.cancelacion
  }
}

/** El hito de progresión de la fase: con esta reputación llega el radio. */
export function isRadioUnlocked(rep: number, b: Balance = balance): boolean {
  return rep >= b.reputacion.radioUnlock
}

/**
 * Multiplicador de la propina según la reputación de la colonia (la conexión
 * con los pagos, Paso 6): interpola de tipFactorMin a tipFactorMax. Lo
 * consumen deliveryPayment al cobrar y la oferta al prometer.
 */
export function tipRepFactor(rep: number, b: Balance = balance): number {
  const r = b.reputacion
  const norm = Math.min(1, Math.max(0, rep / r.max))
  return r.tipFactorMin + (r.tipFactorMax - r.tipFactorMin) * norm
}
