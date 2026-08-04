/*
 * Geometría de la colonia. Solo datos: este módulo no toca three ni React, así
 * que los sistemas (pozo, locales, minimapa, rescate) y los tests pueden
 * importarlo sin arrastrar la escena.
 *
 * EL MODELO ESTÁ INVERTIDO respecto a la versión anterior: ya no se dibujan
 * calles Y manzanas por separado, dejando en medio un terreno ambiguo por el
 * que se podía pasar. Ahora se PINTA la red de calles (`traza.ts`) sobre una
 * rejilla de 0.5 m y **todo lo que quedó sin pintar es volumen sólido**. Que
 * ninguna manzana sea transitable dejó de ser algo que cuidar a mano: es una
 * consecuencia del pipeline, y `layout.test.ts` lo verifica.
 *
 * De ahí salen, en orden:
 *   calle → banquetas (dilatar el sólido) → lotes (fusionar el sólido en
 *   rectángulos) → edificios y patios (altura por lote, semilla fija).
 *
 * Las alturas salen de una semilla fija: la colonia es idéntica en cada
 * recarga, que es lo que hace comparables las pruebas.
 */

import {
  CELDA,
  aMundo,
  aCelda,
  crearRejilla,
  distanciaA,
  engrosar,
  fusionarRects,
  pintarAnillo,
  pintarArco,
  pintarDisco,
  pintarRect,
  pintarSegmento,
  type RectCeldas,
  type Rejilla,
} from './raster'
import {
  ANILLO,
  BAHIAS,
  BAHIA_ANCHO,
  BAHIA_FONDO,
  CALLEJONES,
  CALLES,
  DOMICILIOS_TRAZA,
  GLORIETA,
  HITOS,
  LOCALES_TRAZA,
  MAP_SIZE,
  PLAZAS,
  TALLER,
  centroBahia,
  marcaBahia,
  type Bahia,
  type Frente,
} from './traza'

export { MAP_SIZE, ANILLO }
export const SIDEWALK_HEIGHT = 0.15
export const ROAD_THICKNESS = 0.2
export const TOPE_HEIGHT = 0.12

/** Altura de una barda de patio: cierra el predio sin taparle la vista. */
export const BARDA_ALTURA = 2.4
const BARDA_GRUESO = 0.6
/** Una planta. Casi toda la colonia mide esto. */
const ALTURA_MIN = 2.8
/** Cuánto puede crecer sobre una planta: hasta dos y un pretil. */
const ALTURA_RANGO = 3.8
/**
 * Ancho de banqueta a cada lado de la calle. Cada metro de banqueta es un
 * metro menos de asfalto: con 2 m, una calle de 9 dejaba 5 m para una pipa de
 * 2.4 y se sentía un pasillo. El brinco es de 15 cm, así que subirse a la
 * banqueta con la pipa se puede — pero se siente, que es lo que se busca.
 */
const BANQUETA = 1.5
/** Lado máximo de un lote, en metros: más grande y la manzana es una masa. */
const LOTE_MAX = 14
/** Traslape entre lotes vecinos: sella la junta y evita caras coplanares. */
const TRASLAPE = 0.06

export type Box = {
  /** Centro del cuerpo, no la base. */
  pos: [number, number, number]
  size: [number, number, number]
  /** Giro sobre Y en radianes. Ausente = alineado a los ejes. */
  rotY?: number
}

