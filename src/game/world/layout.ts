/*
 * Geometría de la colonia (Paso 5). Solo datos: este módulo no toca three ni
 * React, así que el Paso 8 (dónde está la toma de agua) y el Paso 9 (dónde
 * están los locales) pueden importarlo sin arrastrar la escena.
 *
 * Todo sale de una semilla fija: la colonia es idéntica en cada recarga, que
 * es lo que hace comparables las pruebas en el teléfono.
 */

export const MAP_SIZE = 200 // metros por lado
export const STREET_WIDTH = 8
export const BLOCK_SIZE = 40
export const SIDEWALK_HEIGHT = 0.15
export const ROAD_TILE = 8 // lado de la loseta de calle
export const ROAD_THICKNESS = 0.2
export const POTHOLE_DEPTH = 0.08
export const TOPE_HEIGHT = 0.12

// 4 manzanas de 40 m + 5 calles de 8 m = 200 m exactos, de -100 a 100.
export const STREET_CENTERS = [-96, -48, 0, 48, 96]
export const BLOCK_CENTERS = [-72, -24, 24, 72]

export type Box = {
  /** Centro del cuerpo, no la base. */
  pos: [number, number, number]
  size: [number, number, number]
}

export type Local = Box & { id: string; name: string; color: string }

/** PRNG determinista (mulberry32): misma semilla, misma colonia. */
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rnd = mulberry32(20260802)

const isStreet = (v: number) => STREET_CENTERS.includes(v)

// ---------------------------------------------------------------- calles

/*
 * La calle va en losetas de 8x8 en vez de una sola losa porque un bache tiene
 * que ser un hueco real: se baja la loseta y la rueda cae. Con una losa
 * entera haría falta un trimesh, que la sección 2 prohíbe.
 */
const tileCoords: number[] = []
for (let i = 0; i < MAP_SIZE / ROAD_TILE; i++) {
  tileCoords.push(-MAP_SIZE / 2 + ROAD_TILE / 2 + i * ROAD_TILE)
}

const roadKeys = new Set<string>()
const roadCells: { x: number; z: number; intersection: boolean }[] = []
for (const sz of STREET_CENTERS) {
  for (const x of tileCoords) {
    roadKeys.add(`${x},${sz}`)
    roadCells.push({ x, z: sz, intersection: isStreet(x) })
  }
}
for (const sx of STREET_CENTERS) {
  for (const z of tileCoords) {
    const key = `${sx},${z}`
    if (roadKeys.has(key)) continue // los cruces ya entraron arriba
    roadKeys.add(key)
    roadCells.push({ x: sx, z, intersection: false })
  }
}

/*
 * Baches: nunca en un cruce (ahí la pipa gira y sería injusto) ni cerca del
 * origen, que es donde aparece el jugador.
 */
const POTHOLE_COUNT = 10
const potholeKeys = new Set<string>()
{
  const candidatos = roadCells.filter(
    (c) => !c.intersection && Math.hypot(c.x, c.z) > 20,
  )
  // Barajado determinista: se ordena por un peso derivado de la semilla.
  const barajado = candidatos
    .map((c) => ({ c, w: rnd() }))
    .sort((a, b) => a.w - b.w)
    .slice(0, POTHOLE_COUNT)
  for (const { c } of barajado) potholeKeys.add(`${c.x},${c.z}`)
}

export const roadTiles: Box[] = roadCells.map((c) => {
  const hundido = potholeKeys.has(`${c.x},${c.z}`) ? POTHOLE_DEPTH : 0
  return {
    pos: [c.x, -ROAD_THICKNESS / 2 - hundido, c.z],
    size: [ROAD_TILE, ROAD_THICKNESS, ROAD_TILE],
  }
})

export const potholes = roadCells
  .filter((c) => potholeKeys.has(`${c.x},${c.z}`))
  .map((c) => ({ x: c.x, z: c.z }))

// ------------------------------------------------------------- banquetas

/*
 * La manzana entera es una plataforma de 15 cm. En greybox se lee igual que
 * una banqueta perimetral y cuesta 16 colliders en vez de 64.
 */
export const sidewalks: Box[] = []
for (const bx of BLOCK_CENTERS) {
  for (const bz of BLOCK_CENTERS) {
    sidewalks.push({
      // De -0.2 (fondo de la calle) a 0.15 (nivel de banqueta)
      pos: [bx, (SIDEWALK_HEIGHT - ROAD_THICKNESS) / 2, bz],
      size: [BLOCK_SIZE, SIDEWALK_HEIGHT + ROAD_THICKNESS, BLOCK_SIZE],
    })
  }
}

// ------------------------------------------------------- edificios y locales

