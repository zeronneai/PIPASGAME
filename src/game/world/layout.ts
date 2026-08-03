/*
 * Geometría de la colonia, versión irregular. Solo datos: este módulo no
 * toca three ni React, así que los sistemas (pozo, locales, minimapa,
 * rescate) pueden importarlo sin arrastrar la escena.
 *
 * YA NO es una retícula: el trazo está hecho A MANO — un anillo perimetral,
 * una avenida diagonal, una plaza con kiosco que se rodea como glorieta,
 * calles que no llegan de lado a lado, y tres callejones angostos que son
 * atajos. La gracia es que conocer la colonia sea una ventaja: el callejón
 * que te ahorra media vuelta solo lo descubres manejando.
 *
 * Las alturas de los edificios sí salen de una semilla fija: la colonia es
 * idéntica en cada recarga, que es lo que hace comparables las pruebas.
 */

export const MAP_SIZE = 200 // metros por lado
export const SIDEWALK_HEIGHT = 0.15
export const ROAD_THICKNESS = 0.2
export const TOPE_HEIGHT = 0.12

/** Centro de la calle del anillo perimetral. Lo usa el rescate por caída:
 *  es el terreno firme garantizado más cercano a cualquier borde. */
export const ANILLO = 96

export type Box = {
  /** Centro del cuerpo, no la base. */
  pos: [number, number, number]
  size: [number, number, number]
  /** Giro sobre Y en radianes (la avenida diagonal). Ausente = alineado. */
  rotY?: number
}

export type Local = Box & {
  id: string
  name: string
  color: string
  /** Punto de la puerta, sobre la banqueta y frente a la calle. La
   *  detección se mide contra esto, no contra el centro del edificio. */
  door: [number, number, number]
}

/** PRNG determinista (mulberry32): misma semilla, misma colonia. */
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rnd = mulberry32(20260803)

// ---------------------------------------------------------------- calles

/*
 * Cada calle es UNA caja (visual + collider), no losetas: menos instancias
 * y menos colliders que la retícula vieja. El «suelo de rescate» de abajo
 * tapa cualquier rendija entre segmentos.
 *
 * Nombres del trazo (para leer los comentarios):
 *   A  vertical x=-40, completa            B  vertical x=24, muere en la plaza
 *   C  vertical x=60, solo mitad sur       D  horizontal z=-40, muere en B
 *   E  horizontal z=8, solo al este        F  horizontal z=56, muere en c2
 *   c1/c2/c3 callejones (4.5 m)            diag  avenida a 45° del NW a la plaza
 */
const seg = (
  cx: number,
  cz: number,
  sx: number,
  sz: number,
  rotY?: number,
): Box => ({
  pos: [cx, 0, cz], // la y se ajusta abajo con el escalón anti z-fighting
  size: [sx, ROAD_THICKNESS, sz],
  ...(rotY !== undefined && { rotY }),
})

export const roads: Box[] = [
  seg(0, -ANILLO, MAP_SIZE, 8), // anillo norte
  seg(0, ANILLO, MAP_SIZE, 8), // anillo sur
  seg(-ANILLO, 0, 8, MAP_SIZE), // anillo oeste
  seg(ANILLO, 0, 8, MAP_SIZE), // anillo este
  seg(-40, 0, 8, MAP_SIZE), // A: la única transversal completa
  seg(24, -55, 8, 90), // B: del norte a la plaza, no sigue
  seg(60, 54, 8, 92), // C: de E al sur, no existe al norte
  seg(-36, -40, 128, 8), // D: muere al topar con B
  seg(71, 8, 58, 8), // E: de la plaza al anillo este
  seg(-52, 56, 96, 8), // F: muere en el callejón c2
  seg(-68, -68, 4.5, 56), // c1: atajo NW, anillo norte ↔ D
  seg(-8, 76, 4.5, 48), // c2: atajo sur, F ↔ anillo sur
  seg(62, -68, 68, 4.5), // c3: atajo NE, B ↔ anillo este
  // La avenida diagonal: del corner NW (-95,-95) a la plaza (11,11).
  seg(-42, -42, 9, 150, Math.PI / 4),
  // La plaza: pavimento a nivel de calle; se maneja sobre ella.
  seg(24, 8, 36, 36),
]

