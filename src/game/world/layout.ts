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
  fusionarRects,
  pintarAnillo,
  pintarArco,
  pintarDisco,
  pintarRect,
  pintarSegmento,
  type RectCeldas,
  type Rejilla,
} from './raster'
import { BANQUETA, generarBanquetas } from './banquetas'
import {
  ANGOSTURAS,
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
/*
 * El ancho de banqueta (1.5 m por lado) vive en banquetas.ts, que es quien
 * las genera del trazo; aquí solo se re-exporta para quien mida contra él.
 * El brinco es de 15 cm: subirse con la pipa se puede — pero se siente.
 */
export { BANQUETA }
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
/** 1 = sólido que NO genera lote (la isla y las huellas de los locales). */
const reservado: Rejilla = crearRejilla(MAP_SIZE, CELDA)

for (const c of CALLES) {
  if (c.forma === 'recta') pintarSegmento(rejilla, c.a, c.b, c.ancho)
  else pintarArco(rejilla, c.c, c.r, c.a0, c.a1, c.ancho)
}

// La calzada de la glorieta: anillo, no disco. La isla se queda sólida.
pintarAnillo(rejilla, GLORIETA.c, GLORIETA.rIsla, GLORIETA.rExt)
pintarDisco(reservado, GLORIETA.c, GLORIETA.rIsla)

// Callejones y angosturas: calle sin banqueta (son angostos de por sí; el
// generador vectorial de banquetas los conoce y no les pone bandas).
for (const c of [...CALLEJONES, ...ANGOSTURAS]) {
  pintarSegmento(rejilla, c.a, c.b, c.ancho)
}

for (const b of BAHIAS) {
  // A lo largo de `dir` mide el fondo; a lo ancho, el ancho.
  const largoX = b.dir[0] !== 0
  const c = centroBahia(b)
  const sx = largoX ? BAHIA_FONDO : BAHIA_ANCHO
  const sz = largoX ? BAHIA_ANCHO : BAHIA_FONDO
  pintarRect(rejilla, c, sx, sz)
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

/**
 * La POSE de calle más cercana a (x, z) donde cabe un cuerpo de medio ancho
 * y medio largo dados: punto + rumbo. Lo usa el enderezado de una volcadura:
 * la pipa reaparece derecha sobre la calle más próxima, no en el anillo (eso
 * es de caídas al vacío, donde perder la ruta ES el castigo).
 *
 * El LARGO importa: garantizar solo el medio ancho deja el centro en calle y
 * la trompa encallada en la manzana. Por eso cada celda candidata se prueba
 * con 16 rumbos —del más parecido al actual hacia afuera— exigiendo holgura
 * de medio ancho a lo largo de todo el eje.
 *
 * Búsqueda por anillos de celdas crecientes con corte temprano. En la
 * colonia cualquier punto tiene calle a menos de ~30 m, así que esto es
 * barato y el null del final es teoría (el test lo respalda).
 */
export function poseEnCalle(
  x: number,
  z: number,
  medioAncho: number,
  medioLargo: number,
  /** Rumbo actual (atan2(fwd.x, fwd.z)): se conserva lo más posible. */
  yaw: number,
  /** Punto a esquivar (el JUGADOR: su cápsula es cinemática y una pipa que
   *  le cae encima se queda recargada en él como en un poste). */
  evitar: { x: number; z: number; r: number } | null = null,
  maxDist = 60,
): { x: number; z: number; yaw: number } | null {
  const cabeAqui = (px: number, pz: number) => {
    const i = aCelda(rejilla, px)
    const j = aCelda(rejilla, pz)
    if (i < 0 || j < 0 || i >= N || j >= N) return false
    const k = j * N + i
    return rejilla.data[k] === 1 && distSolido[k] - CELDA / 2 >= medioAncho
  }

  /** El rumbo más parecido al actual con el eje completo sobre calle. */
  const rumboQueCabe = (px: number, pz: number): number | null => {
    for (let k = 0; k < 16; k++) {
      // 0, +22.5°, −22.5°, +45°, −45°... el más fiel al rumbo actual gana.
      const cand = yaw + (k % 2 === 0 ? 1 : -1) * Math.ceil(k / 2) * (Math.PI / 8)
      const dx = Math.sin(cand)
      const dz = Math.cos(cand)
      let cabe = true
      for (const t of [-medioLargo, -medioLargo / 2, medioLargo / 2, medioLargo]) {
        if (!cabeAqui(px + dx * t, pz + dz * t)) {
          cabe = false
          break
        }
      }
      if (cabe) return cand
    }
    return null
  }

  const ci = aCelda(rejilla, x)
  const cj = aCelda(rejilla, z)
  const maxR = Math.ceil(maxDist / CELDA)
  let mejor: { x: number; z: number; yaw: number } | null = null
  let mejorD = Infinity

  const prueba = (i: number, j: number) => {
    if (i < 0 || j < 0 || i >= N || j >= N) return
    const px = aMundo(rejilla, i)
    const pz = aMundo(rejilla, j)
    if (!cabeAqui(px, pz)) return
    if (evitar && Math.hypot(px - evitar.x, pz - evitar.z) < evitar.r) return
    const d = Math.hypot(px - x, pz - z)
    if (d >= mejorD) return
    const rumbo = rumboQueCabe(px, pz)
    if (rumbo === null) return
    mejorD = d
    mejor = { x: px, z: pz, yaw: rumbo }
  }

  for (let r = 0; r <= maxR; r++) {
    // Un anillo a distancia chebyshev r no puede acercarse más que (r−1)
    // celdas en euclidiano: si ni eso mejora al candidato, ya está.
    if ((r - 1) * CELDA > mejorD) break
    if (r === 0) {
      prueba(ci, cj)
      continue
    }
    for (let i = ci - r; i <= ci + r; i++) {
      prueba(i, cj - r)
      prueba(i, cj + r)
    }
    for (let j = cj - r + 1; j <= cj + r - 1; j++) {
      prueba(ci - r, j)
      prueba(ci + r, j)
    }
  }
  return mejor
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
    /*
     * 5.5 m y no 4 (Fase 3, Paso 2): medio nivel por encima del vecino de una
     * planta (2.8 m) para que el rótulo asome por encima de su barda y el
     * local se lea desde media cuadra. No compite con los hitos, que arrancan
     * en 12 m y siguen siendo lo único que domina el perfil.
     */
    size: [LOCAL_LADO, 5.5, LOCAL_LADO] as [number, number, number],
    door,
  }
})

