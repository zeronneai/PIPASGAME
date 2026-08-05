import { AZOTEA, desaturar, PALETA } from '../paleta'
import { BARDA_ALTURA, buildings, esLibre } from './layout'
import { claveCarril, predioEn, segmentosDe, type Predio } from './predios'

/*
 * LA MALLA DE LA COLONIA (Fase 3): toda la edificación genérica fusionada en
 * UNA geometría con colores por vértice — un draw call para 1000+ cajas.
 *
 * Reglas de la fase, cobradas en fachadas.test.ts:
 *  - CERO planos encimados: ventanas y banda de cal son color por vértice EN
 *    el plano del muro; lo único que sale del plano es geometría real con
 *    profundidad honesta (portón hundido INSET_PORTON, cornisa con vuelo,
 *    pretil con grosor). Nada queda a menos de SEPARACION_MIN de otra
 *    superficie paralela visible: el z-fighting muere por construcción.
 *  - UN color dominante por predio de 6–10 m (predios.ts): las cajas
 *    angostas contiguas comparten predio y color — cero código de barras.
 *    Donde dos cajas traslapadas emiten caras coplanares, el campo de
 *    predios les da EL MISMO color por posición: pintan idéntico y no
 *    pueden vibrar.
 *  - Caras no expuestas a calle: un quad plano (la geometría oculta del
 *    traslape de lotes no se emite con detalle).
 *
 * Módulo puro: sin three ni React. Los colores salen ya en espacio LINEAL
 * (la misma conversión sRGB→lineal que hace three con setColorAt), listos
 * para el atributo `color`.
 */

export const INSET_PORTON = 0.15
export const VUELO_CORNISA = 0.1
export const GRUESO_PRETIL = 0.15
/** Ninguna superficie paralela visible queda a menos de esto de otra. */
export const SEPARACION_MIN = 0.06

const COLOR_PORTON = desaturar(PALETA.terracota, 0.5, -0.12)
const COLOR_VENTANA = desaturar(PALETA.anil, 0.4, 0.06)
const COLOR_BARDA = desaturar(PALETA.bloque)

export type MallaDatos = {
  position: Float32Array
  normal: Float32Array
  color: Float32Array
  triangulos: number
}

/* ---- color: hex sRGB → lineal, con caché ---- */

const linealCache = new Map<string, [number, number, number]>()

function aLineal(hex: string): [number, number, number] {
  let c = linealCache.get(hex)
  if (!c) {
    const f = (i: number) => {
      const v = parseInt(hex.slice(i, i + 2), 16) / 255
      return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
    }
    c = [f(1), f(3), f(5)]
    linealCache.set(hex, c)
  }
  return c
}

/* ---- acumulador de triángulos ---- */

type Acc = { pos: number[]; nor: number[]; col: number[] }

function tri(
  acc: Acc,
  a: [number, number, number],
  b: [number, number, number],
  c: [number, number, number],
  n: [number, number, number],
  rgb: [number, number, number],
) {
  acc.pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2])
  for (let i = 0; i < 3; i++) acc.nor.push(n[0], n[1], n[2])
  for (let i = 0; i < 3; i++) acc.col.push(rgb[0], rgb[1], rgb[2])
}

/**
 * Quad VERTICAL con normal sobre `eje`·`signo`, en el plano `plano`.
 * u corre sobre el eje perpendicular (z si la normal es x, x si es z);
 * v es la altura. El winding sale CCW visto desde fuera.
 */