// Escalón de 2 mm por segmento: los cruces comparten plano y sin esto
// z-pelean. Invisible al ojo e imperceptible a la rueda.
roads.forEach((r, i) => {
  r.pos[1] = -ROAD_THICKNESS / 2 - i * 0.002
})

/** El kiosco al centro de la plaza: se rodea, como glorieta. */
export const kiosco: Box = { pos: [24, 1.25, 8], size: [6, 2.5, 6] }

/**
 * Suelo de rescate: una losa bajo TODO el mapa, 3 cm debajo del nivel de
 * calle. Las rendijas entre segmentos y las orillas de las manzanas caen
 * aquí, no al vacío. El vacío de verdad empieza donde termina el mapa.
 */
export const groundSlab: Box = {
  pos: [0, -ROAD_THICKNESS / 2 - 0.03, 0],
  size: [MAP_SIZE, ROAD_THICKNESS, MAP_SIZE],
}

// ------------------------------------------------------------- manzanas

/*
 * Manzanas irregulares, definidas a mano entre las calles: de la esquinita
 * de 6×12 junto a la diagonal a la manzanota de 58×61 del sur. Cada una es
 * una plataforma de banqueta de 15 cm, como antes.
 */
const BLOCKS: { cx: number; cz: number; sx: number; sz: number }[] = [
  { cx: -55, cz: -81.5, sx: 20, sz: 19 }, // B1 NW, junto al callejón c1
  { cx: -49, cz: -66, sx: 8, sz: 12 }, // B3 escaloncito contra la diagonal
  { cx: -85, cz: -58, sx: 12, sz: 26 }, // B4 franja oeste de la diagonal
  { cx: -75, cz: -51, sx: 6, sz: 12 }, // B4b esquinita mínima
  { cx: -68, cz: 8, sx: 46, sz: 84 }, // B5 manzanota centro-oeste
  { cx: -68, cz: 76.5, sx: 46, sz: 29 }, // B10 suroeste
  { cx: -22.5, cz: 76.5, sx: 23, sz: 29 }, // B11 sur, entre A y c2
  { cx: 26, cz: 60.5, sx: 58, sz: 61 }, // B12 manzanota sur (c2 la libra)
  { cx: -8, cz: -68, sx: 52, sz: 46 }, // B6 norte-centro
  { cx: 61.5, cz: -81, sx: 59, sz: 20 }, // B7 NE, arriba del callejón c3
  { cx: 61.5, cz: -39.5, sx: 59, sz: 51 }, // B8 NE grande, bajo c3
  { cx: 68.5, cz: -3.5, sx: 45, sz: 13 }, // B9 franja entre plaza y anillo E
  { cx: 79.5, cz: 53.5, sx: 23, sz: 75 }, // B13 larga del sureste
  { cx: 9, cz: -25, sx: 18, sz: 22 }, // B14 entre la diagonal y la plaza
]

export const sidewalks: Box[] = BLOCKS.map((b) => ({
  // De -0.2 (fondo de la calle) a 0.15 (nivel de banqueta)
  pos: [b.cx, (SIDEWALK_HEIGHT - ROAD_THICKNESS) / 2, b.cz],
  size: [b.sx, SIDEWALK_HEIGHT + ROAD_THICKNESS, b.sz],
}))

// ----------------------------------------------- locales, casas y toma

/*
 * Los 6 locales fijos, colocados a mano: cada uno con la puerta a SU calle
 * (dos dan a callejones: quien los conoce, cobra más rápido). Los ids y
 * colores son los mismos de siempre; clients.ts no se entera del trazo.
 */