const EDGE_MARGIN = 3 // de la orilla de la manzana al primer edificio
const LOT = (BLOCK_SIZE - 2 * EDGE_MARGIN) / 3 // 3x3 lotes por manzana
const GAP = 1.5 // callejón entre edificios
const FOOTPRINT = LOT - GAP

/** Manzana y lote (0..8) de cada local, y el color que lo distingue. */
const LOCAL_SPOTS: { block: number; lot: number; color: string }[] = [
  { block: 1, lot: 7, color: '#d94f4f' },
  { block: 4, lot: 3, color: '#e0a33a' },
  { block: 6, lot: 1, color: '#3ec98a' },
  { block: 9, lot: 5, color: '#4d8fe0' },
  { block: 11, lot: 7, color: '#b06fd6' },
  { block: 14, lot: 1, color: '#e07a3a' },
]

/** Lote ocupado por la toma de agua: ahí no va edificio. */
const WATER_SPOT = { block: 0, lot: 0 }

const localByKey = new Map(LOCAL_SPOTS.map((s) => [`${s.block},${s.lot}`, s]))

export const buildings: Box[] = []
export const locales: Local[] = []

let blockIndex = 0
for (const bx of BLOCK_CENTERS) {
  for (const bz of BLOCK_CENTERS) {
    for (let lot = 0; lot < 9; lot++) {
      const cx = bx + ((lot % 3) - 1) * LOT
      const cz = bz + (Math.floor(lot / 3) - 1) * LOT
      // Se consume el random siempre, ocupado o no, para que la altura de
      // cada edificio no cambie al mover un local de lugar.
      const altura = 5 + rnd() * 17

      if (blockIndex === WATER_SPOT.block && lot === WATER_SPOT.lot) continue

      const local = localByKey.get(`${blockIndex},${lot}`)
      if (local) {
        const h = 4
        locales.push({
          id: `local-${locales.length + 1}`,
          name: `Local ${locales.length + 1}`,
          color: local.color,
          pos: [cx, SIDEWALK_HEIGHT + h / 2, cz],
          size: [FOOTPRINT, h, FOOTPRINT],
        })
      } else {
        buildings.push({
          pos: [cx, SIDEWALK_HEIGHT + altura / 2, cz],
          size: [FOOTPRINT, altura, FOOTPRINT],
        })
      }
    }
    blockIndex++
  }
}

// ------------------------------------------------------------ toma de agua

const waterX = BLOCK_CENTERS[0] - LOT
const waterZ = BLOCK_CENTERS[0] - LOT

/** Dónde se llena la pipa (lo usa el Paso 8). Es el punto en el suelo. */
export const WATER_SOURCE = {
  id: 'toma-de-agua',
  name: 'Toma de agua',
  pos: [waterX, SIDEWALK_HEIGHT, waterZ] as [number, number, number],
  /** Radio para el escaneo de proximidad del Paso 9. */
  radius: 5,
}

export const waterParts = {
  base: {
    pos: [waterX, SIDEWALK_HEIGHT + 0.15, waterZ],
    size: [FOOTPRINT, 0.3, FOOTPRINT],
  } as Box,
  pipe: {
    pos: [waterX, SIDEWALK_HEIGHT + 0.3 + 1.1, waterZ] as [
      number,
      number,
      number,
    ],
    radius: 0.35,
    height: 2.2,
  },
  valve: {
    pos: [waterX, SIDEWALK_HEIGHT + 0.3 + 2.2 + 0.2, waterZ],
    size: [1.2, 0.4, 0.5],
  } as Box,
}

// ------------------------------------------------------------------ topes

/*
 * Uno a media cuadra, no en los cruces: así se sienten manejando en recta y
 * no estorban al dar vuelta. Nunca sobre un bache: un tope flotando sobre un
 * hoyo se ve roto, y con otra semilla el par sí llega a coincidir.
 */
export const topes: Box[] = []
for (const sz of STREET_CENTERS) {
  for (const bx of BLOCK_CENTERS) {
    if (rnd() < 0.4 && !potholeKeys.has(`${bx},${sz}`)) {
      topes.push({
        pos: [bx, TOPE_HEIGHT / 2, sz],
        size: [0.7, TOPE_HEIGHT, STREET_WIDTH],
      })
    }
  }
}
for (const sx of STREET_CENTERS) {
  for (const bz of BLOCK_CENTERS) {
    if (rnd() < 0.4 && !potholeKeys.has(`${sx},${bz}`)) {
      topes.push({
        pos: [sx, TOPE_HEIGHT / 2, bz],
        size: [STREET_WIDTH, TOPE_HEIGHT, 0.7],
      })
    }
  }
}

/** Resumen para el overlay de debug y para verificar el presupuesto. */
export const layoutStats = {
  roadTiles: roadTiles.length,
  potholes: potholes.length,
  sidewalks: sidewalks.length,
  buildings: buildings.length,
  locales: locales.length,
  topes: topes.length,
}
