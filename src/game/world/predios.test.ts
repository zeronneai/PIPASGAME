import { describe, expect, it } from 'vitest'
import { claveCarril, predioEn, PREDIO_PASO, segmentosDe } from './predios'
import { FACHADAS_MURO } from '../paleta'

/*
 * El campo de predios: la garantía anti «código de barras». Los tests cobran
 * las invariantes de las que depende fachadas.ts: frentes de 6 a 10 m,
 * determinismo por posición, y que dos puntos del mismo frente compartan
 * predio (y por lo tanto color) aunque vengan de cajas distintas.
 */

const CARRILES = [
  claveCarril('x', 1, 24.5),
  claveCarril('x', -1, -71),
  claveCarril('z', 1, 0),
  claveCarril('z', -1, 88.12),
]

describe('predioEn', () => {
  it('todo frente mide entre 6 y 10 metros', () => {
    for (const carril of CARRILES) {
      for (let s = -120; s < 120; s += 3.7) {
        const p = predioEn(carril, s)
        expect(p.s1 - p.s0).toBeGreaterThanOrEqual(PREDIO_PASO - 2)
        expect(p.s1 - p.s0).toBeLessThanOrEqual(PREDIO_PASO + 2)
        expect(s).toBeGreaterThanOrEqual(p.s0)
        expect(s).toBeLessThan(p.s1)
      }
    }
  })

  it('es determinista: entrar por cualquier punto da el mismo predio', () => {
    for (const carril of CARRILES) {
      const p = predioEn(carril, 37)
      expect(predioEn(carril, p.s0 + 0.01)).toBe(p)
      expect(predioEn(carril, p.s1 - 0.01)).toBe(p)
    }
  })

  it('anti-barcode: dos puntos a 0.5 m del mismo frente comparten color', () => {
    // Es la propiedad que rompe las franjas: cajas angostas contiguas del
    // mismo plano de muro caen en el mismo predio y pintan igual.
    for (const carril of CARRILES) {
      for (let s = -60; s < 60; s += 5) {
        const p = predioEn(carril, s)
        if (s + 0.5 < p.s1) expect(predioEn(carril, s + 0.5).colorMuro).toBe(p.colorMuro)
      }
    }
  })

  it('el color dominante sale de FACHADAS_MURO y los vanos caben en el frente', () => {
    for (const carril of CARRILES) {
      for (let s = -60; s < 60; s += 4) {
        const p = predioEn(carril, s)
        expect(FACHADAS_MURO).toContain(p.colorMuro)
        for (const e of p.elementos) {
          expect(e.u0).toBeGreaterThanOrEqual(p.s0)
          expect(e.u0 + e.ancho).toBeLessThanOrEqual(p.s1)
        }
        expect(p.pretilAlto).toBeGreaterThanOrEqual(0.3)
        expect(p.pretilAlto).toBeLessThanOrEqual(0.8)
      }
    }
  })
})

describe('segmentosDe', () => {
  it('cubre el rango completo sin huecos ni traslapes', () => {
    for (const carril of CARRILES) {
      const segs = segmentosDe(carril, -33.3, 41.7)
      expect(segs.length).toBeGreaterThan(0)
      expect(segs[0].a).toBeCloseTo(-33.3, 5)
      expect(segs[segs.length - 1].b).toBeCloseTo(41.7, 5)
      for (let i = 1; i < segs.length; i++) {
        expect(segs[i].a).toBeCloseTo(segs[i - 1].b, 3)
      }
    }
  })

  it('una cara angosta (una caja de 2 m) es UN solo segmento', () => {
    const segs = segmentosDe(CARRILES[0], 10, 12)
    expect(segs.length).toBe(1)
  })
})
