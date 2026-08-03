import { describe, expect, it } from 'vitest'
import { balance, type Balance } from '../balance'
import { generarEfimero, intervaloSpawn } from './ephemeral'

const B: Balance = structuredClone(balance)
B.efimeros = { maxActivos: 3, spawnMin: 20, spawnMax: 40, vidaMin: 2, vidaMax: 4 }

const SPOT_CASA = { id: 'spot-1', tipo: 'casa' as const, pos: [10, 0.15, 20] as [number, number, number] }
const SPOT_OBRA = { id: 'spot-2', tipo: 'obra' as const, pos: [-30, 0.15, 5] as [number, number, number] }

describe('generarEfimero', () => {
  it('una casa nunca es exigente; una obra nunca es paciente', () => {
    for (const r of [0, 0.3, 0.54, 0.56, 0.99]) {
      expect(['paciente', 'normal']).toContain(generarEfimero(SPOT_CASA, 1, 0, B, () => r).perfil)
      expect(['exigente', 'normal']).toContain(generarEfimero(SPOT_OBRA, 1, 0, B, () => r).perfil)
    }
  })

  it('vive dentro del rango de vida del balance, contado desde ahora', () => {
    const corto = generarEfimero(SPOT_CASA, 1, 100, B, () => 0)
    const largo = generarEfimero(SPOT_CASA, 2, 100, B, () => 0.999)
    expect(corto.hastaSeconds).toBeCloseTo(100 + 2 * 60, 0)
    expect(largo.hastaSeconds).toBeLessThanOrEqual(100 + 4 * 60)
    expect(largo.hastaSeconds).toBeGreaterThan(corto.hastaSeconds)
  })

  it('es un Cliente completo: el sistema de aceptación lo puede evaluar', () => {
    const e = generarEfimero(SPOT_OBRA, 7, 0, B, () => 0.5)
    expect(e.id).toBe('efimero-7')
    expect(e.colonia).toBe('centro')
    expect(e.name.length).toBeGreaterThan(0)
    expect(e.horario.abre).toBeLessThan(e.horario.cierra)
    expect(e.pos).toEqual(SPOT_OBRA.pos)
  })
})

describe('intervaloSpawn', () => {
  it('cae en el rango del balance', () => {
    expect(intervaloSpawn(B, () => 0)).toBe(20)
    expect(intervaloSpawn(B, () => 1)).toBe(40)
  })
})
