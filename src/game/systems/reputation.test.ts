import { describe, expect, it } from 'vitest'
import { balance, type Balance } from '../balance'
import {
  applyRep,
  deliveryRepDelta,
  eventRepDelta,
  isRadioUnlocked,
  isSegundaUnlocked,
  newReputation,
  tipRepFactor,
} from './reputation'

/* Mismo esquema que economy.test.ts: aritmética exacta contra un balance
 * fijo, invariantes contra el real. */

const B: Balance = structuredClone(balance)
B.reputacion = {
  start: 50,
  min: 0,
  max: 100,
  radioUnlock: 70,
  segundaUnlock: 60,
  tipFactorMin: 0.5,
  tipFactorMax: 1.5,
  minijuegoLimpio: 1,
  derrame: -2,
  cancelacion: -8,
}
B.perfiles.paciente.rep = { onTime: 2, late: 0, veryLate: -3 }
B.perfiles.exigente.rep = { onTime: 5, late: -4, veryLate: -8 }

describe('newReputation', () => {
  it('arranca en el valor inicial del balance', () => {
    expect(newReputation(B)).toBe(50)
  })
})

describe('applyRep', () => {
  it('suma y resta', () => {
    expect(applyRep(50, 3, B)).toBe(53)
    expect(applyRep(50, -8, B)).toBe(42)
  })

  it('nunca sale del rango [min, max]', () => {
    expect(applyRep(99, 5, B)).toBe(100)
    expect(applyRep(3, -10, B)).toBe(0)
  })

  it('una racha larga se queda en el tope, no se pasa', () => {
    let rep = newReputation(B)
    for (let i = 0; i < 100; i++) rep = applyRep(rep, 5, B)
    expect(rep).toBe(100)
  })
})

describe('deliveryRepDelta', () => {
  it('lee el delta del perfil según puntualidad', () => {
    expect(deliveryRepDelta('A_TIEMPO', 'paciente', B)).toBe(2)
    expect(deliveryRepDelta('TARDE', 'paciente', B)).toBe(0)
    expect(deliveryRepDelta('MUY_TARDE', 'exigente', B)).toBe(-8)
  })

  it('invariantes con el balance real, para cada perfil', () => {
    for (const perfil of ['paciente', 'normal', 'exigente'] as const) {
      // A tiempo siempre sube; tarde jamás sube; muy tarde siempre baja.
      expect(deliveryRepDelta('A_TIEMPO', perfil)).toBeGreaterThan(0)
      expect(deliveryRepDelta('TARDE', perfil)).toBeLessThanOrEqual(0)
      expect(deliveryRepDelta('MUY_TARDE', perfil)).toBeLessThan(0)
    }
  })

  it('invariante: surtir al exigente sube más que surtir al paciente (sección 2.7)', () => {
    expect(deliveryRepDelta('A_TIEMPO', 'exigente')).toBeGreaterThan(
      deliveryRepDelta('A_TIEMPO', 'paciente'),
    )
  })

  it('invariante: fallarle al exigente castiga más que fallarle al paciente', () => {
    expect(deliveryRepDelta('MUY_TARDE', 'exigente')).toBeLessThan(
      deliveryRepDelta('MUY_TARDE', 'paciente'),
    )
  })

  it('invariante: el paciente perdona la tardanza (tabla de la sección 2.3)', () => {
    expect(deliveryRepDelta('TARDE', 'paciente')).toBe(0)
  })
})

describe('eventRepDelta', () => {
  it('devuelve el delta de cada evento', () => {
    expect(eventRepDelta('MINIJUEGO_LIMPIO', B)).toBe(1)
    expect(eventRepDelta('DERRAME', B)).toBe(-2)
    expect(eventRepDelta('CANCELACION', B)).toBe(-8)
  })

  it('invariantes con el balance real: limpio premia, derrame y cancelación castigan', () => {
    expect(eventRepDelta('MINIJUEGO_LIMPIO')).toBeGreaterThan(0)
    expect(eventRepDelta('DERRAME')).toBeLessThan(0)
    expect(eventRepDelta('CANCELACION')).toBeLessThan(eventRepDelta('DERRAME'))
  })
})

describe('tipRepFactor', () => {
  it('interpola de tipFactorMin a tipFactorMax con la reputación', () => {
    expect(tipRepFactor(0, B)).toBe(0.5)
    expect(tipRepFactor(50, B)).toBe(1)
    expect(tipRepFactor(100, B)).toBe(1.5)
  })

  it('la reputación fuera de rango no rompe el factor', () => {
    expect(tipRepFactor(-10, B)).toBe(0.5)
    expect(tipRepFactor(500, B)).toBe(1.5)
  })

  it('invariantes con el balance real: más reputación nunca da menos propina', () => {
    expect(balance.reputacion.tipFactorMin).toBeLessThanOrEqual(1)
    expect(balance.reputacion.tipFactorMax).toBeGreaterThanOrEqual(1)
    let anterior = 0
    for (let rep = 0; rep <= 100; rep += 10) {
      const f = tipRepFactor(rep)
      expect(f).toBeGreaterThanOrEqual(anterior)
      anterior = f
    }
  })
})

describe('isRadioUnlocked', () => {
  it('se abre exactamente en el umbral', () => {
    expect(isRadioUnlocked(69.9, B)).toBe(false)
    expect(isRadioUnlocked(70, B)).toBe(true)
    expect(isRadioUnlocked(100, B)).toBe(true)
  })

  it('invariante con el balance real: no se arranca con el radio ya abierto', () => {
    expect(isRadioUnlocked(newReputation())).toBe(false)
  })
})

describe('isSegundaUnlocked', () => {
  it('se gana exactamente en el umbral', () => {
    expect(isSegundaUnlocked(59.9, B)).toBe(false)
    expect(isSegundaUnlocked(60, B)).toBe(true)
    expect(isSegundaUnlocked(100, B)).toBe(true)
  })

  it('invariantes con el balance real: no naces con ella, y es el PRIMER hito', () => {
    // «Quítala del inicio» (Paso 6): el arranque queda por debajo.
    expect(isSegundaUnlocked(newReputation())).toBe(false)
    // El orden de la progresión: primero la segunda, después el radio.
    expect(balance.reputacion.segundaUnlock).toBeLessThan(
      balance.reputacion.radioUnlock,
    )
    expect(balance.reputacion.segundaUnlock).toBeGreaterThan(
      balance.reputacion.start,
    )
  })
})
