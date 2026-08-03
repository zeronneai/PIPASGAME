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

/** Por qué se detuvo sola la carga. Cortarla a mano no pasa por aquí. */
export type RefillStop = 'TANQUE_LLENO' | 'SIN_DINERO'

/**
 * Un tick de carga en el pozo (sección 2.2): cuántos litros entran en `dt`
 * segundos y cuánto cuestan. Los litros los limita lo que quepa en el tanque
 * Y lo que alcance el dinero: el pozo no fía.
 *
 * `cost` sale SIN redondear a propósito: a 60 ticks por segundo, redondear
 * cada tick acumula error. Se redondea una sola vez, al liquidar la sesión
 * en settleRefill.
 */
export function refillTick(
  liters: number,
  money: number,
  dt: number,
  b: Balance = balance,
): { added: number; cost: number; stop: RefillStop | null } {
  const wanted = Math.max(0, dt) * b.pozo.litersPerSecond
  const headroom = Math.max(0, b.tank.capacity - liters)
  const affordable =
    b.pozo.pricePerLiter > 0
      ? Math.max(0, money) / b.pozo.pricePerLiter
      : Infinity
  const added = Math.min(wanted, headroom, affordable)
  // Lleno gana sobre quebrado: si ambos topan a la vez, la razón que se
  // muestra es la del tanque, que es la que el jugador puede ver en la barra.
  const stop =
    added >= headroom
      ? 'TANQUE_LLENO'
      : added >= affordable
        ? 'SIN_DINERO'
        : null
  return { added, cost: added * b.pozo.pricePerLiter, stop }
}

/** Si vale la pena ofrecer «Cargar agua»: cabe algo y alcanza para ≥1 litro. */
export function canStartRefill(
  liters: number,
  money: number,
  b: Balance = balance,
): boolean {
  return liters < b.tank.capacity && money >= b.pozo.pricePerLiter
}

/**
 * Liquida una sesión de carga: litros al tanque, costo a la cartera. Es el
 * ÚNICO punto donde el dinero de la carga se redondea a centavos; durante los
 * ticks el costo se acumula en crudo.
 */
export function settleRefill(
  wallet: { liters: number; money: number },
  session: { litersLoaded: number; cost: number },
  b: Balance = balance,
): { liters: number; money: number } {
  return {
    liters: clampLiters(wallet.liters + session.litersLoaded, b),
    money: centavos(wallet.money - session.cost),
  }
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

/** El reloj de UN pedido (sección 2.5): cada uno corre por su cuenta. */
export type OrderClock = {
  elapsedMinutes: number
  /** Minutos hasta el fin de la ventana; negativo = ya se pasó. */
  remainingMinutes: number
  puntualidad: Puntualidad
  /** true en el último tramo de la ventana (pedidos.warnFraction): aún vas
   *  a tiempo, pero ya es momento de apurarse. */
  warning: boolean
}

/**
 * Estado del reloj de un pedido en este instante. Deriva, no acumula: el
 * único estado real es acceptedAt, así que no hay relojes que se desincronicen
 * por muchos pedidos que corran en paralelo.
 */
export function orderClock(
  pedido: Pedido,
  daySeconds: number,
  b: Balance = balance,
): OrderClock {
  const elapsed = Math.max(0, daySeconds - pedido.acceptedAt) / 60
  const remaining = pedido.windowMinutes - elapsed
  const puntualidad = classifyPunctuality(
    elapsed,
    pedido.windowMinutes,
    pedido.perfil,
    b,
  )
  return {
    elapsedMinutes: elapsed,
    remainingMinutes: remaining,
    puntualidad,
    warning:
      puntualidad === 'A_TIEMPO' &&
      remaining <= pedido.windowMinutes * b.pedidos.warnFraction,
  }
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
 * Liquida una entrega completa (Paso 5): pago por los litros ENTREGADOS
 * (jugar lento surte menos y cobra menos), bono si fue limpia, y del tanque
 * sale todo lo que pasó por la manguera — entregado más derramado.
 */
export function settleDelivery(
  wallet: { liters: number; money: number },
  entrega: {
    delivered: number
    spilled: number
    perfil: PerfilCliente
    puntualidad: Puntualidad
    clean: boolean
  },
  b: Balance = balance,
): { liters: number; money: number; pago: Pago; bonus: number } {
  const pago = deliveryPayment(
    {
      liters: entrega.delivered,
      perfil: entrega.perfil,
      puntualidad: entrega.puntualidad,
    },
    b,
  )
  const bonus =
    entrega.clean && !pago.cancelled
      ? centavos(pago.total * b.entrega.cleanBonusPct)
      : 0
  return {
    liters: clampLiters(wallet.liters - entrega.delivered - entrega.spilled, b),
    money: centavos(wallet.money + pago.total + bonus),
    pago,
    bonus,
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
