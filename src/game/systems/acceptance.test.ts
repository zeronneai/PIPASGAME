import { describe, expect, it } from 'vitest'
import { balance, type Balance } from '../balance'
import {
  acceptanceChance,
  aguaFactor,
  cooldownRestante,
  dentroDeHorario,
  evaluarOferta,
  formatHora,
  generarOferta,
  historialFactor,
  horaDelDia,
  motivoDominante,
} from './acceptance'
import { newClientHistory, type Cliente } from './clients'

/*
 * Mismas dos capas que economy.test.ts: aritmética exacta contra un balance
 * fijo (B) con números redondos, e invariantes contra el balance real que
 * deben sobrevivir cualquier rebalanceo en leva.
 */

const B: Balance = structuredClone(balance)
// Jornada de 10 minutos entre las 8 y las 18: 1 minuto real = 1 hora de juego.
B.jornada.minutosReales = 10
B.jornada.startHour = 8
B.jornada.endHour = 18
B.reputacion.max = 100
B.aceptacion = {
  repChanceMin: 0.1,
  repChanceMax: 0.9,
  offHoursFactor: 0.25,
  historyMin: 0.2,
  historyMax: 1.4,
  servedTodayFactor: 0.05,
  servedYesterdayFactor: 0.5,
  cooldownMinutes: 2,
  chanceMin: 0.02,
  chanceMax: 0.95,
  litersStep: 100,
}
B.perfiles.paciente.litros = { min: 500, max: 1500 }
B.perfiles.paciente.windowMinutes = 10

const CLIENTE: Cliente = {
  id: 'local-1',
  name: 'Doña Chela',
  perfil: 'paciente',
  colonia: 'centro',
  horario: { abre: 9, cierra: 17 },
}

describe('horaDelDia', () => {
  it('reparte los minutos reales entre la hora de inicio y la de fin', () => {
    expect(horaDelDia(0, B)).toBe(8)
    expect(horaDelDia(300, B)).toBe(13) // media jornada
    expect(horaDelDia(600, B)).toBe(18)
  })

  it('pasada la jornada se queda en la hora de cierre', () => {
    expect(horaDelDia(99999, B)).toBe(18)
    expect(horaDelDia(-5, B)).toBe(8)
  })
})

describe('formatHora', () => {
  it('formatea con am/pm y el mediodía como 12', () => {
    expect(formatHora(8)).toBe('8:00 am')
    expect(formatHora(13.5)).toBe('1:30 pm')
    expect(formatHora(12)).toBe('12:00 pm')
    expect(formatHora(12.25)).toBe('12:15 pm')
  })
})

describe('dentroDeHorario', () => {
  it('abre inclusivo, cierra exclusivo', () => {
    expect(dentroDeHorario(9, CLIENTE.horario)).toBe(true)
    expect(dentroDeHorario(16.99, CLIENTE.horario)).toBe(true)
    expect(dentroDeHorario(17, CLIENTE.horario)).toBe(false)
    expect(dentroDeHorario(8.5, CLIENTE.horario)).toBe(false)
  })
})

describe('historialFactor', () => {
  it('sin trato previo es neutro', () => {
    expect(historialFactor(newClientHistory(), B)).toBe(1)
  })

  it('todo a tiempo da el máximo; todo cancelado, el mínimo', () => {
    const bueno = { ...newClientHistory(), entregas: 4, aTiempo: 4 }
    expect(historialFactor(bueno, B)).toBe(1.4)
    const malo = { ...newClientHistory(), cancelados: 3 }
    expect(historialFactor(malo, B)).toBe(0.2)
  })

  it('tarde cuenta media entrega buena', () => {
    // score = (0 + 0.5·2) / 2 = 0.5 → 0.2 + 1.2·0.5 = 0.8
    const h = { ...newClientHistory(), entregas: 2, tarde: 2 }
    expect(historialFactor(h, B)).toBeCloseTo(0.8, 10)
  })
})

describe('aguaFactor', () => {
  it('surtido hoy casi lo apaga; ayer lo reduce; antes es neutro', () => {
    const h = newClientHistory()
    expect(aguaFactor({ ...h, lastServedDay: 5 }, 5, B)).toBe(0.05)
    expect(aguaFactor({ ...h, lastServedDay: 4 }, 5, B)).toBe(0.5)
    expect(aguaFactor({ ...h, lastServedDay: 3 }, 5, B)).toBe(1)
    expect(aguaFactor(h, 5, B)).toBe(1)
  })
})

