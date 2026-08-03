import { balance, type Balance } from '../balance'
import { centavos } from './economy'

/*
 * La jornada (sección 2.9): el ciclo con principio y fin. Aquí vive lo puro
 * —cuándo termina el día y la aritmética del resumen—; el disparo corre en
 * DayClock y el estado en el store.
 */

/** Lo que el día va acumulando. Es transitorio: el resumen lo consume y el
 *  día siguiente arranca en ceros. */
export type DayStats = {
  litrosVendidos: number
  /** Todo lo cobrado: pagos más bonos. */
  ingresos: number
  /** Todo lo pagado en el pozo. */
  gastoAgua: number
  entregas: { aTiempo: number; tarde: number; muyTarde: number }
  /** Del exigente que canceló y de los pedidos que el cierre alcanzó. */
  canceladas: number
  /** Reputación por colonia al ARRANCAR el día: el «cambio» del resumen es
   *  contra esta foto. Copia, no referencia: la viva cambia con cada entrega. */
  repInicial: Record<string, number>
}

export function newDayStats(reputation: Record<string, number>): DayStats {
  return {
    litrosVendidos: 0,
    ingresos: 0,
    gastoAgua: 0,
    entregas: { aTiempo: 0, tarde: 0, muyTarde: 0 },
    canceladas: 0,
    repInicial: { ...reputation },
  }
}

/** El día dura minutosReales; después de eso, toca resumen. */
export function jornadaTerminada(
  daySeconds: number,
  b: Balance = balance,
): boolean {
  return daySeconds >= b.jornada.minutosReales * 60
}

/** La pantalla de fin de día (sección 2.9), ya calculada. */
export type ResumenJornada = {
  day: number
  litrosVendidos: number
  ingresos: number
  gastoAgua: number
  /** Lo que de verdad importa: ingresos menos agua. */
  neta: number
  entregas: { aTiempo: number; tarde: number; muyTarde: number }
  canceladas: number
  repAntes: number
  repDespues: number
}

export function resumenJornada(
  args: {
    stats: DayStats
    day: number
    /** Reputación por colonia al cerrar. */
    repFinal: Record<string, number>
    /** La colonia que se enseña (en Fase 1, la única). */
    colonia: string
  },
  b: Balance = balance,
): ResumenJornada {
  const repAntes = args.stats.repInicial[args.colonia] ?? b.reputacion.start
  return {
    day: args.day,
    litrosVendidos: args.stats.litrosVendidos,
    ingresos: args.stats.ingresos,
    gastoAgua: args.stats.gastoAgua,
    neta: centavos(args.stats.ingresos - args.stats.gastoAgua),
    entregas: args.stats.entregas,
    canceladas: args.stats.canceladas,
    repAntes,
    repDespues: args.repFinal[args.colonia] ?? repAntes,
  }
}