export const locales: Local[] = [
  {
    id: 'local-1', name: 'Local 1', color: '#d94f4f',
    pos: [2, SIDEWALK_HEIGHT + 2, 66], size: [9, 4, 9],
    door: [-3, SIDEWALK_HEIGHT, 66], // al callejón c2
  },
  {
    id: 'local-2', name: 'Local 2', color: '#e0a33a',
    pos: [0, SIDEWALK_HEIGHT + 2, -51], size: [9, 4, 9],
    door: [0, SIDEWALK_HEIGHT, -46.5], // a la calle D
  },
  {
    id: 'local-3', name: 'Local 3', color: '#3ec98a',
    pos: [37, SIDEWALK_HEIGHT + 2, -40], size: [9, 4, 9],
    door: [32.5, SIDEWALK_HEIGHT, -40], // a la calle B
  },
  {
    id: 'local-4', name: 'Local 4', color: '#4d8fe0',
    pos: [73, SIDEWALK_HEIGHT + 2, 40], size: [9, 4, 9],
    door: [68.5, SIDEWALK_HEIGHT, 40], // a la calle C
  },
  {
    id: 'local-5', name: 'Local 5', color: '#b06fd6',
    pos: [-50, SIDEWALK_HEIGHT + 2, 20], size: [9, 4, 9],
    door: [-45.5, SIDEWALK_HEIGHT, 20], // a la calle A
  },
  {
    id: 'local-6', name: 'Local 6', color: '#e07a3a',
    pos: [60, SIDEWALK_HEIGHT + 2, -76], size: [9, 4, 9],
    door: [60, SIDEWALK_HEIGHT, -71.5], // al callejón c3
  },
]

/**
 * Domicilio de entrega de cada cliente fijo (cambio de diseño de Fase 1):
 * el pedido se consigue tocando la puerta del NEGOCIO, pero el agua se
 * entrega en la casa u obra, siempre lejos y siempre a alcance de una
 * calle. Eso es lo que vuelve a darle sentido a planear la ruta.
 */
export const DOMICILIOS: Record<string, [number, number, number]> = {
  'local-1': [-63, SIDEWALK_HEIGHT, -80], // casa junto al callejón c1
  'local-2': [86, SIDEWALK_HEIGHT, 70], // casa junto al anillo este
  'local-3': [-85, SIDEWALK_HEIGHT, 75], // casa junto al anillo oeste
  'local-4': [-10, SIDEWALK_HEIGHT, -85], // la obra, junto al anillo norte
  'local-5': [85, SIDEWALK_HEIGHT, -30], // planta junto al anillo este
  'local-6': [50, SIDEWALK_HEIGHT, 34], // casa junto a la calle C
}

/** Lugares donde pueden aparecer clientes efímeros (casas y obras que van
 *  y vienen). Todos sobre manzana y a alcance de una calle. */
export const EPHEMERAL_SPOTS: {
  id: string
  tipo: 'casa' | 'obra'
  pos: [number, number, number]
}[] = [
  { id: 'spot-1', tipo: 'casa', pos: [-86, SIDEWALK_HEIGHT, -20] },
  { id: 'spot-2', tipo: 'obra', pos: [-30, SIDEWALK_HEIGHT, -50] },
  { id: 'spot-3', tipo: 'casa', pos: [16, SIDEWALK_HEIGHT, -30] },
  { id: 'spot-4', tipo: 'casa', pos: [-52, SIDEWALK_HEIGHT, 66] },
  { id: 'spot-5', tipo: 'obra', pos: [34, SIDEWALK_HEIGHT, 88] },
  { id: 'spot-6', tipo: 'casa', pos: [72, SIDEWALK_HEIGHT, 18] },
  { id: 'spot-7', tipo: 'obra', pos: [44, SIDEWALK_HEIGHT, -74] },
  { id: 'spot-8', tipo: 'casa', pos: [88, SIDEWALK_HEIGHT, 52] },
  { id: 'spot-9', tipo: 'casa', pos: [0, SIDEWALK_HEIGHT, 34] },
  { id: 'spot-10', tipo: 'obra', pos: [-50, SIDEWALK_HEIGHT, -86] },
]

/** Dónde se llena la pipa: en la orilla de la manzana sur, frente a C y a
 *  una cuadra de la plaza. */
