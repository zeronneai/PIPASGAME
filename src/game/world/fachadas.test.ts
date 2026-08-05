import { describe, expect, it } from 'vitest'
import {
  construirMallaColonia,
  GRUESO_PRETIL,
  INSET_PORTON,
  SEPARACION_MIN,
  VUELO_CORNISA,
} from './fachadas'
import { MAP_SIZE } from './traza'

/*
 * La malla fusionada de la colonia: presupuesto y sanidad geométrica. El
 * detalle visual se revisa a ojo; aquí se cobra lo que no debe regresar
 * jamás: presupuesto reventado, NaN, normales chuecas o geometría fuera del
 * mapa.
 */

const malla = construirMallaColonia()

describe('construirMallaColonia', () => {
  it('respeta el presupuesto de triángulos (doc: 120k en total)', () => {
    expect(malla.triangulos).toBeGreaterThan(10_000)
    expect(malla.triangulos).toBeLessThan(75_000)
  })

  it('sin NaN y con los tres atributos parejos', () => {
    expect(malla.position.length).toBe(malla.triangulos * 9)
    expect(malla.normal.length).toBe(malla.position.length)
    expect(malla.color.length).toBe(malla.position.length)
    for (const arr of [malla.position, malla.normal, malla.color]) {
      for (let i = 0; i < arr.length; i += 997) expect(Number.isNaN(arr[i])).toBe(false)
    }
  })

  it('normales unitarias y alineadas a ejes (todo es ortogonal)', () => {
    for (let i = 0; i < malla.normal.length; i += 3 * 499) {
      const x = malla.normal[i]
      const y = malla.normal[i + 1]
      const z = malla.normal[i + 2]
      expect(Math.hypot(x, y, z)).toBeCloseTo(1, 5)
      expect(Math.abs(x) + Math.abs(y) + Math.abs(z)).toBeCloseTo(1, 5)
    }
  })

  it('vértices dentro del mapa y por debajo de las alturas legales', () => {
    const medio = MAP_SIZE / 2 + 1
    for (let i = 0; i < malla.position.length; i += 3 * 251) {
      expect(Math.abs(malla.position[i])).toBeLessThanOrEqual(medio)
      expect(Math.abs(malla.position[i + 2])).toBeLessThanOrEqual(medio)
      // Altura máxima de lote (2.8 + 3.8) más el pretil más alto (0.8).
      expect(malla.position[i + 1]).toBeGreaterThanOrEqual(-0.01)
      expect(malla.position[i + 1]).toBeLessThanOrEqual(2.8 + 3.8 + 0.8 + 0.01)
    }
  })

  it('colores en rango [0, 1] (espacio lineal)', () => {
    for (let i = 0; i < malla.color.length; i += 727) {
      expect(malla.color[i]).toBeGreaterThanOrEqual(0)
      expect(malla.color[i]).toBeLessThanOrEqual(1)
    }
  })

  it('regla anti z-fighting: toda profundidad honesta ≥ separación mínima', () => {
    // No hay planos encimados por construcción; lo que sale o entra del muro
    // lo hace con profundidad real, lejos de la precisión del depth buffer.
    expect(INSET_PORTON).toBeGreaterThanOrEqual(0.1)
    expect(VUELO_CORNISA).toBeGreaterThanOrEqual(SEPARACION_MIN)
    expect(GRUESO_PRETIL).toBeGreaterThanOrEqual(SEPARACION_MIN)
    expect(SEPARACION_MIN).toBeGreaterThanOrEqual(0.05)
  })

  it('es determinista: dos construcciones son idénticas', () => {
    const otra = construirMallaColonia()
    expect(otra.triangulos).toBe(malla.triangulos)
    for (let i = 0; i < malla.position.length; i += 1009) {
      expect(otra.position[i]).toBe(malla.position[i])
      expect(otra.color[i]).toBe(malla.color[i])
    }
  })
})
