import { describe, expect, it } from 'vitest'
import { balance, type Balance } from '../balance'
import { generarOferta } from './acceptance'
import { newClientHistory, type Cliente } from './clients'
import {
  elegiblesParaRadio,
  generarLlamada,
  intervaloLlamada,
  prioridadTrasAceptar,
  prioridadTrasRechazo,
} from './radio'

/* Mismas dos capas de siempre: aritmética exacta contra B, invariantes
 * contra el balance real. */

const B: Balance = structuredClone(balance)
B.radio = {
  payFactor: 1.25,
  intervaloMin: 20,
  intervaloMax: 40,
  primeraLlamada: 5,
  timeoutLlamada: 10,
  prioridadMin: 0.25,
  bajaPorRechazo: 0.15,
  recuperaPorAceptar: 0.3,
}

const cliente = (id: string, extra: Partial<Cliente> = {}): Cliente => ({
  id,
  name: id,
  perfil: 'normal',
  colonia: 'centro',
  horario: { abre: 8, cierra: 18 },
  ...extra,
})

describe('elegiblesParaRadio', () => {
  const base = {
    clientes: [cliente('a'), cliente('b'), cliente('c')],
    orders: [],
    history: {},
    day: 3,
    hora: 12,
  }

  it('con todos libres, todos llaman', () => {
    expect(elegiblesParaRadio(base).map((c) => c.id)).toEqual(['a', 'b', 'c'])
  })

  it('con pedido activo contigo no te llama: ya te tiene', () => {
    const orders = [{ clientId: 'b' }] as never
    expect(elegiblesParaRadio({ ...base, orders }).map((c) => c.id)).toEqual(['a', 'c'])
  })

  it('surtido hoy no llama; surtido ayer sí', () => {
    const history = {
      a: { ...newClientHistory(), lastServedDay: 3 },
      b: { ...newClientHistory(), lastServedDay: 2 },
    }
    expect(elegiblesParaRadio({ ...base, history }).map((c) => c.id)).toEqual(['b', 'c'])
  })

  it('con el negocio cerrado no llama', () => {
    const clientes = [cliente('a', { horario: { abre: 7, cierra: 10 } }), cliente('b')]
    expect(
      elegiblesParaRadio({ ...base, clientes, hora: 16 }).map((c) => c.id),
    ).toEqual(['b'])
  })
})

describe('intervaloLlamada', () => {
  it('con prioridad 1, el intervalo cae en [min, max]', () => {
    expect(intervaloLlamada(1, B, () => 0)).toBe(20)
    expect(intervaloLlamada(1, B, () => 1)).toBe(40)
    expect(intervaloLlamada(1, B, () => 0.5)).toBe(30)
  })

  it('la prioridad divide: a la mitad de prioridad, el doble de espera', () => {
    expect(intervaloLlamada(0.5, B, () => 0)).toBe(40)
  })

  it('el piso de prioridad acota la espera máxima', () => {
    // Por debajo del piso se trata como el piso: nunca te borran de la lista.
    expect(intervaloLlamada(0.05, B, () => 0)).toBe(80)
    expect(intervaloLlamada(0.25, B, () => 0)).toBe(80)
  })
})

describe('prioridad', () => {
  it('rechazar baja de a poco y tiene piso', () => {
    expect(prioridadTrasRechazo(1, B)).toBe(0.85)
    expect(prioridadTrasRechazo(0.3, B)).toBe(0.25)
    expect(prioridadTrasRechazo(0.25, B)).toBe(0.25)
  })

  it('aceptar recupera más rápido de lo que rechazar baja, con techo en 1', () => {
    expect(prioridadTrasAceptar(0.5, B)).toBe(0.8)
    expect(prioridadTrasAceptar(0.9, B)).toBe(1)
    expect(B.radio.recuperaPorAceptar).toBeGreaterThan(B.radio.bajaPorRechazo)
  })
})

describe('generarLlamada', () => {
  const c = cliente('local-2')

  it('litros y ventana del perfil, y expira al timeout', () => {
    const llamada = generarLlamada(c, { tipFactor: 1, ahora: 100 }, B, () => 0.5)
    const p = B.perfiles.normal
    expect(llamada.litros).toBeGreaterThanOrEqual(p.litros.min)
    expect(llamada.litros).toBeLessThanOrEqual(p.litros.max)
    expect(llamada.windowMinutes).toBe(p.windowMinutes)
    expect(llamada.expiresAt).toBe(110)
  })

  it('paga la oferta a pie por el factor del radio', () => {
    const llamada = generarLlamada(c, { tipFactor: 1.2, ahora: 0 }, B, () => 0.5)
    const aPie = generarOferta(c, B, () => 0.5, 1.2)
    expect(llamada.litros).toBe(aPie.litros)
    expect(llamada.estimate).toBeCloseTo(aPie.estimate * 1.25, 2)
  })
})

describe('invariantes con el balance real', () => {
  it('el radio paga mejor que a pie (sección 2.8)', () => {
    expect(balance.radio.payFactor).toBeGreaterThan(1)
  })

  it('la primera llamada llega antes que cualquier intervalo normal: es la recompensa', () => {
    expect(balance.radio.primeraLlamada).toBeLessThan(balance.radio.intervaloMin)
  })

  it('perder toda la prioridad espacia las llamadas pero nunca las corta', () => {
    expect(balance.radio.prioridadMin).toBeGreaterThan(0)
  })
})
