/*
 * EL TRAZO DE LA COLONIA. Este es el único archivo que se toca para mover una
 * calle: `layout.ts` lo pinta sobre la rejilla y deriva TODO lo demás
 * (manzanas, banquetas, lotes) de lo que quedó sin pintar.
 *
 * La regla del trazo: no hay terreno vacío. Lo que no es calle es volumen
 * sólido, así que las calles son el único camino y conocerlas es la ventaja.
 *
 * Convención de ángulos: grados de `atan2(z, x)` — 0° al este (+x) y crecen
 * hacia el sur (+z), o sea en el sentido de las manecillas visto desde arriba,
 * que es como se ve el mapa.
 */

import type { Punto } from './raster'

export const MAP_SIZE = 200 // metros por lado

/** Centro de la calle del anillo perimetral. Lo usa el rescate por caída:
 *  es el terreno firme garantizado más cercano a cualquier borde. */
export const ANILLO = 96
export const ANCHO_ANILLO = 10

const g = (grados: number) => (grados * Math.PI) / 180

export type Calle =
  | { nombre: string; forma: 'recta'; a: Punto; b: Punto; ancho: number }
  | {
      nombre: string
      forma: 'arco'
      c: Punto
      r: number
      a0: number
      a1: number
      ancho: number
    }

/**
 * La glorieta del Kiosco: isla sólida que se rodea y cinco salidas radiales.
 * Es la curva más legible del mapa — no hay forma de cruzarla derecho.
 */
export const GLORIETA = {
  c: [30, 18] as Punto,
  /** Radio de la isla (el kiosco va encima). */
  rIsla: 9,
  /** Radio exterior de la calzada: 11 m de anchura para rodearla. */
  rExt: 20,
}

/** Punto sobre el borde exterior de la glorieta, para nacer una salida. */
const salida = (grados: number, r = GLORIETA.rExt): Punto => [
  GLORIETA.c[0] + r * Math.cos(g(grados)),
  GLORIETA.c[1] + r * Math.sin(g(grados)),
]

