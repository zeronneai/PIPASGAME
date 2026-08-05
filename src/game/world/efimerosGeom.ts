import { PALETA } from '../render/paleta'
import { Malla, dado, tinte, type P3 } from './malla'

/*
 * CÓMO SE VE UN LUGAR QUE NECESITA AGUA (Parte B del Paso 2).
 *
 * Los clientes eventuales tenían el mismo problema que los locales pero al
 * revés: eran una cajita de color sobre un solar, indistinguible de un predio
 * cualquiera, y el jugador solo se enteraba de que ahí había trabajo porque
 * el HUD se lo decía.
 *
 * La regla de este paso es que el mundo lo diga solo. Y para «aquí hace falta
 * agua» el lenguaje ya existe en la calle de verdad y no hay que inventarlo:
 *
 *   - LA CASA saca el tinaco a la vista, sobre su burro, y junta cubetas y
 *     tambos en el patio. Nadie tiene tambos afuera si le sobra el agua.
 *   - LA OBRA pone cimbra, varilla parada y tambos para la mezcla. Una obra
 *     sin agua se para, y por eso paga lo que paga.
 *
 * Estas señas son del CLIENTE, no del lugar: se construyen cuando aparece y
 * se van con él. Cuando el efímero se va, el solar vuelve a estar liso, que
 * es lo que hace que la seña signifique algo.
 *
 * Cada efímero sale en UNA malla fusionada (con su volumen y sus señas), así
 * que los tres que puede haber a la vez cuestan tres draw calls y no veinte.
 */

/** Tambos de doscientos litros: azul de siempre, y alguno ocre. */
const TAMBOS = [PALETA.anil, '#2f5d8a', PALETA.ocre, PALETA.terracota]

/** Cubetas: las de pintura reusadas, que es lo que se usa. */
const CUBETAS = [PALETA.cal, PALETA.limon, '#c8c2b4', PALETA.ocre]

function tambo(m: Malla, x: number, z: number, i: number, y = 0) {
  const h = 0.85
  const color = TAMBOS[i % TAMBOS.length]
  m.cilindro([x, y + h / 2, z], 0.29, h, 8, color, tinte(color, 1.3))
  // El aro del cuerpo: dice «tambo» y no «cilindro» de un vistazo.
  m.cilindro([x, y + h * 0.62, z], 0.305, 0.07, 8, tinte(color, 0.7))
}

function cubeta(m: Malla, x: number, z: number, i: number) {
  const h = 0.32
  const color = CUBETAS[i % CUBETAS.length]
  // Ligeramente cónica: el radio de arriba es mayor.
  m.cilindro([x, h / 2, z], 0.16, h, 6, color, tinte(color, 1.2))
}

/**
 * El tinaco sobre su burro, a la vista desde la calle. Es LA seña: un tinaco
 * al alcance de la manguera es el motivo por el que existe una pipa.
 */
function tinacoALaVista(m: Malla, x: number, z: number, i: number) {
  const patas = 1.35
  const r = 0.62
  // Las cuatro patas del burro.
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    m.caja([x + sx * r * 0.62, patas / 2, z + sz * r * 0.62], [0.1, patas, 0.1], PALETA.metal)
  }
  m.caja([x, patas + 0.06, z], [r * 2.1, 0.12, r * 2.1], tinte(PALETA.metal, 1.1))
  const color = dado(i, 31) < 0.75 ? '#2b2b30' : PALETA.terracota
  m.cilindro([x, patas + 0.12 + 0.55, z], r, 1.1, 8, color, tinte(color, 1.3))
  // La tapa, más clara y más chica: el tinaco de verdad la trae encima.
  m.cilindro([x, patas + 0.12 + 1.14, z], r * 0.42, 0.12, 6, tinte(color, 1.6))
}