export type Local = Box & {
  id: string
  name: string
  color: string
  /** Punto de la puerta, sobre la calle o el callejón al que da. La
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

// ------------------------------------------------------------- la rejilla

/** 1 = calle (transitable), 0 = sólido. La verdad del mapa. */
const rejilla: Rejilla = crearRejilla(MAP_SIZE, CELDA)
/** 1 = calle donde NO va banqueta: los callejones son angostos de por sí. */
const sinBanqueta: Rejilla = crearRejilla(MAP_SIZE, CELDA)
/** 1 = banqueta forzada: las bahías son plataforma completa. */
const conBanqueta: Rejilla = crearRejilla(MAP_SIZE, CELDA)
/** 1 = sólido que NO genera lote (la isla y las huellas de los locales). */
const reservado: Rejilla = crearRejilla(MAP_SIZE, CELDA)

for (const c of CALLES) {
  if (c.forma === 'recta') pintarSegmento(rejilla, c.a, c.b, c.ancho)
  else pintarArco(rejilla, c.c, c.r, c.a0, c.a1, c.ancho)
}

// La calzada de la glorieta: anillo, no disco. La isla se queda sólida.
pintarAnillo(rejilla, GLORIETA.c, GLORIETA.rIsla, GLORIETA.rExt)
pintarDisco(reservado, GLORIETA.c, GLORIETA.rIsla)

for (const c of CALLEJONES) {
  pintarSegmento(rejilla, c.a, c.b, c.ancho)
  pintarSegmento(sinBanqueta, c.a, c.b, c.ancho)
}

for (const b of BAHIAS) {
  // A lo largo de `dir` mide el fondo; a lo ancho, el ancho.
  const largoX = b.dir[0] !== 0
  const c = centroBahia(b)
  const sx = largoX ? BAHIA_FONDO : BAHIA_ANCHO
  const sz = largoX ? BAHIA_ANCHO : BAHIA_FONDO
  pintarRect(rejilla, c, sx, sz)
  pintarRect(conBanqueta, c, sx, sz)
}

const N = rejilla.n
const solido = new Uint8Array(N * N)
for (let k = 0; k < solido.length; k++) solido[k] = rejilla.data[k] ? 0 : 1

/** Metros de cada celda al sólido más cercano. De aquí salen las banquetas,
 *  la erosión por ancho de cuerpo y la prueba de que no hay campo abierto. */
const distSolido = distanciaA(solido, N, CELDA)

// La orilla del mapa cuenta como muro: el anillo perimetral tiene manzana de
// un solo lado y sin esto parecería campo abierto de 10 m de radio.
for (let j = 0; j < N; j++) {
  for (let i = 0; i < N; i++) {
    const alBorde = (Math.min(i, j, N - 1 - i, N - 1 - j) + 0.5) * CELDA
    const k = j * N + i
    if (alBorde < distSolido[k]) distSolido[k] = alBorde
  }
}

// ---------------------------------------------------------------- consultas

/** ¿Se puede pisar este punto? (fuera del mapa cuenta como sólido) */
export function esLibre(x: number, z: number) {
  const i = aCelda(rejilla, x)
  const j = aCelda(rejilla, z)
  if (i < 0 || j < 0 || i >= N || j >= N) return false
  return rejilla.data[j * N + i] === 1
}

/** Holgura hasta el muro más cercano, en metros. Un cuerpo de radio r cabe
 *  aquí si `holgura(x,z) >= r`. Con eso el test decide qué callejón es
 *  peatonal y cuál pasa la pipa, en vez de fiarse del ojo.
 *
 *  La distancia se mide de centro a centro de celda, así que se le descuenta
 *  media celda: el muro empieza en la orilla de su celda, no en su centro. */
export function holgura(x: number, z: number) {
  const i = aCelda(rejilla, x)
  const j = aCelda(rejilla, z)
  if (i < 0 || j < 0 || i >= N || j >= N) return 0
  return Math.max(0, distSolido[j * N + i] - CELDA / 2)
}

/** La rejilla cruda, para el test de invariantes y el volcado del mapa. */
export const mapaOcupacion = {
  n: N,
  celda: CELDA,
  min: rejilla.min,
  calle: rejilla.data,
  distSolido,
  aMundo: (i: number) => aMundo(rejilla, i),
  aCelda: (x: number) => aCelda(rejilla, x),
}

// ----------------------------------------------------------------- suelo

/**
 * El asfalto: una sola losa bajo todo el mapa con la cara superior en y = 0.
 * Ya no hay cajas de calle (y por lo tanto tampoco el escalón anti z-fighting
 * de la versión anterior, ni juntas que se sientan como baches en las curvas).
 */
export const groundSlab: Box = {
  pos: [0, -ROAD_THICKNESS / 2, 0],
  size: [MAP_SIZE, ROAD_THICKNESS, MAP_SIZE],
}

// ------------------------------------------------- locales, casas y toma

/** Lado de la caja de un local. */
const LOCAL_LADO = 9

/**
 * Resuelve un frente contra la rejilla: avanza desde el eje de la calle hasta
 * salir del pavimento y devuelve la puerta (un metro adentro de la banqueta)
 * y el centro de la caja (metida en la manzana). Así el local queda pegado a
 * SU calle sin importar cuánto mida esa calle ni que sea curva.
 */
function frente(f: Frente, fondo = 0) {
  const [ex, ez] = f.eje
  let t = 0
  while (t < 40 && esLibre(ex + f.dir[0] * t, ez + f.dir[1] * t)) t += CELDA
  const borde = t // primer punto sólido
  const puerta = Math.max(0, borde - 1)
  const dentro = borde + fondo / 2 + (f.retiro ?? 0)
  return {
    door: [ex + f.dir[0] * puerta, SIDEWALK_HEIGHT, ez + f.dir[1] * puerta] as [
      number,
      number,
      number,
    ],
    pos: [ex + f.dir[0] * dentro, SIDEWALK_HEIGHT + 2, ez + f.dir[1] * dentro] as [
      number,
      number,
      number,
    ],
  }
}

/*
 * Los 6 locales. Dos dan a callejón peatonal (`c-barda` y `c-kiosco`): el
 * pedido se toma a pie, así que conocer el atajo te ahorra rodear manejando.
 */
export const locales: Local[] = LOCALES_TRAZA.map((l) => {
  const { door, pos } = frente(l, LOCAL_LADO)
  return {
    id: l.id,
    name: l.name,
    color: l.color,
    pos,
    size: [LOCAL_LADO, 4, LOCAL_LADO] as [number, number, number],
    door,
  }
})

// La huella de cada local se reserva: el fusionador no debe generar un lote
// encima (se dibujan aparte, con su color).
for (const l of locales) {
  pintarRect(reservado, [l.pos[0], l.pos[2]], l.size[0] + 1, l.size[2] + 1)
}

/**
 * El taller: el lugar al que se llega MANEJANDO a comprar y mejorar (sección
 * 2 de la Fase 2). Su puerta se mide contra la pipa, no contra el jugador a
 * pie, igual que la toma de agua.
 */
const TALLER_ALTO = 6
export const taller = (() => {
  const { pos, door } = frente(TALLER, Math.max(TALLER.sx, TALLER.sz))
  pintarRect(reservado, [pos[0], pos[2]], TALLER.sx + 1, TALLER.sz + 1)
  return {
    id: TALLER.id,
    nombre: TALLER.nombre,
    /** Centro de la nave, ya metida en la manzana. */
    pos: [pos[0], TALLER_ALTO / 2, pos[2]] as [number, number, number],
    size: [TALLER.sx, TALLER_ALTO, TALLER.sz] as [number, number, number],
    /** Dónde se para la pipa: sobre el pavimento, frente al portón. */
    door,
    /** El letrero sobre la nave: lo que se ve desde la calle. */
    letrero: {
      pos: [pos[0], TALLER_ALTO + 0.9, pos[2] - TALLER.sz / 2 + 0.4] as [
        number,
        number,
        number,
      ],
      size: [TALLER.sx * 0.7, 1.4, 0.5] as [number, number, number],
    },
  }
})()

/**
 * Los cuatro hitos: lo único que sobresale del perfil de una y dos plantas.
 * Son puntos de referencia, no decoración — de ahí que sean cuatro y estén
 * repartidos. Cada uno se resuelve contra su calle igual que un local, y su
 * huella se reserva para que el fusionador no le meta un lote encima.
 */
export const hitos: (Box & { color: string })[] = HITOS.flatMap((h) => {
  const { pos } = frente(h, Math.max(h.sx, h.sz))
  const [cx, , cz] = pos
  pintarRect(reservado, [cx, cz], h.sx + 1, h.sz + 1)
  const cajas: (Box & { color: string })[] = [
    {
      pos: [cx, h.altura / 2, cz],
      size: [h.sx, h.altura, h.sz],
      color: h.color,
    },
  ]
  if (h.remate) {
    cajas.push({
      pos: [cx, h.altura + h.remate.altura / 2, cz],
      size: [h.remate.sx, h.remate.altura, h.remate.sz],
      color: h.remate.color,
    })
  }
  return cajas
})

/**
 * Domicilio de entrega de cada cliente fijo: el pedido se consigue tocando la
 * puerta del NEGOCIO, pero el agua se entrega en la casa u obra, siempre
 * lejos y siempre a alcance de una calle por la que quepa la pipa. Eso es lo
 * que le da sentido a planear la ruta.
 */
export const DOMICILIOS: Record<string, [number, number, number]> =
  Object.fromEntries(DOMICILIOS_TRAZA.map((d) => [d.id, frente(d).door]))

/** Lugares donde pueden aparecer clientes efímeros: el fondo de cada bahía,
 *  que está abierta a la calle y cerrada por los otros tres lados. */
const marca = (b: Bahia): [number, number, number] => {
  const m = marcaBahia(b)
  return [m[0], SIDEWALK_HEIGHT, m[1]]
}

export const EPHEMERAL_SPOTS: {
  id: string
  tipo: 'casa' | 'obra'
  pos: [number, number, number]
}[] = BAHIAS.filter((b) => b.id !== 'toma').map((b, i) => ({
  id: b.id,
  tipo: i % 3 === 1 ? 'obra' : 'casa',
  pos: marca(b),
}))

/** Dónde se llena la pipa: en su propia bahía sobre Independencia, a una
 *  cuadra de la glorieta. */
export const WATER_SOURCE = {
  id: 'toma-de-agua',
  name: 'Toma de agua',
  pos: marca(BAHIAS.find((b) => b.id === 'toma')!),
  radius: 5,
}

export const waterParts = {
  base: {
    pos: [WATER_SOURCE.pos[0], SIDEWALK_HEIGHT + 0.15, WATER_SOURCE.pos[2]],
    size: [4, 0.3, 4],
  } as Box,
  pipe: {
    pos: [
      WATER_SOURCE.pos[0],
      SIDEWALK_HEIGHT + 0.3 + 1.1,
      WATER_SOURCE.pos[2],
    ] as [number, number, number],
    radius: 0.35,
    height: 2.2,
  },
  valve: {
    pos: [
      WATER_SOURCE.pos[0],
      SIDEWALK_HEIGHT + 0.3 + 2.2 + 0.2,
      WATER_SOURCE.pos[2],
    ],
    size: [1.2, 0.4, 0.5],
  } as Box,
}

/** La isla de la glorieta: jardín elevado con el kiosco encima. Rodearla es
 *  la gracia; treparla no es opción. */
export const isla = {
  pos: [GLORIETA.c[0], 0.6, GLORIETA.c[1]] as [number, number, number],
  radius: GLORIETA.rIsla,
  height: 1.2,
}

export const kiosco: Box = {
  pos: [GLORIETA.c[0], 1.2 + 1.25, GLORIETA.c[1]],
  size: [6, 2.5, 6],
}

/** Dónde amanece el jugador: sobre Morelos, con la pipa 15 m al oeste. */
export const PLAYER_SPAWN: [number, number, number] = [0, 1, 18]

// ------------------------------------------------------ banquetas y lotes

/*
 * Banqueta = celda de calle a menos de 2 m del sólido, menos los callejones
 * (uno de 1.8 m se llenaría entero) y más las bahías (plataforma completa,
 * para que la cajita del cliente efímero se pare sobre algo).
 */
const maskBanqueta = new Uint8Array(N * N)
for (let k = 0; k < maskBanqueta.length; k++) {
  if (!rejilla.data[k]) continue
  if (sinBanqueta.data[k]) continue
  maskBanqueta[k] = conBanqueta.data[k] || distSolido[k] <= BANQUETA ? 1 : 0
}

/** Rect de celdas → caja de mundo, con el traslape que sella las juntas. */
function aCaja(r: RectCeldas, y0: number, alto: number): Box {
  const sx = r.w * CELDA + TRASLAPE * 2
  const sz = r.h * CELDA + TRASLAPE * 2
  return {
    pos: [
      rejilla.min + (r.i + r.w / 2) * CELDA,
      y0 + alto / 2,
      rejilla.min + (r.j + r.h / 2) * CELDA,
    ],
    size: [sx, alto, sz],
  }
}

/*
 * Las banquetas se fusionan a 2 m, no a 0.5: son una plancha de 15 cm que no
 * sella nada, y seguir el borde de una curva con precisión de medio metro
 * cuesta cientos de cajas que a ras de suelo nadie distingue. Donde SÍ importa
 * el medio metro es en los muros, y esos van abajo a resolución fina.
 */
const banquetaGruesa = engrosar(maskBanqueta, N, 4, 4)
export const sidewalks: Box[] = fusionarRects(
  banquetaGruesa.mask,
  banquetaGruesa.n,
  4096,
).map((r) =>
  // De -0.1 (enterrada en el asfalto) a 0.15 (nivel de banqueta).
  aCaja(
    { i: r.i * 4, j: r.j * 4, w: r.w * 4, h: r.h * 4, etiqueta: 1 },
    -0.1,
    0.1 + SIDEWALK_HEIGHT,
  ),
)

/*
 * Los lotes. El sólido se etiqueta con una retícula de 14 m ANTES de fusionar:
 * todas las celdas de un lote comparten etiqueta y por lo tanto altura, así
 * que el borde escalonado de una curva no queda como serrucho de alturas
 * distintas, sino como un edificio cuya planta sigue la curva.
 *
 * El dado se saca de la POSICIÓN del lote, no de una secuencia: mover una
 * calle cambia la forma de las manzanas vecinas, no las alturas de toda la
 * colonia (que era lo que pasaba con el `rnd()` corrido de la versión
 * anterior). Misma colonia en cada recarga, de todos modos.
 */
function dadoDeLote(li: number, lj: number, sal: number) {
  return mulberry32((li * 73856093) ^ (lj * 19349663) ^ (sal * 83492791))()
}

const LADO_LOTE = Math.round(LOTE_MAX / CELDA)
const etiquetas = new Int32Array(N * N)
for (let j = 0; j < N; j++) {
  for (let i = 0; i < N; i++) {
    const k = j * N + i
    if (!solido[k] || reservado.data[k]) continue
    etiquetas[k] = 1 + ((i / LADO_LOTE) | 0) * 1000 + ((j / LADO_LOTE) | 0)
  }
}

const lotes = fusionarRects(etiquetas, N, LADO_LOTE)

export const buildings: Box[] = []
/** Huella plana de cada lote. La usa el minimapa: dibujar solo las bardas de
 *  un patio dejaría el interior en blanco, como si se pudiera pasar. */
export const footprints: Box[] = []

/** La caja más grande de cada lote: ahí es donde cabe un patio. */
const mayorPorLote = new Map<number, number>()
for (const r of lotes) {
  const area = r.w * r.h
  const previo = mayorPorLote.get(r.etiqueta)
  if (previo === undefined || area > previo) mayorPorLote.set(r.etiqueta, area)
}

for (const r of lotes) {
  const plano = aCaja(r, 0, 0.01)
  footprints.push(plano)
  const sx = plano.size[0]
  const sz = plano.size[2]
  const li = ((r.etiqueta - 1) / 1000) | 0
  const lj = (r.etiqueta - 1) % 1000
  /*
   * SÓLIDO NO ES ALTO. Una colonia es de una y dos plantas: si todo mide 20 m
   * el mapa deja de ser una colonia y se vuelve un laberinto sin salida, y el
   * jugador pierde la única forma barata de ubicarse, que es ver por encima.
   *
   * La curva va sesgada hacia abajo (el dado elevado a 1.6) para que la
   * mayoría sea de una planta y las de dos sean la excepción. Lo que sube por
   * encima de esto son los HITOS, y son cuatro contados.
   */
  const altura = ALTURA_MIN + Math.pow(dadoDeLote(li, lj, 1), 1.6) * ALTURA_RANGO
  /*
   * Casi un tercio de los lotes es PATIO: cuatro bardas de 2.4 m en vez de un
   * edificio. Desde la cámara se ve el interior y desde la calle es un muro:
   * es lo que le da textura a la manzana sin abrirle un paso, y lo que baja el
   * perfil de la colonia sin dejar un solo hueco por donde cortar.
   */
  const esPatio = dadoDeLote(li, lj, 2) < 0.3
  const cabePatio = sx >= 7 && sz >= 7 && r.w * r.h === mayorPorLote.get(r.etiqueta)
  if (esPatio && cabePatio) {
    const [cx, , cz] = plano.pos
    const y = BARDA_ALTURA / 2
    buildings.push(
      { pos: [cx, y, cz - sz / 2 + BARDA_GRUESO / 2], size: [sx, BARDA_ALTURA, BARDA_GRUESO] },
      { pos: [cx, y, cz + sz / 2 - BARDA_GRUESO / 2], size: [sx, BARDA_ALTURA, BARDA_GRUESO] },
      { pos: [cx - sx / 2 + BARDA_GRUESO / 2, y, cz], size: [BARDA_GRUESO, BARDA_ALTURA, sz] },
      { pos: [cx + sx / 2 - BARDA_GRUESO / 2, y, cz], size: [BARDA_GRUESO, BARDA_ALTURA, sz] },
    )
  } else {
    buildings.push({
      pos: [plano.pos[0], (esPatio ? BARDA_ALTURA : altura) / 2, plano.pos[2]],
      size: [sx, esPatio ? BARDA_ALTURA : altura, sz],
    })
  }
}

// ------------------------------------------------------------------ topes

const g70 = (70 * Math.PI) / 180

/** A mano, a media cuadra de calles largas; nunca en cruces ni callejones.
 *  Los de las curvas van girados: en una curva, el tope sigue el radio. */
export const topes: Box[] = [
  { pos: [-70, TOPE_HEIGHT / 2, 18], size: [0.7, TOPE_HEIGHT, 9] }, // Morelos
  { pos: [-30, TOPE_HEIGHT / 2, 40], size: [9, TOPE_HEIGHT, 0.7] }, // Hidalgo
  { pos: [32.4, TOPE_HEIGHT / 2, -25], size: [9, TOPE_HEIGHT, 0.7] }, // salida norte
  {
    // Avenida Curva a 70°: igual que el de la Media Luna, sobre el radio.
    pos: [-96 + 42 * Math.cos(g70), TOPE_HEIGHT / 2, -60 + 42 * Math.sin(g70)],
    size: [0.7, TOPE_HEIGHT, 11],
    rotY: Math.PI / 2 - g70,
  },
  { pos: [84, TOPE_HEIGHT / 2, 18], size: [0.7, TOPE_HEIGHT, 10] }, // Independencia
  { pos: [10, TOPE_HEIGHT / 2, -40], size: [0.7, TOPE_HEIGHT, 9] }, // Bravo
  {
    // Media Luna a 30°: el eje largo apunta al centro del arco.
    pos: [-10 + 62 * Math.cos(Math.PI / 6), TOPE_HEIGHT / 2, 40 + 62 * Math.sin(Math.PI / 6)],
    size: [0.7, TOPE_HEIGHT, 9],
    rotY: Math.PI / 2 - Math.PI / 6,
  },
]

/** Resumen para verificar el presupuesto a ojo (y en el test). */
export const layoutStats = {
  lotes: lotes.length,
  buildings: buildings.length,
  sidewalks: sidewalks.length,
  locales: locales.length,
  topes: topes.length,
  hitos: hitos.length,
  /** Cuboides estáticos que se le entregan a Rapier. */
  colliders:
    1 +
    buildings.length +
    sidewalks.length +
    locales.length +
    hitos.length +
    topes.length +
    3,
  /** Fracción del mapa que es calle. */
  fraccionCalle: solido.reduce((a, s) => a + (s ? 0 : 1), 0) / (N * N),
}

/** La glorieta es el único espacio abierto permitido; el test lo exceptúa. */
export { PLAZAS, CALLEJONES }