export const CALLES: Calle[] = [
  // ---------------------------------------------------------- anillo
  { nombre: 'anillo-norte', forma: 'recta', a: [-100, -ANILLO], b: [100, -ANILLO], ancho: ANCHO_ANILLO },
  { nombre: 'anillo-sur', forma: 'recta', a: [-100, ANILLO], b: [100, ANILLO], ancho: ANCHO_ANILLO },
  { nombre: 'anillo-oeste', forma: 'recta', a: [-ANILLO, -100], b: [-ANILLO, 100], ancho: ANCHO_ANILLO },
  { nombre: 'anillo-este', forma: 'recta', a: [ANILLO, -100], b: [ANILLO, 100], ancho: ANCHO_ANILLO },

  // --------------------------------------------------------- las curvas
  /*
   * Avenida Curva: una S de dos arcos TANGENTES (el segundo tiene su centro
   * sobre la prolongación del radio del primero, por eso no hay quiebre al
   * pasar de uno al otro). Entra por el anillo oeste y sale por el norte.
   *
   * Ojo con dónde se ponen los centros: un arco que TERMINA tangente a otra
   * calle corre pegado a ella decenas de metros y las dos juntas se vuelven
   * un llano. Por eso el centro de `curva-a` está sobre el eje del anillo
   * oeste: así el arco lo cruza de frente y no lo acompaña.
   */
  { nombre: 'curva-a', forma: 'arco', c: [-96, -60], r: 42, a0: g(0), a1: g(90), ancho: 11 },
  { nombre: 'curva-b', forma: 'arco', c: [-14, -60], r: 40, a0: g(180), a1: g(235), ancho: 11 },

  /** Bulevar del Sur: cuarto de círculo alrededor de la esquina suroeste. Su
   *  centro es el cruce de los dos anillos, así que entra y sale de frente. */
  { nombre: 'bulevar-sur', forma: 'arco', c: [-96, 96], r: 45, a0: g(270), a1: g(360), ancho: 10 },

  /** Media Luna: creciente de la glorieta al anillo sur, bombeada al este. */
  { nombre: 'media-luna', forma: 'arco', c: [-10, 40], r: 62, a0: g(0), a1: g(55), ancho: 9 },
  /** Muñón que amarra la Media Luna con la glorieta. */
  { nombre: 'media-luna-muñón', forma: 'recta', a: salida(45), b: [53, 41], ancho: 9 },

  /** Curva del Cerro: recorta la esquina noreste de anillo a anillo. */
  { nombre: 'curva-ne', forma: 'arco', c: [92, -92], r: 55, a0: g(90), a1: g(180), ancho: 9 },

  // ------------------------------------------------- salidas de glorieta
  { nombre: 'independencia', forma: 'recta', a: salida(0, 18), b: [92, 18], ancho: 10 },
  { nombre: 'salida-sur', forma: 'recta', a: salida(110), b: [18, 92], ancho: 9 },
  /* Muere en Bravo: si siguiera al anillo correría pegada a la Curva del
   * Cerro y las dos juntas serían un llano de 20 m. */
  { nombre: 'salida-norte', forma: 'recta', a: salida(275), b: [33, -44], ancho: 9 },
  { nombre: 'morelos', forma: 'recta', a: [-92, 18], b: salida(180, 18), ancho: 9 },

  // ------------------------------------------------------------- rectas
  { nombre: 'hidalgo', forma: 'recta', a: [-30, -92], b: [-30, 92], ancho: 9 },
  { nombre: 'bravo', forma: 'recta', a: [-30, -40], b: [34, -40], ancho: 9 },
  /* Corregidora viene partida en dos: a media calle hay una ANGOSTURA (ver
   * abajo) por la que la grandota no cabe. Sigue siendo pasante para las
   * otras dos; la grandota rodea por Hidalgo o la Curva del Cerro. */
  { nombre: 'corregidora', forma: 'recta', a: [8, -92], b: [8, -58], ancho: 8 },
  { nombre: 'corregidora-sur', forma: 'recta', a: [8, -44], b: [8, -40], ancho: 8 },
  { nombre: 'ocampo', forma: 'recta', a: [-12, 18], b: [-12, 92], ancho: 9 },
  { nombre: 'allende', forma: 'recta', a: [-30, 56], b: [22, 56], ancho: 9 },
  /* Muere en el Bulevar: cruzarlo abriría un cruce de 17 m en diagonal. */
  { nombre: 'aldama', forma: 'recta', a: [-62, 18], b: [-62, 68], ancho: 9 },
  { nombre: 'aldama-norte', forma: 'recta', a: [-62, 18], b: [-62, -30], ancho: 9 },
  { nombre: 'zaragoza', forma: 'recta', a: [-62, -30], b: [-30, -30], ancho: 8 },
  { nombre: 'reforma', forma: 'recta', a: [-92, -70], b: [-53, -70], ancho: 9 },

  // --------------------------------------------------------- retornos
  /** Dos calles que no llegan a ningún lado: la colonia no es una retícula.
   *  Sus bocas son ANGOSTURAS (abajo): la grandota no entra a ninguno. */
  { nombre: 'retorno-alameda', forma: 'recta', a: [-46, 4], b: [-46, -4], ancho: 8 },
  { nombre: 'retorno-cerro', forma: 'recta', a: [34, -62], b: [26, -62], ancho: 8 },
  /* La boca del retorno Cerro se queda ancha: amarrar un cuello de 3 m
   * directo contra el ARCO de la curva deja una unión biselada que no es ni
   * calle ni cuello. El muñón enlaza con la curva como calle normal y la
   * angostura va entre el muñón y el cuerpo, recta contra recta. */
  { nombre: 'retorno-cerro-boca', forma: 'recta', a: [46, -62], b: [44, -62], ancho: 8 },
]

/**
 * LAS ANGOSTURAS (Fase 2, Paso 4): cuellos de 3 m donde la grandota no cabe.
 *
 * Son la desventaja REAL del modelo grande que pide la sección 3: 2.88 m de
 * camión por un hueco físico de 2.88 (los colliders de los lotes invaden
 * TRASLAPE por lado) no pasa; la mediana (2.40) pasa apretada y derecha, y la
 * heredada sobrada. Sin calles así, la grandota sería simplemente mejor y los
 * otros dos modelos dejarían de existir.
 *
 * Reglas del dato, que el test cobra:
 *   - El EJE va en coordenada ENTERA y alineado a los ejes. Los centros de
 *     celda caen en ±0.25: así un ancho de 3 rasteriza a 6 columnas exactas
 *     con 1.5 m del eje al muro — pasa el flood de la mediana (1.35) y no el
 *     de la grandota (1.59). Un eje en centro de celda daría 7 columnas y la
 *     grandota pasaría.
 *   - El tramo a→b es solo la GARGANTA pura: las tapas redondas de la calle
 *     ancha vecina abultan ancho/2 más allá de su extremo, y el test muestrea
 *     este eje esperando holgura de cuello, no de bocacalle.
 */