describe('cooldownRestante', () => {
  const declinado = (day: number, seconds: number) => ({
    ...newClientHistory(),
    lastDeclinedDay: day,
    lastDeclinedSeconds: seconds,
  })

  it('cuenta los minutos que faltan dentro del mismo día', () => {
    expect(cooldownRestante(declinado(3, 100), 3, 100, B)).toBe(2)
    expect(cooldownRestante(declinado(3, 100), 3, 160, B)).toBe(1)
    expect(cooldownRestante(declinado(3, 100), 3, 220, B)).toBe(0)
  })

  it('al día siguiente ya no aplica', () => {
    expect(cooldownRestante(declinado(3, 100), 4, 0, B)).toBe(0)
  })

  it('sin momento válido se perdona (guardado viejo o reloj reiniciado)', () => {
    const viejo = { ...newClientHistory(), lastDeclinedDay: 3 }
    expect(cooldownRestante(viejo, 3, 500, B)).toBe(0)
    // El reloj se reinició al recargar: el rechazo quedó «en el futuro».
    expect(cooldownRestante(declinado(3, 400), 3, 50, B)).toBe(0)
  })
})

describe('acceptanceChance', () => {
  const base = {
    cliente: CLIENTE,
    history: newClientHistory(),
    day: 1,
    hora: 12,
  }

  it('la reputación fija la base: interpola entre mínimo y máximo', () => {
    expect(acceptanceChance({ ...base, rep: 0 }, B).p).toBeCloseTo(0.1, 10)
    expect(acceptanceChance({ ...base, rep: 100 }, B).p).toBeCloseTo(0.9, 10)
    expect(acceptanceChance({ ...base, rep: 50 }, B).p).toBeCloseTo(0.5, 10)
  })

  it('fuera de horario multiplica por el castigo', () => {
    const { p, factores } = acceptanceChance({ ...base, rep: 50, hora: 18 }, B)
    expect(factores.hora).toBe(0.25)
    expect(p).toBeCloseTo(0.125, 10)
  })

  it('los factores se componen multiplicando', () => {
    const history = { ...newClientHistory(), lastServedDay: 1 }
    const { p } = acceptanceChance({ ...base, rep: 50, history }, B)
    // 0.5 · 0.05 = 0.025, ya por encima del piso de 0.02
    expect(p).toBeCloseTo(0.025, 10)
  })

  it('nunca sale del rango [chanceMin, chanceMax]', () => {
    const history = { ...newClientHistory(), cancelados: 10, lastServedDay: 1 }
    const peor = acceptanceChance({ ...base, rep: 0, hora: 18, history }, B)
    expect(peor.p).toBe(0.02)
    const bueno = { ...newClientHistory(), entregas: 10, aTiempo: 10 }
    const mejor = acceptanceChance({ ...base, rep: 100, history: bueno }, B)
    expect(mejor.p).toBe(0.95)
  })
})

describe('motivoDominante', () => {
  const neutro = { rep: 0.6, hora: 1, historial: 1, agua: 1 }

  it('gana el multiplicador que más castigó', () => {
    expect(motivoDominante({ ...neutro, hora: 0.25, agua: 0.5 }, B)).toBe('FUERA_DE_HORARIO')
    expect(motivoDominante({ ...neutro, agua: 0.05, historial: 0.3 }, B)).toBe('YA_SURTIDO')
    expect(motivoDominante({ ...neutro, historial: 0.2 }, B)).toBe('HISTORIAL')
  })

  it('sin castigos, base baja es reputación y base alta es suerte', () => {
    expect(motivoDominante({ ...neutro, rep: 0.2 }, B)).toBe('REPUTACION')
    expect(motivoDominante({ ...neutro, rep: 0.8 }, B)).toBe('SUERTE')
  })
})

describe('generarOferta', () => {
  it('pide litros del rango del perfil, en pasos redondos', () => {
    const min = generarOferta(CLIENTE, B, () => 0)
    expect(min.litros).toBe(500)
    const max = generarOferta(CLIENTE, B, () => 0.999999)
    expect(max.litros).toBe(1500)
    const medio = generarOferta(CLIENTE, B, () => 0.5)
    expect(medio.litros % 100).toBe(0)
    expect(medio.litros).toBeGreaterThanOrEqual(500)
    expect(medio.litros).toBeLessThanOrEqual(1500)
  })

  it('copia la ventana del perfil y estima el mejor caso', () => {
    const o = generarOferta(CLIENTE, B, () => 0)
    expect(o.windowMinutes).toBe(10)
    // 500 L × precio paciente × (1 + propina)
    const p = B.perfiles.paciente
    expect(o.estimate).toBeCloseTo(500 * p.sellPricePerLiter * (1 + p.tipPct), 2)
  })
})

