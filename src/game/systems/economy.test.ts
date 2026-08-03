import { describe, expect, it } from 'vitest'
import { balance, type Balance } from '../balance'
import {
  clampLiters,
  classifyPunctuality,
  deliveryPayment,
  estimateOffer,
  refillCost,
  refillSeconds,
} from './economy'

/*
 * Dos capas de tests, a propósito:
 *
 * 1. Aritmética EXACTA contra un balance fijo (B): estos números no son los
 *    del juego, son números redondos para poder verificar la fórmula a mano.
 *    Rebalancear balance.ts jamás rompe estos tests.
 * 2. INVARIANTES contra el balance real: cosas que tienen que seguir siendo
 *    ciertas se muevan como se muevan los números (el exigente paga más por
 *    litro, tarde paga menos que a tiempo…). Si un rebalanceo viola una de
 *    estas, el juego se rompió de verdad y este test lo dice.
 */

const B: Balance = structuredClone(balance)
B.tank.capacity = 1000
B.pozo.pricePerLiter = 0.1
B.pozo.litersPerSecond = 100
B.perfiles.paciente = {
  sellPricePerLiter: 1,
  tipPct: 0.1,
  windowMinutes: 10,
  lateFactor: 2,
  latePayFactor: 0.5,
  veryLatePayFactor: 0.25,
  litros: { min: 100, max: 200 },
  rep: { onTime: 2, late: 0, veryLate: -3 },
}
B.perfiles.exigente.windowMinutes = 10
B.perfiles.exigente.lateFactor = 1.2

describe('clampLiters', () => {
  it('recorta al rango [0, capacidad]', () => {
    expect(clampLiters(-50, B)).toBe(0)
    expect(clampLiters(500, B)).toBe(500)
    expect(clampLiters(99999, B)).toBe(1000)
  })
})

describe('refillCost', () => {
  it('cobra litros por precio de compra', () => {
    expect(refillCost(1000, B)).toBe(100)
    expect(refillCost(0, B)).toBe(0)
  })

  it('redondea a centavos', () => {
    B.pozo.pricePerLiter = 0.0333
    expect(refillCost(100, B)).toBe(3.33)
    B.pozo.pricePerLiter = 0.1
  })

  it('los litros negativos no regalan dinero', () => {
    expect(refillCost(-500, B)).toBe(0)
  })
})

describe('refillSeconds', () => {
  it('es proporcional a los litros', () => {
    expect(refillSeconds(1000, B)).toBe(10)
    expect(refillSeconds(500, B)).toBe(5)
    expect(refillSeconds(0, B)).toBe(0)
  })

  it('llenar de cero con el balance real toma cerca de un minuto (sección 2.2)', () => {
    const s = refillSeconds(balance.tank.capacity)
    expect(s).toBeGreaterThan(40)
    expect(s).toBeLessThan(90)
  })
})

describe('classifyPunctuality', () => {
  it('dentro de la ventana es a tiempo, incluida la frontera', () => {
    expect(classifyPunctuality(0, 10, 'paciente', B)).toBe('A_TIEMPO')
    expect(classifyPunctuality(10, 10, 'paciente', B)).toBe('A_TIEMPO')
  })

  it('pasada la ventana es tarde hasta lateFactor ventanas, incluida la frontera', () => {
    expect(classifyPunctuality(10.01, 10, 'paciente', B)).toBe('TARDE')
    expect(classifyPunctuality(20, 10, 'paciente', B)).toBe('TARDE')
    expect(classifyPunctuality(20.01, 10, 'paciente', B)).toBe('MUY_TARDE')
  })

  it('la misma demora puede ser tarde para el paciente y muy tarde para el exigente', () => {
    // 15 min con ventana de 10: paciente tolera hasta 20, exigente hasta 12.
    expect(classifyPunctuality(15, 10, 'paciente', B)).toBe('TARDE')
    expect(classifyPunctuality(15, 10, 'exigente', B)).toBe('MUY_TARDE')
  })

  it('invariante con el balance real: el exigente tolera menos que el paciente', () => {
    expect(balance.perfiles.exigente.lateFactor).toBeLessThan(
      balance.perfiles.paciente.lateFactor,
    )
  })
})

describe('deliveryPayment', () => {
  it('a tiempo paga base más propina', () => {
    const pago = deliveryPayment(
      { liters: 100, perfil: 'paciente', puntualidad: 'A_TIEMPO' },
      B,
    )
    expect(pago).toEqual({ total: 110, base: 100, tip: 10, cancelled: false })
  })

  it('tarde paga la fracción del perfil y pierde la propina', () => {
    const pago = deliveryPayment(
      { liters: 100, perfil: 'paciente', puntualidad: 'TARDE' },
      B,
    )
    expect(pago.total).toBe(50)
    expect(pago.tip).toBe(0)
    expect(pago.cancelled).toBe(false)
  })

  it('muy tarde el paciente paga lo mínimo, no cancela', () => {
    const pago = deliveryPayment(
      { liters: 100, perfil: 'paciente', puntualidad: 'MUY_TARDE' },
      B,
    )
    expect(pago.total).toBe(25)
    expect(pago.cancelled).toBe(false)
  })

  it('muy tarde el exigente cancela y no paga nada (sección 2.5)', () => {
    const pago = deliveryPayment(
      { liters: 100, perfil: 'exigente', puntualidad: 'MUY_TARDE' },
      B,
    )
    expect(pago.total).toBe(0)
    expect(pago.cancelled).toBe(true)
  })

  it('invariantes con el balance real, para cada perfil', () => {
    for (const perfil of ['paciente', 'normal', 'exigente'] as const) {
      const aTiempo = deliveryPayment({ liters: 1000, perfil, puntualidad: 'A_TIEMPO' })
      const tarde = deliveryPayment({ liters: 1000, perfil, puntualidad: 'TARDE' })
      const muyTarde = deliveryPayment({ liters: 1000, perfil, puntualidad: 'MUY_TARDE' })
      // Llegar más tarde nunca puede pagar igual o más.
      expect(aTiempo.total).toBeGreaterThan(tarde.total)
      expect(tarde.total).toBeGreaterThan(muyTarde.total)
      // Vender siempre deja margen sobre comprar esa misma agua en el pozo.
      expect(aTiempo.base).toBeGreaterThan(refillCost(1000))
    }
  })

  it('invariante del trade-off central: el exigente paga mejor por litro', () => {
    const b = balance.perfiles
    expect(b.exigente.sellPricePerLiter).toBeGreaterThan(b.normal.sellPricePerLiter)
    expect(b.normal.sellPricePerLiter).toBeGreaterThan(b.paciente.sellPricePerLiter)
  })
})

describe('estimateOffer', () => {
  it('coincide con el pago real de una entrega a tiempo', () => {
    const estimado = estimateOffer(100, 'paciente', B)
    const real = deliveryPayment(
      { liters: 100, perfil: 'paciente', puntualidad: 'A_TIEMPO' },
      B,
    )
    expect(estimado).toBe(real.total)
  })
})
