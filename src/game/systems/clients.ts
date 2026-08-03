/*
 * Los clientes y su historial. Solo datos y funciones puras: nada de React,
 * nada de three, nada de store (regla de la sección 3 del doc de Fase 1).
 *
 * El perfil de cada local NO cambia nunca (sección 2.3): el jugador lo va
 * aprendiendo, y esa memoria es parte del juego. Por eso es un directorio
 * fijo y no algo generado.
 */

// Solo el tipo: el ciclo clients ⇄ economy es de tipos y se borra al compilar.
import type { Puntualidad } from './economy'

export type PerfilCliente = 'paciente' | 'normal' | 'exigente'

export type Colonia = {
  id: string
  name: string
}

/*
 * En Fase 1 hay una sola colonia, pero la reputación se guarda por colonia
 * desde ahora para que la Fase 3 no requiera rehacer el sistema (sección 2.7).
 */
export const COLONIAS: Record<string, Colonia> = {
  centro: { id: 'centro', name: 'Centro' },
}

export type Cliente = {
  /** Coincide con el id del local del greybox (layout.ts: local-1..local-6). */
  id: string
  /** Nombre con el que lo conoce el jugador. El perfil se aprende; el nombre
   *  ayuda a recordarlo («la obra no perdona, Doña Chela sí»). */
  name: string
  perfil: PerfilCliente
  colonia: string
  /**
   * Horario del negocio en horas del día (abre inclusivo, cierra exclusivo).
   * Fuera de él la aceptación cae en picada (sección 2.4: «a las 7 am una
   * fonda sí te compra, a las 4 pm ya no»). Es dato del cliente, como el
   * perfil: se aprende jugando, no cambia.
   */
  horario: { abre: number; cierra: number }
}

/** Los 6 locales del greybox, con perfil y colonia asignados (Paso 1). */
export const CLIENTES: Record<string, Cliente> = {
  'local-1': { id: 'local-1', name: 'Doña Chela', perfil: 'paciente', colonia: 'centro', horario: { abre: 8, cierra: 19 } },
  'local-2': { id: 'local-2', name: 'Fonda La Morena', perfil: 'normal', colonia: 'centro', horario: { abre: 7, cierra: 13 } },
  'local-3': { id: 'local-3', name: 'Tortillería El Comal', perfil: 'normal', colonia: 'centro', horario: { abre: 7, cierra: 14 } },
  'local-4': { id: 'local-4', name: 'La Obra', perfil: 'exigente', colonia: 'centro', horario: { abre: 8, cierra: 17 } },
  'local-5': { id: 'local-5', name: 'Purificadora Cristal', perfil: 'exigente', colonia: 'centro', horario: { abre: 9, cierra: 18 } },
  'local-6': { id: 'local-6', name: 'Don Rómulo', perfil: 'paciente', colonia: 'centro', horario: { abre: 10, cierra: 19 } },
}

export function getCliente(id: string): Cliente | null {
  return CLIENTES[id] ?? null
}

/*
 * Historial por cliente. Lo consume el sistema de aceptación del Paso 3
 * («si le has surtido bien, casi siempre acepta; si le fallaste, casi
 * nunca») y se persiste en localStorage desde el Paso 1.
 */
export type ClientHistory = {
  entregas: number
  aTiempo: number
  tarde: number
  muyTarde: number
  cancelados: number
  derrames: number
  /** Día de juego de la última entrega, para el «si le surtiste ayer, no
   *  necesita hoy» de la sección 2.4. null = nunca. */
  lastServedDay: number | null
  /** Día del último rechazo, para el enfriamiento del Paso 3. null = nunca. */
  lastDeclinedDay: number | null
  /**
   * Momento del rechazo en segundos del reloj de la jornada: el enfriamiento
   * es «un rato», no el día entero. Puede faltar en guardados viejos, así que
   * quien lo lea debe tratar undefined como null.
   */
  lastDeclinedSeconds: number | null
}

export function newClientHistory(): ClientHistory {
  return {
    entregas: 0,
    aTiempo: 0,
    tarde: 0,
    muyTarde: 0,
    cancelados: 0,
    derrames: 0,
    lastServedDay: null,
    lastDeclinedDay: null,
    lastDeclinedSeconds: null,
  }
}

/** Devuelve un historial NUEVO con la entrega registrada; no muta. */
export function withDelivery(
  h: ClientHistory,
  puntualidad: Puntualidad,
  day: number,
): ClientHistory {
  return {
    ...h,
    entregas: h.entregas + 1,
    aTiempo: h.aTiempo + (puntualidad === 'A_TIEMPO' ? 1 : 0),
    tarde: h.tarde + (puntualidad === 'TARDE' ? 1 : 0),
    muyTarde: h.muyTarde + (puntualidad === 'MUY_TARDE' ? 1 : 0),
    lastServedDay: day,
  }
}

/** Un pedido cancelado también enfría: acabas de quedarle mal. */
export function withCancellation(
  h: ClientHistory,
  day: number,
  daySeconds: number,
): ClientHistory {
  return {
    ...h,
    cancelados: h.cancelados + 1,
    lastDeclinedDay: day,
    lastDeclinedSeconds: daySeconds,
  }
}

export function withSpill(h: ClientHistory): ClientHistory {
  return { ...h, derrames: h.derrames + 1 }
}

/** Te dijo que no (o tú a él): arranca el enfriamiento del Paso 3. */
export function withDecline(
  h: ClientHistory,
  day: number,
  daySeconds: number,
): ClientHistory {
  return { ...h, lastDeclinedDay: day, lastDeclinedSeconds: daySeconds }
}