export type Angostura = { id: string; a: Punto; b: Punto; ancho: number }

export const ANGOSTURAS: Angostura[] = [
  // Boca del retorno Alameda, desde Morelos: el retorno entero es de chicas.
  { id: 'a-alameda', a: [-46, 14], b: [-46, 8], ancho: 3 },
  // A media Corregidora: la única calle pasante con cuello. No deja a nadie
  // fuera de alcance; a la grandota le cuesta la ruta, no el cliente.
  { id: 'a-corregidora', a: [8, -54], b: [8, -48], ancho: 3 },
  // Boca del retorno Cerro, desde la Curva del Cerro. Al fondo vive el único
  // cliente del mapa al que la grandota no llega (spot-11). El eje termina en
  // x=39 y no en la orilla del arco: la unión con una calle curva se bisela y
  // ahí la holgura es de bocacalle, no de cuello.
  { id: 'a-cerro', a: [39, -62], b: [37, -62], ancho: 3 },
]

/**
 * Los tres atajos. Angostos a propósito y NUNCA anchos: son la recompensa de
 * conocer la colonia, no una salida por donde cortar en cualquier dirección.
 *
 * La pipa mide 2.4 m de ancho y el jugador 0.7: por eso 4.5 pasa manejando
 * (apretado, hay que entrar derecho) y 1.8 no pasa ni de milagro. Ahí está la
 * decisión de la jornada: ¿le doy la vuelta en pipa o me bajo y camino?
 */
export type Callejon = {
  id: string
  a: Punto
  b: Punto
  ancho: number
  /** true = solo a pie. Lo verifica `layout.test.ts`, no el buen juicio. */
  soloAPie: boolean
}

export const CALLEJONES: Callejon[] = [
  {
    id: 'c-diagonal',
    // Cruza en diagonal la manzanota del noreste, de la glorieta a la curva
    // del cerro. En pipa se ahorra media colonia; hay que entrar derecho.
    a: [46, 10],
    b: [87, -32],
    ancho: 4.5,
    soloAPie: false,
  },
  {
    id: 'c-barda',
    // Entre la salida sur y la Media Luna: al otro lado está el Local 1.
    a: [20, 70],
    b: [44, 70],
    ancho: 2,
    soloAPie: true,
  },
  {
    id: 'c-kiosco',
    // Ranura peatonal de la glorieta a la calle Bravo, con el Local 3 a medio
    // camino. Manejando hay que rodear por la salida norte.
    a: salida(250),
    b: [20, -36],
    ancho: 2,
    soloAPie: true,
  },
]

/**
 * Bahías: mordidas en la orilla de una manzana, abiertas a la calle y
 * cerradas por los otros tres lados. Ahí caben los clientes efímeros (que
 * plantan su propia cajita con collider) y la toma de agua, sin invadir la
 * calle ni encimarse con un lote.
 *
 * Se definen desde el EJE de su calle y no por su centro: así la bahía nace
 * dentro del pavimento y no hay manera de dejarla suelta a media manzana,
 * que es justo el error que cuesta caro (un cliente inalcanzable).
 */
export type Bahia = {
  id: string
  /** Punto sobre el eje de la calle a la que se abre. */
  eje: Punto
  /** Hacia dónde muerde la manzana. Unitario y alineado a los ejes. */
  dir: Punto
}

/** Profundidad de la bahía medida desde el EJE de la calle. */
export const BAHIA_FONDO = 10
export const BAHIA_ANCHO = 9
/** A qué distancia del eje se para el cliente (o la toma). */
export const BAHIA_MARCA = 7.5

const N: Punto = [0, -1]
const S: Punto = [0, 1]
const E: Punto = [1, 0]
const O: Punto = [-1, 0]