// La huella de cada local se reserva: el fusionador no debe generar un lote
// encima (se dibujan aparte, con su color). El size va EXACTO: con el +1 de
// antes quedaba un nicho de 0.5 m sólido-para-la-lógica pero hueco-para-la-
// física alrededor de cada caja; ahora el lote vecino llega hasta la cara (el
// TRASLAPE lo mete 6 cm adentro, que sella sin caras coplanares).
for (const l of locales) {
  pintarRect(reservado, [l.pos[0], l.pos[2]], l.size[0], l.size[2])
}

/**
 * El taller: el lugar al que se llega MANEJANDO a comprar y mejorar (sección
 * 2 de la Fase 2). Su puerta se mide contra la pipa, no contra el jugador a
 * pie, igual que la toma de agua.
 */
const TALLER_ALTO = 6
export const taller = (() => {
  const { pos, door } = frente(TALLER, Math.max(TALLER.sx, TALLER.sz))
  pintarRect(reservado, [pos[0], pos[2]], TALLER.sx, TALLER.sz)
  /*
   * El letrero va en la cara que DA A LA CALLE, que es de donde viene el
   * jugador: se deriva de TALLER.dir (dir apunta de la calle a la manzana,
   * así que la fachada es la cara −dir). Antes estaba clavado en la cara
   * norte y el portón da al oeste: se veía de canto.
   */
  const alFrente = TALLER.dir[0] !== 0
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
      pos: [
        pos[0] - TALLER.dir[0] * (TALLER.sx / 2 - 0.4),
        TALLER_ALTO + 0.9,
        pos[2] - TALLER.dir[1] * (TALLER.sz / 2 - 0.4),
      ] as [number, number, number],
      size: (alFrente
        ? [0.5, 1.4, TALLER.sz * 0.7]
        : [TALLER.sx * 0.7, 1.4, 0.5]) as [number, number, number],
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
  // Size exacto, sin nicho (mismo motivo que los locales).
  pintarRect(reservado, [cx, cz], h.sx, h.sz)
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
  /**
   * El collider va un pelo ADENTRO del visual: el cilindro dibujado es un
   * polígono de 48 lados inscrito, y con el radio exacto la física
   * sobresalía entre vértices (un anillo de choque invisible). Así el error
   * queda del lado bueno: nunca chocas con aire.
   */
  radiusCollider: GLORIETA.rIsla * Math.cos(Math.PI / 48),
  segmentos: 48,
  height: 1.2,
}

export const kiosco: Box = {
  pos: [GLORIETA.c[0], 1.2 + 1.25, GLORIETA.c[1]],
  size: [6, 2.5, 6],
}

/** Dónde amanece el jugador: sobre Morelos, con la pipa 15 m al oeste. */
export const PLAYER_SPAWN: [number, number, number] = [0, 1, 18]

// ------------------------------------------------------ banquetas y lotes

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
 * Las banquetas vienen del TRAZO, no de la rejilla: bandas de 1.5 m pegadas
 * al borde del pavimento de cada calle, cadenas teseladas en los arcos,
 * chaflanes a 45° en las esquinas de los cruces, y la plataforma de cada
 * bahía del borde del pavimento al fondo. La versión anterior (rejilla
 * engrosada a 2 m con umbral del 25 %) inventaba planchas hasta a 5 m del
 * muro y pavimentaba las bahías hasta el eje — el «choqué con algo que no
 * veo». Detalle en banquetas.ts; el test cobra que ninguna caja se salga de
 * su zona.
 */
export const banquetasInfo = generarBanquetas()
export const sidewalks: Box[] = [
  ...banquetasInfo.bandas,
  ...banquetasInfo.chaflanes,
  ...banquetasInfo.plataformas.map((p) => p.caja),
]

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
/**
 * La ETIQUETA de lote de cada caja de `buildings`, en el mismo orden.
 *
 * Existe para el render, no para la física (Fase 3, Paso 2). El fusionador
 * parte un lote en 5 rectángulos de media —y sobre una curva rasterizada,
 * hasta en 41 astillas de 62 cm—, así que pintar por índice de caja hacía que
 * un mismo predio saliera de cinco colores pegados: el código de barras.
 *
 * Con la etiqueta a la mano, las fachadas agrupan por PREDIO y componen un
 * paño continuo, sin que la física se entere: las cajas y sus colliders son
 * exactamente los mismos. Publicarla es más barato y muchísimo menos
 * arriesgado que tocar el fusionador — nada en el suite verifica que
 * `buildings` cubra las celdas sólidas, así que un agrupamiento distinto
 * podría abrir un hueco en una manzana sin que un solo test se quejara.
 */
export const buildingLote: number[] = []
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
    for (let k = 0; k < 4; k++) buildingLote.push(r.etiqueta)
  } else {
    buildings.push({
      pos: [plano.pos[0], (esPatio ? BARDA_ALTURA : altura) / 2, plano.pos[2]],
      size: [sx, esPatio ? BARDA_ALTURA : altura, sz],
    })
    buildingLote.push(r.etiqueta)
  }
}