function quadV(
  acc: Acc,
  eje: 'x' | 'z',
  signo: 1 | -1,
  plano: number,
  u0: number,
  u1: number,
  v0: number,
  v1: number,
  rgb: [number, number, number],
) {
  if (u1 - u0 < 1e-4 || v1 - v0 < 1e-4) return
  const P = (u: number, v: number): [number, number, number] =>
    eje === 'x' ? [plano, v, u] : [u, v, plano]
  const a = P(u0, v0)
  const b = P(u1, v0)
  const c = P(u1, v1)
  const d = P(u0, v1)
  const n: [number, number, number] = eje === 'x' ? [signo, 0, 0] : [0, 0, signo]
  // Derivado del producto cruz: en 'x' el orden (a,b,c) da −x; en 'z' da +z.
  const directo = eje === 'z' ? signo > 0 : signo < 0
  if (directo) {
    tri(acc, a, b, c, n, rgb)
    tri(acc, a, c, d, n, rgb)
  } else {
    tri(acc, a, c, b, n, rgb)
    tri(acc, a, d, c, n, rgb)
  }
}

/** Quad HORIZONTAL en y, con normal hacia arriba o abajo. */
function quadY(
  acc: Acc,
  y: number,
  x0: number,
  x1: number,
  z0: number,
  z1: number,
  arriba: boolean,
  rgb: [number, number, number],
) {
  if (x1 - x0 < 1e-4 || z1 - z0 < 1e-4) return
  const a: [number, number, number] = [x0, y, z0]
  const b: [number, number, number] = [x1, y, z0]
  const c: [number, number, number] = [x1, y, z1]
  const d: [number, number, number] = [x0, y, z1]
  const n: [number, number, number] = [0, arriba ? 1 : -1, 0]
  // (a,b,c) da −y: el orden directo es para abajo.
  if (arriba) {
    tri(acc, a, c, b, n, rgb)
    tri(acc, a, d, c, n, rgb)
  } else {
    tri(acc, a, b, c, n, rgb)
    tri(acc, a, c, d, n, rgb)
  }
}

/* ---- la fachada de un segmento de predio ---- */

type RectVano = {
  u0: number
  u1: number
  v0: number
  v1: number
  tipo: 'porton' | 'ventana'
}

/** Los vanos del predio que caen COMPLETOS dentro del segmento [a, b]. */
function vanosDe(
  predio: Predio,
  a: number,
  b: number,
  base: number,
  top: number,
): RectVano[] {
  const out: RectVano[] = []
  if (b - a < 3) return out // segmento chico: solo muro y banda
  const margen = 0.05
  const dosPlantas = top - base >= 4.6
  for (const e of predio.elementos) {
    if (e.u0 < a + margen || e.u0 + e.ancho > b - margen) continue
    if (e.tipo === 'porton') {
      if (base + e.alto > top - 0.2) continue
      out.push({ u0: e.u0, u1: e.u0 + e.ancho, v0: base, v1: base + e.alto, tipo: 'porton' })
      if (dosPlantas) {
        const c = e.u0 + e.ancho / 2
        out.push({ u0: c - 0.6, u1: c + 0.6, v0: base + 3.05, v1: base + 4.25, tipo: 'ventana' })
      }
    } else {
      if (base + e.v0 + e.alto > top - 0.3) continue
      out.push({
        u0: e.u0,
        u1: e.u0 + e.ancho,
        v0: base + e.v0,
        v1: base + e.v0 + e.alto,
        tipo: 'ventana',
      })
      if (dosPlantas)
        out.push({ u0: e.u0, u1: e.u0 + e.ancho, v0: base + 3.05, v1: base + 4.25, tipo: 'ventana' })
    }
  }
  return out
}

function cortes(vals: number[]): number[] {
  const s = [...vals].sort((p, q) => p - q)
  const out: number[] = []
  for (const v of s) if (out.length === 0 || v - out[out.length - 1] > 1e-4) out.push(v)
  return out
}