export const BAHIAS: Bahia[] = [
  { id: 'spot-1', eje: [-40, 18], dir: S }, // Morelos
  { id: 'spot-2', eje: [-76, 18], dir: N }, // Morelos
  { id: 'spot-3', eje: [-30, 46], dir: E }, // Hidalgo
  { id: 'spot-4', eje: [-62, 40], dir: E }, // Aldama
  { id: 'spot-5', eje: [-12, 70], dir: E }, // Ocampo
  { id: 'spot-6', eje: [8, 56], dir: N }, // Allende
  { id: 'spot-7', eje: [20, -40], dir: N }, // Bravo
  // Sobre el EJE de Reforma, mordiendo al sur — como manda la convención de
  // arriba (antes el eje estaba en el fondo y la marca caía a media calle).
  // En x=-43.5 y no en -46: el fondo de la bahía rozaba el pavimento de la
  // Avenida Curva y su plataforma invadía ese arroyo.
  { id: 'spot-8', eje: [-43.5, -70], dir: S }, // Reforma
  { id: 'spot-9', eje: [-45, -30], dir: S }, // Zaragoza
  { id: 'spot-10', eje: [8, -70], dir: E }, // Corregidora
  // La toma de agua: bahía propia sobre Independencia, a una cuadra de la
  // glorieta. La pipa se detiene en la calle y la manguera alcanza.
  { id: 'toma', eje: [66, 18], dir: S },
  /*
   * Al fondo del retorno Cerro, tras la angostura: el cliente al que la
   * grandota NO llega (sección 3 de la Fase 2). Va al final para no mover el
   * `tipo` de los diez spots de siempre, que se asigna por índice.
   *
   * La mordida abre al norte a propósito: es el único rincón del mapa a más
   * del radio de entrega (12 m) de toda calle por la que pase la grandota —
   * ni parándose en la Curva del Cerro se le puede entregar por encima de la
   * barda. El test lo verifica con el flood por modelo.
   */
  { id: 'spot-11', eje: [26, -62], dir: N },
]

/**
 * Locales y domicilios, anclados al EJE de su calle y no por coordenada.
 * `layout.ts` avanza en `dir` hasta salir del pavimento y de ahí saca la
 * puerta (sobre la banqueta) y el centro del edificio (dentro de la manzana).
 *
 * Colocarlos a ojo no funciona: basta mover una calle 2 m para que el local
 * quede a media calle o el domicilio dentro de una barda, y con radios de
 * detección euclidianos eso no se ve — simplemente deja de poderse entregar.
 */
export type Frente = {
  id: string
  /** Punto sobre el eje de la calle a la que da. */
  eje: Punto
  /** Hacia dónde está la manzana. Unitario. */
  dir: Punto
  /** Metros extra de retiro. Para frentes en curva, donde una caja alineada
   *  a los ejes se asoma a la calle por las esquinas. */
  retiro?: number
}

export const LOCALES_TRAZA: (Frente & { name: string; color: string })[] = [
  // Dos dan a callejón peatonal: el pedido se toma a pie, así que conocer el
  // atajo te ahorra la vuelta manejando.
  { id: 'local-1', name: 'Local 1', color: '#d94f4f', eje: [33, 70], dir: N }, // c-barda
  { id: 'local-2', name: 'Local 2', color: '#e0a33a', eje: [-16, -40], dir: N }, // Bravo
  { id: 'local-3', name: 'Local 3', color: '#3ec98a', eje: [21.6, -18], dir: O, retiro: 1 }, // c-kiosco
  { id: 'local-4', name: 'Local 4', color: '#4d8fe0', eje: [76, 18], dir: S }, // Independencia
  { id: 'local-5', name: 'Local 5', color: '#b06fd6', eje: [-86, 18], dir: N }, // Morelos
  {
    id: 'local-6', name: 'Local 6', color: '#e07a3a',
    // De frente a la Curva del Cerro, sobre el radio que va a la esquina.
    eje: [92 - 55 * Math.SQRT1_2, -92 + 55 * Math.SQRT1_2],
    dir: [Math.SQRT1_2, -Math.SQRT1_2],
    retiro: 3,
  },
]

/**
 * EL TALLER (Fase 2, sección 2). Un lugar físico y no un menú: llegas
 * manejando, y eso te obliga a decidir cuándo vale la pena interrumpir la
 * jornada para ir. Comprar deja de ser gratis y se vuelve parte de planear.
 *
 * Va en el suroeste, sobre Aldama: lejos de la toma de agua y lejos de la
 * glorieta, para que ir sea un desvío de verdad y no algo que pasa solo.
 */
export const TALLER: Frente & { nombre: string; sx: number; sz: number } = {
  id: 'taller',
  nombre: 'Taller',
  eje: [-62, 58],
  dir: E,
  sx: 14,
  sz: 12,
}

