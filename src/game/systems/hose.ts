import { balance, type Balance } from '../balance'

/*
 * La física del minijuego de la manguera (sección 2.6), pura y sin DOM:
 * el componente solo junta input (mantener presionado) con estas funciones
 * y pinta el resultado. Todo es determinista —el vaivén de la banda es un
 * seno del tiempo, no un random— así que se puede testear frame a frame.
 *
 * Unidades: presión y posiciones en fracción 0..1 de la barra; tiempo en
 * segundos; agua en litros.
 */

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))

/* ---- Fase 1: conectar ---- */

/**
 * Posición del marcador de conexión: onda triangular, va y viene una vez
 * por connectPeriod. Tocar con el marcador dentro de la zona conecta.
 */
export function markerPos(t: number, b: Balance = balance): number {
  const fase = (Math.max(0, t) / b.entrega.connectPeriod) % 1
  return fase < 0.5 ? fase * 2 : 2 - fase * 2
}

/** ¿El tap conectó? La zona buena está centrada en la barra. */
export function connectHit(pos: number, b: Balance = balance): boolean {
  return Math.abs(pos - 0.5) <= b.entrega.connectZoneSize / 2
}

/* ---- Fase 2: presión ---- */

/** La presión sube mientras mantienes y cae al soltar, siempre en [0, 1]. */
export function pressureStep(
  pressure: number,
  holding: boolean,
  dt: number,
  b: Balance = balance,
): number {
  const delta = holding ? b.entrega.pressureRise : -b.entrega.pressureFall
  return clamp01(pressure + delta * Math.max(0, dt))
}

/** Centro de la banda buena en el instante t. El seno la pasea despacio;
 *  el clamp garantiza que la banda completa siempre cabe en la barra. */
export function zoneCenter(t: number, b: Balance = balance): number {
  const e = b.entrega
  const c = e.zoneCenterBase + e.zoneAmp * Math.sin(t * e.zoneSpeed)
  const medio = e.zoneSize / 2
  return Math.min(1 - medio, Math.max(medio, c))
}

export function inZone(
  pressure: number,
  center: number,
  b: Balance = balance,
): boolean {
  return Math.abs(pressure - center) <= b.entrega.zoneSize / 2
}

/**
 * Un frame de flujo: cuántos litros ENTRAN al cliente y cuántos se derraman.
 * En la banda fluye a tope y limpio; por debajo apenas fluye (pierdes
 * tiempo); por encima fluye a tope PERO derramando (pierdes agua). El flujo
 * al cliente nunca pasa de lo que falta del pedido; el derrame sí es extra.
 */
export function flowTick(
  args: { pressure: number; center: number; dt: number; remaining: number },
  b: Balance = balance,
): { delivered: number; spilled: number } {
  const e = b.entrega
  const dt = Math.max(0, args.dt)
  const alto = args.center + e.zoneSize / 2
  const bajo = args.center - e.zoneSize / 2

  if (args.pressure < bajo) {
    return { delivered: Math.min(args.remaining, e.flowLow * dt), spilled: 0 }
  }
  const delivered = Math.min(args.remaining, e.flowInZone * dt)
  if (args.pressure > alto) {
    return { delivered, spilled: e.spillRate * dt }
  }
  return { delivered, spilled: 0 }
}

/* ---- El veredicto ---- */

/** Limpio = casi nada derramado, en proporción al pedido. Da bono y (en el
 *  Paso 6) reputación; el umbral hace que fallar la conexión ya lo rompa. */
export function esLimpio(
  spilled: number,
  wanted: number,
  b: Balance = balance,
): boolean {
  return spilled <= wanted * b.entrega.cleanFraction
}
