import { describe, expect, it } from 'vitest'
import { balance, type Balance } from '../balance'
import {
  canStartRefill,
  clampLiters,
  classifyPunctuality,
  deliveryPayment,
  estimateOffer,
  orderClock,
  refillCost,
  refillSeconds,
  refillTick,
  settleDelivery,
  settleRefill,
  type Pedido,
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

describe('refillTick', () => {
  // B: capacidad 1000, precio 0.1, 100 L/s. Dinero de sobra salvo que se diga.

  it('mete litros proporcionales al tiempo y cobra el precio de compra', () => {
    expect(refillTick(0, 999, 1, B)).toEqual({ added: 100, cost: 10, stop: null })
    expect(refillTick(0, 999, 0.5, B)).toEqual({ added: 50, cost: 5, stop: null })
  })

  it('con dt 0 no pasa nada', () => {
    expect(refillTick(500, 999, 0, B)).toEqual({ added: 0, cost: 0, stop: null })
  })

  it('topa en la capacidad y avisa TANQUE_LLENO', () => {
    const t = refillTick(950, 999, 1, B)
    expect(t.added).toBe(50)
    expect(t.cost).toBe(5)
    expect(t.stop).toBe('TANQUE_LLENO')
  })

  it('topa en el dinero y avisa SIN_DINERO: el pozo no fía', () => {
    // Con $2 alcanzan 20 litros de los 100 que caben en el tick.
    const t = refillTick(0, 2, 1, B)
    expect(t.added).toBe(20)
    expect(t.cost).toBe(2)
    expect(t.stop).toBe('SIN_DINERO')
  })

  it('sin un centavo no carga nada', () => {
    expect(refillTick(0, 0, 1, B)).toEqual({ added: 0, cost: 0, stop: 'SIN_DINERO' })
    // El dinero negativo (polvo de floats) tampoco «debe» litros.
    expect(refillTick(0, -0.001, 1, B).added).toBe(0)
  })

  it('si lleno y quebrado coinciden, gana TANQUE_LLENO', () => {
    // $5 alcanzan justo los 50 litros que faltan.
    expect(refillTick(950, 5, 1, B).stop).toBe('TANQUE_LLENO')
  })

  it('invariante con el balance real: llenar de cero por ticks cuesta lo mismo que refillCost', () => {
    let liters = 0
    const money = 10_000
    let cost = 0
    // Ticks de 16 ms hasta topar, como en el juego.
    for (let i = 0; i < 10_000; i++) {
      const t = refillTick(liters, money - cost, 0.016)
      liters += t.added
      cost += t.cost
      if (t.stop) break
    }
    expect(liters).toBeCloseTo(balance.tank.capacity, 6)
    expect(cost).toBeCloseTo(refillCost(balance.tank.capacity), 2)
  })
})

describe('canStartRefill', () => {
  it('con espacio y dinero para al menos un litro, sí', () => {
    expect(canStartRefill(500, 100, B)).toBe(true)
  })

  it('con el tanque lleno, no', () => {
    expect(canStartRefill(1000, 100, B)).toBe(false)
  })

  it('sin dinero ni para un litro, no', () => {
    expect(canStartRefill(500, 0.05, B)).toBe(false)
  })
})

describe('settleRefill', () => {
  it('suma los litros y descuenta el costo redondeado a centavos', () => {
    const s = settleRefill(
      { liters: 200, money: 100 },
      { litersLoaded: 300, cost: 30.0049 },
      B,
    )
    expect(s.liters).toBe(500)
    expect(s.money).toBe(70) // 100 − 30.0049 → 69.9951 → 70.00
  })

  it('nunca deja el tanque por encima de la capacidad', () => {
    const s = settleRefill(
      { liters: 900, money: 100 },
      { litersLoaded: 200, cost: 20 },
      B,
    )
    expect(s.liters).toBe(1000)
  })
})

describe('settleDelivery', () => {
  B.entrega.cleanBonusPct = 0.1

  it('a tiempo y limpio: pago con propina más bono, litros fuera del tanque', () => {
    const s = settleDelivery(
      { liters: 1000, money: 100 },
      { delivered: 500, spilled: 0, perfil: 'paciente', puntualidad: 'A_TIEMPO', clean: true },
      B,
    )
    // 500 L × $1 × 1.1 propina = 550; bono 10% = 55.
    expect(s.pago.total).toBe(550)
    expect(s.bonus).toBe(55)
    expect(s.money).toBe(705)
    expect(s.liters).toBe(500)
  })

  it('tarde y con derrame: pago reducido, sin bono, y el derrame también sale del tanque', () => {
    const s = settleDelivery(
      { liters: 1000, money: 100 },
      { delivered: 300, spilled: 50, perfil: 'paciente', puntualidad: 'TARDE', clean: false },
      B,
    )
    expect(s.pago.total).toBe(150) // 300 × $1 × 0.5
    expect(s.bonus).toBe(0)
    expect(s.money).toBe(250)
    expect(s.liters).toBe(650)
  })

  it('el pedido cancelado no paga nada, ni con entrega limpia', () => {
    const s = settleDelivery(
      { liters: 1000, money: 100 },
      { delivered: 500, spilled: 0, perfil: 'exigente', puntualidad: 'MUY_TARDE', clean: true },
      B,
    )
    expect(s.pago.cancelled).toBe(true)
    expect(s.money).toBe(100)
    expect(s.bonus).toBe(0)
  })
})

describe('orderClock', () => {
  // Paciente en B: ventana 10 min, lateFactor 2 (muy tarde después de 20).
  const pedido: Pedido = {
    id: 'p1',
    clientId: 'local-1',
    colonia: 'centro',
    perfil: 'paciente',
    liters: 500,
    acceptedAt: 60,
    windowMinutes: 10,
  }
  B.pedidos.warnFraction = 0.25

  it('deriva transcurrido y restante del momento de aceptación', () => {
    expect(orderClock(pedido, 60, B)).toMatchObject({
      elapsedMinutes: 0,
      remainingMinutes: 10,
      puntualidad: 'A_TIEMPO',
      warning: false,
    })
    const c = orderClock(pedido, 60 + 300, B)
    expect(c.elapsedMinutes).toBe(5)
    expect(c.remainingMinutes).toBe(5)
  })

  it('avisa en el último tramo de la ventana, aún a tiempo', () => {
    // warnFraction 0.25 sobre 10 min → alerta con ≤2.5 min restantes.
    expect(orderClock(pedido, 60 + 7.4 * 60, B).warning).toBe(false)
    const c = orderClock(pedido, 60 + 8 * 60, B)
    expect(c.warning).toBe(true)
    expect(c.puntualidad).toBe('A_TIEMPO')
  })

  it('cruza a tarde y muy tarde con la tolerancia del perfil', () => {
    const tarde = orderClock(pedido, 60 + 11 * 60, B)
    expect(tarde.puntualidad).toBe('TARDE')
    expect(tarde.remainingMinutes).toBeCloseTo(-1, 10)
    // Tarde ya no es «alerta»: la alerta es para quien todavía puede llegar.
    expect(tarde.warning).toBe(false)
    expect(orderClock(pedido, 60 + 21 * 60, B).puntualidad).toBe('MUY_TARDE')
  })

  it('un reloj que marque antes de la aceptación cuenta como cero', () => {
    expect(orderClock(pedido, 0, B).elapsedMinutes).toBe(0)
  })

  it('cada pedido corre su propio reloj: el mismo instante, dos estados', () => {
    const nuevo: Pedido = { ...pedido, id: 'p2', acceptedAt: 60 + 10 * 60 }
    const t = 60 + 11 * 60
    expect(orderClock(pedido, t, B).puntualidad).toBe('TARDE')
    expect(orderClock(nuevo, t, B).puntualidad).toBe('A_TIEMPO')
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
    const estimado = estimateOffer(100, 'paciente', 1, B)
    const real = deliveryPayment(
      { liters: 100, perfil: 'paciente', puntualidad: 'A_TIEMPO' },
      B,
    )
    expect(estimado).toBe(real.total)
  })

  it('con el factor de reputación, promete lo que ese factor pagaría', () => {
    const estimado = estimateOffer(100, 'paciente', 1.5, B)
    const real = deliveryPayment(
      { liters: 100, perfil: 'paciente', puntualidad: 'A_TIEMPO', tipFactor: 1.5 },
      B,
    )
    expect(estimado).toBe(real.total)
    expect(estimado).toBe(115) // 100 base + 10 propina × 1.5
  })
})

describe('la reputación conecta con los pagos (Paso 6)', () => {
  it('el factor escala SOLO la propina, nunca el precio pactado', () => {
    const conRep = deliveryPayment(
      { liters: 100, perfil: 'paciente', puntualidad: 'A_TIEMPO', tipFactor: 1.5 },
      B,
    )
    expect(conRep.base).toBe(100)
    expect(conRep.tip).toBe(15)
    expect(conRep.total).toBe(115)
  })

  it('tarde no hay propina que escalar: el factor no revive lo perdido', () => {
    const pago = deliveryPayment(
      { liters: 100, perfil: 'paciente', puntualidad: 'TARDE', tipFactor: 2 },
      B,
    )
    expect(pago.total).toBe(50)
    expect(pago.tip).toBe(0)
  })

  it('settleDelivery pasa el factor hasta el cobro', () => {
    const s = settleDelivery(
      { liters: 1000, money: 0 },
      {
        delivered: 100,
        spilled: 0,
        perfil: 'paciente',
        puntualidad: 'A_TIEMPO',
        clean: false,
        tipFactor: 1.5,
      },
      B,
    )
    expect(s.money).toBe(115)
  })
})