/**
 * LOS HITOS: las cuatro construcciones que sobresalen.
 *
 * La colonia es de una y dos plantas a propósito, para que se pueda ver por
 * encima y uno se ubique sin minimapa. Estas cuatro son la excepción y por eso
 * sirven: repartidas en las cuatro zonas, se ven desde lejos y contestan
 * «¿dónde estoy?» de un vistazo. Si hubiera diez, dejarían de contestar nada.
 *
 * Se anclan al eje de su calle como los locales, así que no hay manera de
 * plantar una torre a media avenida.
 */
export type Hito = Frente & {
  nombre: string
  /** Huella en metros. */
  sx: number
  sz: number
  altura: number
  color: string
  /** Lo que remata la construcción: el tinaco sobre su torre, la espadaña
   *  sobre el campanario. Va centrado encima de la base. */
  remate?: { sx: number; sz: number; altura: number; color: string }
}

export const HITOS: Hito[] = [
  {
    id: 'iglesia',
    nombre: 'La parroquia',
    // A media colonia y sobre Morelos: es la referencia que se ve desde las
    // cuatro esquinas del mapa.
    eje: [-6, 18],
    dir: N,
    sx: 7,
    sz: 7,
    altura: 15,
    color: '#c9bfa6',
    remate: { sx: 3, sz: 3, altura: 5, color: '#a8987a' },
  },
  {
    id: 'tinaco',
    nombre: 'El tinaco elevado',
    // Noroeste, sobre Reforma: la esquina más lejana del mapa necesitaba algo.
    eje: [-70, -70],
    dir: N,
    sx: 4,
    sz: 4,
    altura: 12,
    color: '#8d9099',
    // El tanque es más ancho que su torre y vuela sobre la banqueta: así son
    // los tinacos elevados de verdad, y a 12 m de altura no le estorba a nadie.
    remate: { sx: 6.5, sz: 6.5, altura: 3.5, color: '#4d8fbf' },
  },
  {
    id: 'bodega',
    nombre: 'La bodega',
    // Norte, sobre Corregidora: ancha y sin gracia, se reconoce por la silueta.
    eje: [8, -83],
    dir: E,
    retiro: 1,
    sx: 16,
    sz: 12,
    altura: 9,
    color: '#9a7f6b',
  },
  {
    id: 'escuela',
    nombre: 'La escuela',
    // Sur, sobre Hidalgo, que es la calle que cruza el mapa entero.
    // A la altura de z=68 y no más al sur: el Bulevar viene curvando y a
    // partir de ahí la manzana se angosta.
    eje: [-30, 68],
    dir: O,
    retiro: 0.5,
    sx: 14,
    sz: 10,
    altura: 8,
    color: '#b06f6f',
  },
]

/**
 * Dónde se ENTREGA el agua de cada cliente fijo. El pedido se consigue en el
 * negocio y el agua se entrega en la casa u obra, siempre lejos y siempre
 * sobre calle por la que quepa la pipa: eso es lo que le da sentido a planear
 * la ruta.
 */
export const DOMICILIOS_TRAZA: Frente[] = [
  { id: 'local-1', eje: [10, -40], dir: S }, // Bravo, al norte
  { id: 'local-2', eje: [-12, 70], dir: E }, // Ocampo, al sur
  { id: 'local-3', eje: [ANILLO, 40], dir: O }, // anillo este
  { id: 'local-4', eje: [-ANILLO, -30], dir: E }, // anillo oeste
  { id: 'local-5', eje: [30, -ANILLO], dir: S }, // anillo norte
  { id: 'local-6', eje: [-62, 50], dir: O }, // Aldama, al suroeste
]

/** Centro del rectángulo que se carva para una bahía. */
export const centroBahia = (b: Bahia): Punto => [
  b.eje[0] + (b.dir[0] * BAHIA_FONDO) / 2,
  b.eje[1] + (b.dir[1] * BAHIA_FONDO) / 2,
]

/** Dónde se para el cliente (o la toma) dentro de la bahía. */
export const marcaBahia = (b: Bahia): Punto => [
  b.eje[0] + b.dir[0] * BAHIA_MARCA,
  b.eje[1] + b.dir[1] * BAHIA_MARCA,
]

/**
 * La glorieta es el ÚNICO lugar donde se permite espacio abierto: rodear la
 * isla es la gracia. El test de «nada de campo traviesa» la exceptúa.
 */
export const PLAZAS: { c: Punto; r: number }[] = [
  { c: GLORIETA.c, r: GLORIETA.rExt + 2 },
]