describe('evaluarOferta', () => {
  const args = {
    cliente: CLIENTE,
    rep: 50,
    history: newClientHistory(),
    day: 1,
    daySeconds: 240, // mediodía: dentro del horario
    tienePedidoActivo: false,
  }

  it('con pedido activo ni tira el dado', () => {
    const r = evaluarOferta({ ...args, tienePedidoActivo: true }, B, () => 0)
    expect(r.kind).toBe('NO_DISPONIBLE')
    expect(r.kind === 'NO_DISPONIBLE' && r.motivo).toBe('YA_PIDIO')
  })

  it('en enfriamiento tampoco, y dice cuánto falta', () => {
    const history = {
      ...newClientHistory(),
      lastDeclinedDay: 1,
      lastDeclinedSeconds: 200,
    }
    const r = evaluarOferta({ ...args, history }, B, () => 0)
    expect(r.kind === 'NO_DISPONIBLE' && r.motivo).toBe('ENFRIAMIENTO')
    expect(r.kind === 'NO_DISPONIBLE' && r.cooldownMin).toBeCloseTo(4 / 3, 10)
  })

  it('el dado decide: por debajo de p acepta, por encima rechaza', () => {
    // rep 50 a mediodía → p = 0.5. Primer rng() es el dado, el segundo los litros.
    const acepta = evaluarOferta(args, B, seq(0.49, 0.5))
    expect(acepta.kind).toBe('OFERTA')
    if (acepta.kind === 'OFERTA') {
      expect(acepta.p).toBeCloseTo(0.5, 10)
      expect(acepta.oferta.litros).toBeGreaterThanOrEqual(500)
    }
    const rechaza = evaluarOferta(args, B, seq(0.51))
    expect(rechaza.kind).toBe('RECHAZO')
    if (rechaza.kind === 'RECHAZO') expect(rechaza.motivo).toBe('SUERTE')
  })

  it('el rechazo trae el motivo del factor que más castigó', () => {
    const history = { ...newClientHistory(), lastServedDay: 1 }
    const r = evaluarOferta({ ...args, history }, B, seq(0.99))
    expect(r.kind === 'RECHAZO' && r.motivo).toBe('YA_SURTIDO')
  })

  it('la oferta promete más propina con mejor reputación (Paso 6)', () => {
    // Mismo dado y mismos litros; solo cambia la reputación.
    const alta = evaluarOferta({ ...args, rep: 100 }, B, seq(0, 0.5))
    const baja = evaluarOferta({ ...args, rep: 0 }, B, seq(0, 0.5))
    if (alta.kind !== 'OFERTA' || baja.kind !== 'OFERTA')
      throw new Error('ambas debían aceptar con dado 0')
    expect(alta.oferta.litros).toBe(baja.oferta.litros)
    expect(alta.oferta.estimate).toBeGreaterThan(baja.oferta.estimate)
  })
})

/** rng de secuencia fija para los tests. */
function seq(...valores: number[]) {
  let i = 0
  return () => valores[Math.min(i++, valores.length - 1)]
}

describe('invariantes con el balance real', () => {
  it('más reputación nunca baja la probabilidad', () => {
    const base = {
      cliente: CLIENTE,
      history: newClientHistory(),
      day: 1,
      hora: 12,
    }
    let anterior = 0
    for (let rep = 0; rep <= 100; rep += 10) {
      const { p } = acceptanceChance({ ...base, rep })
      expect(p).toBeGreaterThanOrEqual(anterior)
      anterior = p
    }
  })

  it('surtirle hoy siempre pega más fuerte que haberle surtido ayer', () => {
    expect(balance.aceptacion.servedTodayFactor).toBeLessThan(
      balance.aceptacion.servedYesterdayFactor,
    )
  })

  it('la jornada real corre de la mañana a la tarde', () => {
    expect(balance.jornada.startHour).toBeLessThan(balance.jornada.endHour)
    expect(horaDelDia(0)).toBe(balance.jornada.startHour)
  })
})