// ------------------------------------------------------------------ topes

const g70 = (70 * Math.PI) / 180

/** A mano, a media cuadra de calles largas; nunca en cruces ni callejones.
 *  Los de las curvas van girados: en una curva, el tope sigue el radio.
 *  El largo es el ARROYO (ancho − 2·banquetas): el tope termina contra el
 *  cordón como uno de verdad — antes cruzaba de muro a muro y sus puntas
 *  quedaban enterradas bajo la banqueta (0.12 < 0.15). */
export const topes: Box[] = [
  { pos: [-70, TOPE_HEIGHT / 2, 18], size: [0.7, TOPE_HEIGHT, 6] }, // Morelos
  { pos: [-30, TOPE_HEIGHT / 2, 40], size: [6, TOPE_HEIGHT, 0.7] }, // Hidalgo
  { pos: [32.4, TOPE_HEIGHT / 2, -25], size: [6, TOPE_HEIGHT, 0.7] }, // salida norte
  {
    // Avenida Curva a 70°: igual que el de la Media Luna, sobre el radio.
    pos: [-96 + 42 * Math.cos(g70), TOPE_HEIGHT / 2, -60 + 42 * Math.sin(g70)],
    size: [0.7, TOPE_HEIGHT, 8],
    rotY: Math.PI / 2 - g70,
  },
  { pos: [84, TOPE_HEIGHT / 2, 18], size: [0.7, TOPE_HEIGHT, 7] }, // Independencia
  { pos: [10, TOPE_HEIGHT / 2, -40], size: [0.7, TOPE_HEIGHT, 6] }, // Bravo
  {
    // Media Luna a 30°: el eje largo apunta al centro del arco.
    pos: [-10 + 62 * Math.cos(Math.PI / 6), TOPE_HEIGHT / 2, 40 + 62 * Math.sin(Math.PI / 6)],
    size: [0.7, TOPE_HEIGHT, 6],
    rotY: Math.PI / 2 - Math.PI / 6,
  },
]

/*
 * LA LISTA DE COLLIDERS DEL MUNDO, completa y en un solo lugar: WorldColliders
 * la itera tal cual y el conteo de layoutStats sale de su length — es
 * imposible que el número vuelva a mentir (antes se sumaba a mano y olvidaba
 * tres piezas). Cada caja de esta lista SE DIBUJA y cada caja dibujada está
 * aquí: no hay muros invisibles.
 */
export const worldColliderBoxes: Box[] = [
  groundSlab,
  ...sidewalks,
  ...buildings,
  ...locales.map((l) => ({ pos: l.pos, size: l.size })),
  ...hitos.map((h) => ({ pos: h.pos, size: h.size })),
  { pos: taller.pos, size: taller.size },
  { pos: taller.letrero.pos, size: taller.letrero.size },
  ...topes,
  kiosco,
  waterParts.base,
  waterParts.valve,
]

export const worldColliderCylinders: {
  pos: [number, number, number]
  radius: number
  height: number
}[] = [
  { pos: isla.pos, radius: isla.radiusCollider, height: isla.height },
  {
    pos: waterParts.pipe.pos,
    radius: waterParts.pipe.radius,
    height: waterParts.pipe.height,
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
  /** Colliders estáticos que se le entregan a Rapier: exacto por construcción. */
  colliders: worldColliderBoxes.length + worldColliderCylinders.length,
  /** Fracción del mapa que es calle. */
  fraccionCalle: solido.reduce((a, s) => a + (s ? 0 : 1), 0) / (N * N),
}

/** La glorieta es el único espacio abierto permitido; el test lo exceptúa. */
export { PLAZAS, CALLEJONES, ANGOSTURAS }
