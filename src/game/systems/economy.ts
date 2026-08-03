import { balance, type Balance } from '../balance'
import type { PerfilCliente } from './clients'

/*
 * La economía como funciones puras (sección 3 del doc de Fase 1): entra
 * estado, salen números. Nada de React ni de store, para poder testearlas
 * y para que un bug aquí se encuentre en un test y no «sintiendo que el
 * juego está mal balanceado».
 *
 * Todas reciben el balance como último parámetro con el objeto vivo por
 * defecto: el juego las llama sin él (y leva ajusta en vivo), los tests
 * pasan uno fijo (y los números de balance.ts pueden moverse sin romperlos).
 */

export type Puntualidad = 'A_TIEMPO' | 'TARDE' | 'MUY_TARDE'

/** Un pedido aceptado. La cola vive en el store; el reloj corre en Paso 4. */
export type Pedido = {
  id: string
  clientId: string
  colonia: string
  perfil: PerfilCliente
  liters: number
  /** Momento de aceptación en segundos del reloj de la jornada. */
  acceptedAt: number
  /** Ventana pactada en minutos reales. Se copia del perfil al aceptar para
   *  que rebalancear en leva no mueva pedidos ya aceptados. */
  windowMinutes: number
}

export function clampLiters(liters: number, b: Balance = balance): number {
  return Math.min(b.tank.capacity, Math.max(0, liters))
}

/** Redondeo a centavos. Todo el dinero que sale de aquí ya pasó por esto. */
const centavos = (n: number) => Math.round(n * 100) / 100

/** Lo que cuesta comprar `liters` en el pozo (sección 2.2). */
export function refillCost(liters: number, b: Balance = balance): number {
  return centavos(Math.max(0, liters) * b.pozo.pricePerLiter)
}

/** Segundos reales que tarda cargar `liters`. Llenar de cero ≈ un minuto. */
export function refillSeconds(liters: number, b: Balance = balance): number {
  return Math.max(0, liters) / b.pozo.litersPerSecond
}

/**
 * Clasifica una entrega según el reloj del pedido (sección 2.5):
 * dentro de la ventana → a tiempo; hasta `lateFactor` ventanas → tarde;
 * después → muy tarde. La tolerancia es del PERFIL: la misma demora puede
 * ser «tarde» para Doña Chela y «muy tarde» para la obra.
 */
export function classifyPunctuality(
  elapsedMinutes: number,
  windowMinutes: number,
  perfil: PerfilCliente,
  b: Balance = balance,
): Puntualidad {
  if (elapsedMinutes <= windowMinutes) return 'A_TIEMPO'
  if (elapsedMinutes <= windowMinutes * b.perfiles[perfil].lateFactor)
    return 'TARDE'
  return 'MUY_TARDE'
}

export type Pago = {
  /** Lo que entra a la cartera. 0 si el pedido se canceló. */
  total: number
  /** Pago base (litros × precio del perfil), informativo para el resumen. */
  base: number
  /** Propina. Solo existe a tiempo. */
  tip: number
  /** true cuando el exigente cancela por muy tarde: no hay pago y el que
   *  llama debe registrar la cancelación en historial y reputación. */
  cancelled: boolean
}

/** El pago de una entrega según puntualidad y perfil (tabla de la sección 2.3). */
export function deliveryPayment(
  args: { liters: number; perfil: PerfilCliente; puntualidad: Puntualidad },
  b: Balance = balance,
): Pago {
  const p = b.perfiles[args.perfil]
  const base = args.liters * p.sellPricePerLiter

  switch (args.puntualidad) {
    case 'A_TIEMPO': {
      const tip = base * p.tipPct
      return { total: centavos(base + tip), base: centavos(base), tip: centavos(tip), cancelled: false }
    }
    case 'TARDE':
      return { total: centavos(base * p.latePayFactor), base: centavos(base), tip: 0, cancelled: false }
    case 'MUY_TARDE': {
      // El exigente no espera: cancela y no paga (sección 2.5).
      if (args.perfil === 'exigente')
        return { total: 0, base: centavos(base), tip: 0, cancelled: true }
      return { total: centavos(base * p.veryLatePayFactor), base: centavos(base), tip: 0, cancelled: false }
    }
  }
}

/**
 * El pago que se le enseña al jugador ANTES de aceptar (pantalla del Paso 3).
 * Es el mejor caso —a tiempo, con propina— porque eso es lo que está en juego.
 */
export function estimateOffer(
  liters: number,
  perfil: PerfilCliente,
  b: Balance = balance,
): number {
  const p = b.perfiles[perfil]
  return centavos(liters * p.sellPricePerLiter * (1 + p.tipPct))
}
