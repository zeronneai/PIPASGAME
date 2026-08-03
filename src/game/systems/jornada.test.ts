import { describe, expect, it } from 'vitest'
import { balance, type Balance } from '../balance'
import {
  jornadaTerminada,
  newDayStats,
  resumenJornada,
} from './jornada'

const B: Balance = structuredClone(balance)
B.jornada.minutosReales = 10
B.reputacion.start = 50

describe('jornadaTerminada', () => {
  it('el día dura exactamente minutosReales', () => {
    expect(jornadaTerminada(599.9, B)).toBe(false)
    expect(jornadaTerminada(600, B)).toBe(true)
    expect(jornadaTerminada(9999, B)).toBe(true)
  })
})

describe('newDayStats', () => {
  it('arranca en ceros con la foto de la reputación', () => {
    const s = newDayStats({ centro: 62 })
    expect(s.litrosVendidos).toBe(0)
    expect(s.ingresos).toBe(0)
    expect(s.entregas).toEqual({ aTiempo: 0, tarde: 0, muyTarde: 0 })
    expect(s.repInicial.centro).toBe(62)
  })

  it('la foto es copia, no referencia: la reputación viva no la mueve', () => {
    const viva = { centro: 50 }
    const s = newDayStats(viva)
    viva.centro = 80
    expect(s.repInicial.centro).toBe(50)
  })
})

describe('resumenJornada', () => {
  const stats = {
    ...newDayStats({ centro: 50 }),
    litrosVendidos: 4200,
    ingresos: 612.5,
    gastoAgua: 210.0,
    entregas: { aTiempo: 3, tarde: 1, muyTarde: 0 },
    canceladas: 1,
  }

  it('la neta es ingresos menos agua, a centavos', () => {
    const r = resumenJornada(
      { stats, day: 3, repFinal: { centro: 58 }, colonia: 'centro' },
      B,
    )
    expect(r.neta).toBe(402.5)
    expect(r.day).toBe(3)
    expect(r.litrosVendidos).toBe(4200)
    expect(r.canceladas).toBe(1)
  })

  it('el cambio de reputación es contra la foto del arranque', () => {
    const r = resumenJornada(
      { stats, day: 3, repFinal: { centro: 58 }, colonia: 'centro' },
      B,
    )
    expect(r.repAntes).toBe(50)
    expect(r.repDespues).toBe(58)
  })

  it('una colonia sin datos cae al valor inicial del balance, sin delta fantasma', () => {
    const r = resumenJornada(
      { stats: newDayStats({}), day: 1, repFinal: {}, colonia: 'norte' },
      B,
    )
    expect(r.repAntes).toBe(50)
    expect(r.repDespues).toBe(50)
  })

  it('invariante con el balance real: la jornada dura entre 10 y 15 minutos (sección 2.9)', () => {
    expect(balance.jornada.minutosReales).toBeGreaterThanOrEqual(10)
    expect(balance.jornada.minutosReales).toBeLessThanOrEqual(15)
  })
})