/** Emite la fachada decorada de un segmento de predio sobre una cara. */
function fachadaSegmento(
  acc: Acc,
  eje: 'x' | 'z',
  signo: 1 | -1,
  plano: number,
  a: number,
  b: number,
  base: number,
  top: number,
  predio: Predio,
) {
  const vanos = vanosDe(predio, a, b, base, top)
  const muro = aLineal(predio.colorMuro)
  const banda = aLineal(predio.colorBanda)
  const bandaTope = base + predio.bandaAlto

  const xs = cortes([a, b, ...vanos.flatMap((v) => [v.u0, v.u1])])
  const ys = cortes([base, top, bandaTope, ...vanos.flatMap((v) => [v.v0, v.v1])])

  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < ys.length - 1; j++) {
      const um = (xs[i] + xs[i + 1]) / 2
      const vm = (ys[j] + ys[j + 1]) / 2
      const vano = vanos.find((r) => um > r.u0 && um < r.u1 && vm > r.v0 && vm < r.v1)
      if (vano?.tipo === 'porton') continue // hueco: el inset va aparte
      const rgb = vano
        ? aLineal(COLOR_VENTANA)
        : vm < bandaTope
          ? banda
          : muro
      quadV(acc, eje, signo, plano, xs[i], xs[i + 1], ys[j], ys[j + 1], rgb)
    }
  }

  /* Portón: hundido de verdad — fondo + jambas + dintel. Geometría hacia
   * ADENTRO del muro, nunca encimada. */
  const ejeU: 'x' | 'z' = eje === 'x' ? 'z' : 'x'
  const dentro = plano - signo * INSET_PORTON
  const dMin = Math.min(plano, dentro)
  const dMax = Math.max(plano, dentro)
  const sombra = aLineal(predio.colorBanda)
  for (const v of vanos) {
    if (v.tipo !== 'porton') continue
    quadV(acc, eje, signo, dentro, v.u0, v.u1, v.v0, v.v1, aLineal(COLOR_PORTON))
    quadV(acc, ejeU, 1, v.u0, dMin, dMax, v.v0, v.v1, sombra)
    quadV(acc, ejeU, -1, v.u1, dMin, dMax, v.v0, v.v1, sombra)
    // Dintel: mira hacia abajo, del plano del muro al fondo del inset.
    if (eje === 'x') quadY(acc, v.v1, dMin, dMax, v.u0, v.u1, false, sombra)
    else quadY(acc, v.v1, v.u0, v.u1, dMin, dMax, false, sombra)
  }

  /* Cornisa: saliente real bajo la línea de azotea. */
  if (predio.cornisa && top - base > 2.6) {
    const v0 = top - 0.2
    const v1 = top - 0.06
    const fuera = plano + signo * VUELO_CORNISA
    const fMin = Math.min(plano, fuera)
    const fMax = Math.max(plano, fuera)
    const rgb = aLineal(predio.colorMuro)
    quadV(acc, eje, signo, fuera, a, b, v0, v1, rgb)
    if (eje === 'x') {
      quadY(acc, v1, fMin, fMax, a, b, true, rgb)
      quadY(acc, v0, fMin, fMax, a, b, false, sombra)
      quadV(acc, ejeU, -1, a, fMin, fMax, v0, v1, rgb)
      quadV(acc, ejeU, 1, b, fMin, fMax, v0, v1, rgb)
    } else {
      quadY(acc, v1, a, b, fMin, fMax, true, rgb)
      quadY(acc, v0, a, b, fMin, fMax, false, sombra)
      quadV(acc, ejeU, -1, a, fMin, fMax, v0, v1, rgb)
      quadV(acc, ejeU, 1, b, fMin, fMax, v0, v1, rgb)
    }
  }

  /* Pretil: el muro sigue sobre la azotea, con grosor y tapa. Su altura
   * cambia por predio: la silueta de la manzana deja de ser una línea. */
  const p = predio.pretilAlto
  const interior = plano - signo * GRUESO_PRETIL
  const iMin = Math.min(plano, interior)
  const iMax = Math.max(plano, interior)
  const rgbP = aLineal(predio.colorMuro)
  quadV(acc, eje, signo, plano, a, b, top, top + p, rgbP)
  quadV(acc, eje, (signo * -1) as 1 | -1, interior, a, b, top, top + p, rgbP)
  if (eje === 'x') {
    quadY(acc, top + p, iMin, iMax, a, b, true, rgbP)
    quadV(acc, ejeU, -1, a, iMin, iMax, top, top + p, rgbP)
    quadV(acc, ejeU, 1, b, iMin, iMax, top, top + p, rgbP)
  } else {
    quadY(acc, top + p, a, b, iMin, iMax, true, rgbP)
    quadV(acc, ejeU, -1, a, iMin, iMax, top, top + p, rgbP)
    quadV(acc, ejeU, 1, b, iMin, iMax, top, top + p, rgbP)
  }
}