/** Cimbra: tablones parados y su travesaño. Lo que se ve en toda obra. */
function cimbra(m: Malla, x: number, z: number, ancho: number, i: number) {
  const madera = tinte(PALETA.ocre, 0.72)
  const n = 5
  for (let k = 0; k < n; k++) {
    const t = -ancho / 2 + (ancho / (n - 1)) * k
    const alto = 1.5 + dado(i, 40 + k) * 0.5
    m.caja([x + t, alto / 2, z], [0.12, alto, 0.28], k % 2 ? madera : tinte(madera, 1.15))
  }
  m.caja([x, 1.35, z], [ancho, 0.14, 0.16], tinte(madera, 0.85))
}

/** Varilla parada, amarrada en manojo. Oxidada, que es como se ve siempre. */
function varilla(m: Malla, x: number, z: number, i: number) {
  const oxido = '#8a5a3c'
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2
    const rr = 0.11
    const alto = 1.9 + dado(i, 50 + k) * 0.8
    m.caja(
      [x + Math.cos(a) * rr, alto / 2, z + Math.sin(a) * rr],
      [0.04, alto, 0.04],
      k % 2 ? oxido : tinte(oxido, 1.2),
    )
  }
}

/**
 * El volumen del cliente eventual más sus señas, en una sola malla.
 *
 * `semilla` viene del id del efímero: dos casas que aparecen en spots
 * distintos no acomodan igual sus tambos.
 */
export function construirEfimero(tipo: 'casa' | 'obra', semilla: number) {
  const m = new Malla()

  if (tipo === 'casa') {
    const s = 3.5
    const alto = 2.8
    const muro = tinte(PALETA.cal, 0.9 + dado(semilla, 1) * 0.18)
    // Zócalo, muro y remate, el mismo lenguaje que el resto de la colonia:
    // tiene que leerse como una casa de aquí, no como un objeto de juego.
    m.caja([0, 0.35, 0], [s, 0.7, s], tinte(PALETA.concreto, 0.85), false)
    m.caja([0, 0.7 + (alto - 0.9) / 2, 0], [s, alto - 0.9, s], muro, false)
    m.caja([0, alto - 0.1, 0], [s + 0.16, 0.2, s + 0.16], tinte(muro, 1.15))

    tinacoALaVista(m, s * 0.22, -s * 0.22, semilla)

    // Tambos y cubetas arrimados a la fachada, no repartidos en el solar.
    const n = 2 + Math.floor(dado(semilla, 2) * 2)
    for (let k = 0; k < n; k++) {
      tambo(m, -s * 0.3 + k * 0.72, s * 0.5 + 0.45, semilla + k)
    }
    for (let k = 0; k < 3; k++) {
      cubeta(m, s * 0.5 + 0.4, -s * 0.35 + k * 0.42, semilla + k)
    }
  } else {
    const s = 4.5
    // La plancha de la obra, con su colado a medias.
    m.caja([0, 0.4, 0], [s, 0.8, s], tinte(PALETA.concreto, 0.95), false)
    m.caja([0, 0.85, 0], [s * 0.9, 0.1, s * 0.9], tinte(PALETA.concreto, 1.1))

    cimbra(m, 0, -s * 0.36, s * 0.8, semilla)
    varilla(m, -s * 0.3, s * 0.28, semilla)
    varilla(m, s * 0.05, s * 0.34, semilla + 7)

    // Los tambos de la mezcla: en una obra son el agua misma.
    for (let k = 0; k < 3; k++) {
      tambo(m, s * 0.32, s * 0.1 - k * 0.7, semilla + k, 0.8)
    }
    cubeta(m, -s * 0.42, -s * 0.05, semilla)
  }

  return m.geometria()
}

/** Medidas del volumen que sí choca. Las señas (tambos, varilla) se quedan
 *  fuera del collider a propósito: son estorbo visual, no muro. */
export const EFIMERO_CAJA: Record<'casa' | 'obra', { size: P3; y: number }> = {
  casa: { size: [3.5, 2.8, 3.5], y: 1.4 },
  obra: { size: [4.5, 1.6, 4.5], y: 0.8 },
}