export const WATER_SOURCE = {
  id: 'toma-de-agua',
  name: 'Toma de agua',
  pos: [50, SIDEWALK_HEIGHT, 32] as [number, number, number],
  radius: 5,
}

export const waterParts = {
  base: {
    pos: [50, SIDEWALK_HEIGHT + 0.15, 32],
    size: [4, 0.3, 4],
  } as Box,
  pipe: {
    pos: [50, SIDEWALK_HEIGHT + 0.3 + 1.1, 32] as [number, number, number],
    radius: 0.35,
    height: 2.2,
  },
  valve: {
    pos: [50, SIDEWALK_HEIGHT + 0.3 + 2.2 + 0.2, 32],
    size: [1.2, 0.4, 0.5],
  } as Box,
}

// ------------------------------------------------------------- edificios

/*
 * Relleno por manzana: lotes de ~13 m con huecos aleatorios (semilla fija)
 * y alturas variables. Se respeta un claro alrededor de locales, toma,
 * domicilios y spots efímeros — ahí no se construye encima.
 */
const RESERVADOS: [number, number][] = [
  ...locales.map((l) => [l.pos[0], l.pos[2]] as [number, number]),
  [WATER_SOURCE.pos[0], WATER_SOURCE.pos[2]],
  ...Object.values(DOMICILIOS).map((d) => [d[0], d[2]] as [number, number]),
  ...EPHEMERAL_SPOTS.map((s) => [s.pos[0], s.pos[2]] as [number, number]),
]

const CLARO = 7 // radio libre alrededor de un punto reservado

export const buildings: Box[] = []
for (const b of BLOCKS) {
  const margen = 2
  const anchoUtil = b.sx - margen * 2
  const largoUtil = b.sz - margen * 2
  const nx = Math.max(1, Math.floor(anchoUtil / 13))
  const nz = Math.max(1, Math.floor(largoUtil / 13))
  const loteX = anchoUtil / nx
  const loteZ = largoUtil / nz
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      const cx = b.cx - anchoUtil / 2 + loteX * (i + 0.5)
      const cz = b.cz - largoUtil / 2 + loteZ * (j + 0.5)
      // Consumir el random SIEMPRE: quitar un reservado no debe barajar
      // las alturas del resto de la colonia.
      const hueco = rnd() < 0.16
      const altura = 4 + rnd() * 16
      if (hueco) continue
      if (RESERVADOS.some(([rx, rz]) => Math.hypot(rx - cx, rz - cz) < CLARO))
        continue
      const fx = Math.max(4, loteX - 2)
      const fz = Math.max(4, loteZ - 2)
      buildings.push({
        pos: [cx, SIDEWALK_HEIGHT + altura / 2, cz],
        size: [fx, altura, fz],
      })
    }
  }
}

// ------------------------------------------------------------------ topes

/** A mano, a media cuadra de calles largas; nunca en cruces ni callejones. */
export const topes: Box[] = [
  { pos: [-40, TOPE_HEIGHT / 2, -20], size: [8, TOPE_HEIGHT, 0.7] }, // A
  { pos: [-40, TOPE_HEIGHT / 2, 40], size: [8, TOPE_HEIGHT, 0.7] }, // A
  { pos: [0, TOPE_HEIGHT / 2, -40], size: [0.7, TOPE_HEIGHT, 8] }, // D
  { pos: [-60, TOPE_HEIGHT / 2, 56], size: [0.7, TOPE_HEIGHT, 8] }, // F
  { pos: [60, TOPE_HEIGHT / 2, 70], size: [8, TOPE_HEIGHT, 0.7] }, // C
  { pos: [24, TOPE_HEIGHT / 2, -80], size: [8, TOPE_HEIGHT, 0.7] }, // B
]

/** Resumen para verificar el presupuesto a ojo. */
export const layoutStats = {
  roads: roads.length,
  sidewalks: sidewalks.length,
  buildings: buildings.length,
  locales: locales.length,
  topes: topes.length,
}