/* ---- la malla completa ---- */

type Cara = {
  eje: 'x' | 'z'
  signo: 1 | -1
  plano: number
  u0: number
  u1: number
}

function carasDe(b: (typeof buildings)[number]): Cara[] {
  const [cx, , cz] = b.pos
  const [sx, , sz] = b.size
  return [
    { eje: 'x', signo: 1, plano: cx + sx / 2, u0: cz - sz / 2, u1: cz + sz / 2 },
    { eje: 'x', signo: -1, plano: cx - sx / 2, u0: cz - sz / 2, u1: cz + sz / 2 },
    { eje: 'z', signo: 1, plano: cz + sz / 2, u0: cx - sx / 2, u1: cx + sx / 2 },
    { eje: 'z', signo: -1, plano: cz - sz / 2, u0: cx - sx / 2, u1: cx + sx / 2 },
  ]
}

/** ¿La cara da a calle o banqueta? Se muestrea 1 m afuera del plano. */
function expuesta(c: Cara): boolean {
  for (const t of [0.2, 0.5, 0.8]) {
    const u = c.u0 + (c.u1 - c.u0) * t
    const fuera = c.plano + c.signo * 1.0
    const libre = c.eje === 'x' ? esLibre(fuera, u) : esLibre(u, fuera)
    if (libre) return true
  }
  return false
}

export function construirMallaColonia(): MallaDatos {
  const acc: Acc = { pos: [], nor: [], col: [] }
  const azotea = aLineal(AZOTEA)
  const barda = aLineal(COLOR_BARDA)

  for (const b of buildings) {
    const [cx, cy, cz] = b.pos
    const [sx, sy, sz] = b.size
    const base = cy - sy / 2
    const top = cy + sy / 2
    const esBarda = sy <= BARDA_ALTURA + 0.01

    // Tapa. Las bardas en su tono de bloque; los edificios en gris cemento.
    quadY(acc, top, cx - sx / 2, cx + sx / 2, cz - sz / 2, cz + sz / 2, true, esBarda ? barda : azotea)
    // La cara inferior no se emite: invisible y coplanar con la losa.

    for (const cara of carasDe(b)) {
      if (esBarda || !expuesta(cara)) {
        // Muro plano. Las bardas no llevan arquitectura; las caras contra
        // otro lote tampoco (la mayor parte ni se ve).
        const rgb = esBarda
          ? barda
          : aLineal(
              predioEn(
                claveCarril(cara.eje, cara.signo, cara.plano),
                (cara.u0 + cara.u1) / 2,
              ).colorMuro,
            )
        quadV(acc, cara.eje, cara.signo, cara.plano, cara.u0, cara.u1, base, top, rgb)
        continue
      }
      const carril = claveCarril(cara.eje, cara.signo, cara.plano)
      for (const seg of segmentosDe(carril, cara.u0, cara.u1)) {
        fachadaSegmento(
          acc,
          cara.eje,
          cara.signo,
          cara.plano,
          seg.a,
          seg.b,
          base,
          top,
          seg.predio,
        )
      }
    }
  }

  return {
    position: new Float32Array(acc.pos),
    normal: new Float32Array(acc.nor),
    color: new Float32Array(acc.col),
    triangulos: acc.pos.length / 9,
  }
}
