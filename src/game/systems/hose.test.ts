import { describe, expect, it } from 'vitest'
import { balance, type Balance } from '../balance'
import {
  connectHit,
  esLimpio,
  flowTick,
  inZone,
  markerPos,
  pressureStep,
  zoneCenter,
} from './hose'

/*
 * Mismas dos capas que economy.test.ts: aritmética exacta contra un balance
 * fijo (B), e invariantes contra el balance real que cualquier rebalanceo en
 * leva tiene que respetar.
 */

const B: Balance = structuredClone(balance)
B.entrega = {
  maxSeconds: 10,
  flowInZone: 1000,
  flowLow: 200,
  spillRate: 300,
  badConnectSpill: 100,
  connectPeriod: 2,
  connectZoneSize: 0.2,
  pressureRise: 1,
  pressureFall: 2,
  zoneSize: 0.2,
  zoneCenterBase: 0.6,
  zoneAmp: 0.2,
  zoneSpeed: 1,
  cleanFraction: 0.02,
  cleanBonusPct: 0.1,
}

describe('markerPos', () => {
  it('va y viene una vez por periodo, entre 0 y 1', () => {
    expect(markerPos(0, B)).toBe(0)
    expect(markerPos(0.5, B)).toBe(0.5) // ida a medio camino
    expect(markerPos(1, B)).toBe(1) // punta
    expect(markerPos(1.5, B)).toBe(0.5) // de regreso
    expect(markerPos(2, B)).toBe(0) // ciclo completo
    expect(markerPos(2.5, B)).toBe(0.5)
  })
})

describe('connectHit', () => {
  it('conecta solo con el marcador en la zona central', () => {
    expect(connectHit(0.5, B)).toBe(true)
    expect(connectHit(0.4, B)).toBe(true) // frontera exacta
    expect(connectHit(0.39, B)).toBe(false)
    expect(connectHit(0.85, B)).toBe(false)
  })
})

describe('pressureStep', () => {
  it('sube manteniendo y cae soltando, a las velocidades del balance', () => {
    expect(pressureStep(0.5, true, 0.1, B)).toBeCloseTo(0.6, 10)
    expect(pressureStep(0.5, false, 0.1, B)).toBeCloseTo(0.3, 10)
  })

  it('nunca sale de [0, 1]', () => {
    expect(pressureStep(0.95, true, 1, B)).toBe(1)
    expect(pressureStep(0.05, false, 1, B)).toBe(0)
  })
})

describe('zoneCenter', () => {
  it('se pasea con el seno del tiempo', () => {
    expect(zoneCenter(0, B)).toBeCloseTo(0.6, 10)
    expect(zoneCenter(Math.PI / 2, B)).toBeCloseTo(0.8, 10)
  })

  it('la banda completa siempre cabe en la barra', () => {
    // Amplitud exagerada: el centro se recorta para que centro ± banda/2
    // se quede en [0, 1].
    const raro = structuredClone(B)
    raro.entrega.zoneAmp = 2
    for (let t = 0; t < 10; t += 0.25) {
      const c = zoneCenter(t, raro)
      expect(c - raro.entrega.zoneSize / 2).toBeGreaterThanOrEqual(0)
      expect(c + raro.entrega.zoneSize / 2).toBeLessThanOrEqual(1)
    }
  })
})

describe('inZone', () => {
  it('dentro con las fronteras incluidas', () => {
    expect(inZone(0.6, 0.6, B)).toBe(true)
    expect(inZone(0.5, 0.6, B)).toBe(true)
    expect(inZone(0.7, 0.6, B)).toBe(true)
    expect(inZone(0.49, 0.6, B)).toBe(false)
    expect(inZone(0.71, 0.6, B)).toBe(false)
  })
})

describe('flowTick', () => {
  // Banda en 0.6 ± 0.1 → bajo < 0.5, alto > 0.7.
  const base = { center: 0.6, dt: 0.1, remaining: 10_000 }

  it('en la banda fluye a tope y sin derrame', () => {
    expect(flowTick({ ...base, pressure: 0.6 }, B)).toEqual({
      delivered: 100,
      spilled: 0,
    })
    // Fronteras de la banda incluidas
    expect(flowTick({ ...base, pressure: 0.5 }, B).delivered).toBe(100)
    expect(flowTick({ ...base, pressure: 0.7 }, B).spilled).toBe(0)
  })

  it('debajo de la banda apenas fluye', () => {
    expect(flowTick({ ...base, pressure: 0.3 }, B)).toEqual({
      delivered: 20,
      spilled: 0,
    })
  })

  it('encima de la banda fluye a tope pero derramando', () => {
    expect(flowTick({ ...base, pressure: 0.9 }, B)).toEqual({
      delivered: 100,
      spilled: 30,
    })
  })

  it('al cliente nunca le entra más de lo que falta; el derrame sí es extra', () => {
    const t = flowTick({ ...base, pressure: 0.9, remaining: 40 }, B)
    expect(t.delivered).toBe(40)
    expect(t.spilled).toBe(30)
  })
})

describe('esLimpio', () => {
  it('tolera derrame en proporción al pedido', () => {
    expect(esLimpio(0, 5000, B)).toBe(true)
    expect(esLimpio(100, 5000, B)).toBe(true) // justo el 2%
    expect(esLimpio(101, 5000, B)).toBe(false)
  })

  it('fallar la conexión ya rompe lo limpio en pedidos chicos', () => {
    expect(esLimpio(B.entrega.badConnectSpill, 500, B)).toBe(false)
  })
})

describe('invariantes con el balance real', () => {
  it('una entrega perfecta del pedido más grande cabe en el tiempo máximo', () => {
    const e = balance.entrega
    const maxPedido = Math.max(
      ...Object.values(balance.perfiles).map((p) => p.litros.max),
    )
    // Presupuesto generoso: un ciclo entero del marcador para conectar más
    // subir la presión de cero, y aun así debe sobrar tiempo.
    const conectar = e.connectPeriod + 1 / e.pressureRise
    expect(conectar + maxPedido / e.flowInZone).toBeLessThan(e.maxSeconds)
  })

  it('derramar castiga: el flujo bajo es mucho menor que el bueno', () => {
    expect(balance.entrega.flowLow).toBeLessThan(balance.entrega.flowInZone / 2)
  })

  it('el umbral de limpio aguanta el polvo de un frame, no una conexión fallida', () => {
    const e = balance.entrega
    const minPedido = Math.min(
      ...Object.values(balance.perfiles).map((p) => p.litros.min),
    )
    expect(e.badConnectSpill).toBeGreaterThan(minPedido * e.cleanFraction)
  })
})
