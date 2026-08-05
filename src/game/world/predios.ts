import { desaturar, FACHADAS_MURO } from '../paleta'

/*
 * EL CAMPO DE PREDIOS (Fase 3): la partición de las fachadas de la colonia
 * en predios de 6 a 10 m de frente, con UN color dominante por predio y la
 * variación puesta en la arquitectura (portón, ventanas, banda de cal,
 * cornisa, pretil de altura distinta).
 *
 * La clave anti «código de barras»: la partición NO es por caja de edificio
 * sino por CARRIL DE FACHADA — la recta del muro en coordenadas de mundo
 * (orientación + plano cuantizado). Las cajas angostas contiguas de un mismo
 * frente de manzana comparten plano, por lo tanto carril, por lo tanto
 * predios y colores: un predio puede abarcar varias cajas y se pinta igual
 * en todas. Cero rayas.
 *
 * Todo determinista por posición (mismo espíritu que dadoDeLote): mismo
 * mapa, mismos predios en cada recarga. Módulo puro: sin three, sin React.
 */

/** Paso nominal entre fronteras de predio. Con el jitter de ±1 m por
 *  frontera, todo frente queda garantizado en [6, 10] m. */
export const PREDIO_PASO = 8
const JITTER = 1

/** Mismo PRNG que layout.ts, con sal doble: hash por (carril, índice). */
function dado(a: number, b: number, sal: number): number {
  let seed = ((a * 73856093) ^ (b * 19349663) ^ (sal * 83492791)) | 0
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

export type Elemento =
  /** Portón: hueco grande desde el piso, con INSET real (fachadas.ts). */
  | { tipo: 'porton'; u0: number; ancho: number; alto: number }
  /** Ventana: rectángulo pintado EN el plano del muro (color por vértice). */
  | { tipo: 'ventana'; u0: number; ancho: number; v0: number; alto: number }

export type Predio = {
  /** Rango de mundo sobre el eje del carril. Frente = s1 − s0 ∈ [6, 10]. */
  s0: number
  s1: number
  /** UN color dominante para todo el predio (de FACHADAS_MURO). */
  colorMuro: string
  /** Guardapolvo: banda inferior, tono hundido del muro. */
  colorBanda: string
  bandaAlto: number
  cornisa: boolean
  /** Pretil sobre la azotea: la variación de silueta entre predios. */
  pretilAlto: number
  elementos: Elemento[]
}

/**
 * Identidad de un carril de fachada: eje de la NORMAL del muro, signo hacia
 * donde mira, y el plano cuantizado a la rejilla de 0.5 m. Dos cajas del
 * mismo frente producen la misma clave.
 */
export function claveCarril(eje: 'x' | 'z', signo: 1 | -1, plano: number): number {
  return ((eje === 'x' ? 1 : 2) * 4 + (signo > 0 ? 1 : 0)) * 1000003 +
    Math.round(plano * 2)
}

/** Frontera k del carril: k·PASO con jitter determinista de ±1 m. */
function frontera(carril: number, k: number): number {
  return k * PREDIO_PASO + (dado(carril, k, 7) * 2 - 1) * JITTER
}

const cache = new Map<string, Predio>()

function armarPredio(carril: number, k: number): Predio {
  const s0 = frontera(carril, k)
  const s1 = frontera(carril, k + 1)
  const frente = s1 - s0
  const colorMuro = FACHADAS_MURO[Math.floor(dado(carril, k, 11) * FACHADAS_MURO.length)]
  const colorBanda = desaturar(colorMuro, 0.8, -0.14)
  const bandaAlto = 0.6 + dado(carril, k, 13) * 0.4
  const cornisa = dado(carril, k, 17) < 0.7
  const pretilAlto = 0.3 + dado(carril, k, 19) * 0.5

  /*
   * La arquitectura del frente. Un portón (60 %) más una ventana, o puras
   * ventanas repartidas. Los elementos van en coordenadas de mundo sobre el
   * eje, con margen a las fronteras para no cortar un vano en la costura.
   */
  const elementos: Elemento[] = []
  const margen = 0.7
  const conPorton = dado(carril, k, 23) < 0.6
  if (conPorton) {
    const ancho = 2.4 + dado(carril, k, 29) * 0.6
    const alto = 2.3 + dado(carril, k, 31) * 0.3
    const libre = frente - 2 * margen - ancho
    const u0 = s0 + margen + dado(carril, k, 37) * Math.max(0, libre)
    elementos.push({ tipo: 'porton', u0, ancho, alto })
    // Una ventana en el resto del frente, si cabe con aire.
    const izq = u0 - s0 - margen
    const der = s1 - margen - (u0 + ancho)
    const lado = Math.max(izq, der)
    if (lado >= 2) {
      const vAncho = 1.2
      const vu0 =
        izq >= der
          ? s0 + margen + (izq - vAncho) / 2
          : u0 + ancho + (der - vAncho) / 2
      elementos.push({ tipo: 'ventana', u0: vu0, ancho: vAncho, v0: 0.95, alto: 1.35 })
    }
  } else {
    const vAncho = 1.2
    const n = frente >= 8.5 ? 3 : 2
    const hueco = (frente - 2 * margen - n * vAncho) / (n + 1)
    for (let i = 0; i < n; i++) {
      elementos.push({
        tipo: 'ventana',
        u0: s0 + margen + hueco + i * (vAncho + hueco),
        ancho: vAncho,
        v0: 0.95,
        alto: 1.35,
      })
    }
  }
  return { s0, s1, colorMuro, colorBanda, bandaAlto, cornisa, pretilAlto, elementos }
}

/** El predio del carril que contiene la coordenada s. Memoizado. */
export function predioEn(carril: number, s: number): Predio {
  let k = Math.floor(s / PREDIO_PASO)
  // El jitter mueve las fronteras hasta 1 m: corrige el índice si hace falta.
  while (s < frontera(carril, k)) k--
  while (s >= frontera(carril, k + 1)) k++
  const llave = `${carril}:${k}`
  let p = cache.get(llave)
  if (!p) {
    p = armarPredio(carril, k)
    cache.set(llave, p)
  }
  return p
}

/**
 * Parte el rango [u0, u1] de una cara en segmentos por predio. Cada segmento
 * trae su predio y el subrango que le toca — la cara puede empezar y acabar
 * a media parcela.
 */
export function segmentosDe(
  carril: number,
  u0: number,
  u1: number,
): { predio: Predio; a: number; b: number }[] {
  const out: { predio: Predio; a: number; b: number }[] = []
  let s = u0
  // Tope de seguridad: ningún frente legal mide menos de 6 m.
  for (let guard = 0; s < u1 - 1e-6 && guard < 64; guard++) {
    const predio = predioEn(carril, s)
    const b = Math.min(u1, predio.s1)
    out.push({ predio, a: s, b })
    s = b + 1e-6
  }
  return out
}
