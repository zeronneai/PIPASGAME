import { describe, expect, it } from 'vitest'
import { balance, type Balance } from '../balance'
import { derrameVolcadura, estaVolcada, upY } from './volcaduraModel'

const B: Balance = structuredClone(balance)
B.rescate.volcadura.derrameMin = 0.1
B.rescate.volcadura.derrameMax = 0.35

// Cuaterniones de prueba: rotaciones de eje alineado, escritas a mano.
const derecha = { x: 0, y: 0, z: 0, w: 1 }
const girada90 = { x: 0, y: Math.SQRT1_2, z: 0, w: Math.SQRT1_2 } // solo yaw
const deCostado = { x: 0, y: 0, z: Math.SQRT1_2, w: Math.SQRT1_2 } // roll 90°
const deCabeza = { x: 1, y: 0, z: 0, w: 0 } // pitch 180°
const inclinada45 = { x: Math.sin(Math.PI / 8), y: 0, z: 0, w: Math.cos(Math.PI / 8) }

describe('upY / estaVolcada', () => {
  it('derecha y girando en yaw no está volcada', () => {
    expect(upY(derecha)).toBeCloseTo(1)
    expect(upY(girada90)).toBeCloseTo(1)
    expect(estaVolcada(derecha, 0.35)).toBe(false)
    expect(estaVolcada(girada90, 0.35)).toBe(false)
  })

  it('de costado y de cabeza sí', () => {
    expect(upY(deCostado)).toBeCloseTo(0)
    expect(upY(deCabeza)).toBeCloseTo(-1)
    expect(estaVolcada(deCostado, 0.35)).toBe(true)
    expect(estaVolcada(deCabeza, 0.35)).toBe(true)
  })

  it('una inclinación de 45° no dispara con el umbral de 0.35', () => {
    // 45° → up.y ≈ 0.707: derrapar de lado o subir un tope de ladito no es
    // volcadura.
    expect(upY(inclinada45)).toBeCloseTo(Math.SQRT1_2)
    expect(estaVolcada(inclinada45, 0.35)).toBe(false)
  })
})

describe('derrameVolcadura', () => {
  it('a golpe cero derrama el mínimo, a tope el máximo', () => {
    expect(derrameVolcadura(10_000, 0, 20, B)).toBeCloseTo(1_000)
    expect(derrameVolcadura(10_000, 20, 20, B)).toBeCloseTo(3_500)
  })

  it('interpola y nunca pasa del máximo aunque el golpe se pase del tope', () => {
    expect(derrameVolcadura(10_000, 10, 20, B)).toBeCloseTo(2_250)
    expect(derrameVolcadura(10_000, 999, 20, B)).toBeCloseTo(3_500)
  })

  it('es proporcional a lo que traías: tanque vacío no derrama nada', () => {
    expect(derrameVolcadura(0, 20, 20, B)).toBe(0)
    expect(derrameVolcadura(5_000, 10, 20, B)).toBeCloseTo(
      derrameVolcadura(10_000, 10, 20, B) / 2,
    )
  })
})
