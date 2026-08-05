/*
 * LA PALETA (Fase 3, sección 1): estilizado con toque de rótulo mexicano.
 * Saturada y cálida — cal, ocre, terracota, azul añil, verde limón, rosa
 * mexicano. El asfalto y el cielo son lo ÚNICO desaturado, para que todo lo
 * demás resalte. Los rótulos (locales, letreros) son los acentos de máximo
 * contraste.
 *
 * Fuente única del juego: la leen los materiales de three, el canvas 2D y
 * (reflejada como variables) theme.css. Con `flat` en la Canvas estos hex
 * son LITERALES en pantalla — no hay tone mapping que los lave.
 *
 * La paleta de PINTURA del jugador (estilo.ts COLORES) y los grises de
 * fábrica de la pipa (PIPA_MATERIALS) son aparte a propósito: son catálogo
 * de juego con tests encima, no dirección de arte.
 */

export const PALETA = {
  // ---- los seis de la dirección visual
  cal: '#f2e7d3',
  ocre: '#d9a441',
  terracota: '#c96f4a',
  anil: '#3f5fa8',
  verdeLimon: '#a3c04a',
  rosa: '#d94f8e',

  // ---- desaturados de servicio (lo único apagado)
  asfalto: '#5e5b55',
  banqueta: '#a59d8d',
  /** Bloque gris de obra, tinaco, lo no encalado. */
  bloque: '#b9ac96',

  // ---- cielo y aire (mediodía de calor seco: azul franco, horizonte claro)
  cieloCenit: '#3d7fd0',
  cieloHorizonte: '#e8e0c8',
  /** La niebla casa con el horizonte: el fondo se funde sin costura. */
  niebla: '#e0ddcd',

  // ---- luz (sol alto y casi neutro; el calor lo pone la paleta, no la luz)
  sol: '#fffbf2',
  /** Rebote del suelo para el hemisferio: tierra cálida, no negro. */
  rebote: '#9a8468',

  // ---- metales pintados (sin PBR: plata y latón planos, como de rótulo)
  plata: '#e9eef4',
  laton: '#e3c65b',
}

/**
 * Las fachadas de la colonia, PONDERADAS: una colonia real es mayormente cal
 * y tonos claros, con casas de acento repartidas. El muestreo determinista
 * (por posición del lote) usa esta lista tal cual — repetir un color es
 * subirle el peso.
 */
export const FACHADAS: string[] = [
  PALETA.cal,
  PALETA.cal,
  PALETA.cal,
  '#e8d9b8', // cal vieja
  '#dfc9a0', // arena
  PALETA.ocre,
  PALETA.terracota,
  '#7d94c4', // añil claro (el añil puro es de acentos chicos)
  PALETA.verdeLimon,
  '#e08bb0', // rosa a media cal
  PALETA.bloque,
]

/** Hash determinista de una posición a un índice: mismo mapa, mismos
 *  colores en cada recarga (mismo espíritu que dadoDeLote en layout.ts). */
export function fachadaDe(x: number, z: number): string {
  const h = Math.abs((Math.round(x * 2) * 73856093) ^ (Math.round(z * 2) * 19349663))
  return FACHADAS[h % FACHADAS.length]
}

/* ---- Jerarquía por saturación (Fase 3) ----
 * Lo GENÉRICO va desaturado y un pelo más oscuro; los locales, hitos y
 * clientes activos conservan la saturación completa. Lo interactivo resalta
 * por contraste, sin marcadores. */

/** Baja saturación y ajusta luminosidad en HSL. factorS multiplica la
 *  saturación; deltaL SUMA a la luminosidad (en 0..1). Determinista. */
export function desaturar(hex: string, factorS = 0.5, deltaL = -0.04): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  const l = (max + min) / 2
  const d = max - min
  let s = 0
  if (d > 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
    else if (max === g) h = ((b - r) / d + 2) / 6
    else h = ((r - g) / d + 4) / 6
  }
  const s2 = Math.min(1, Math.max(0, s * factorS))
  const l2 = Math.min(1, Math.max(0, l + deltaL))
  const hue = (p: number, q: number, t: number) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  let r2 = l2
  let g2 = l2
  let b2 = l2
  if (s2 > 0) {
    const q = l2 < 0.5 ? l2 * (1 + s2) : l2 + s2 - l2 * s2
    const p = 2 * l2 - q
    r2 = hue(p, q, h + 1 / 3)
    g2 = hue(p, q, h)
    b2 = hue(p, q, h - 1 / 3)
  }
  const cc = (n: number) =>
    Math.round(n * 255)
      .toString(16)
      .padStart(2, '0')
  return `#${cc(r2)}${cc(g2)}${cc(b2)}`
}

/** Las FACHADAS de fondo, ya desaturadas: los muros de la colonia genérica. */
export const FACHADAS_MURO: string[] = FACHADAS.map((c) => desaturar(c))

/** Azoteas: gris cemento propio — los techos dejan de ser del color del muro. */
export const AZOTEA: string = desaturar(PALETA.bloque, 0.4, -0.08)
