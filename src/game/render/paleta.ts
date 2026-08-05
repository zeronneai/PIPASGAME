/*
 * LA PALETA DE PIPERO (Fase 3, sección 1).
 *
 * Estilizado con toque de rótulo mexicano: saturada y cálida, con el asfalto
 * y el cielo como lo ÚNICO desaturado, para que todo lo demás resalte. Esa
 * asimetría es la regla que hace que la paleta funcione — si el suelo también
 * compite, nada destaca y la colonia se vuelve ruido.
 *
 * Esta es la fuente única de color del mundo 3D. `theme.css` lleva los mismos
 * seis colores como custom properties para la UI, escritos a mano y no
 * inyectados: la UI y el mundo comparten identidad, no runtime, y sincronizar
 * un puñado de hex al ojo cuesta menos que un puente entre CSS y WebGL.
 *
 * Nada de aquí es textura ni modelo — el Paso 1 es solo materiales y luz. Los
 * colores por vértice de los edificios llegan en el Paso 2.
 */

/**
 * Los seis del rótulo. Son los que pinta la gente: cal en la barda, ocre y
 * terracota en las fachadas, añil en los herrajes, limón y rosa en los
 * anuncios. El rosa y el limón son los de máximo contraste y por eso se usan
 * como acento, nunca como color de masa.
 */
export const PALETA = {
  /** La cal encima del bloque. Blanco roto y CÁLIDO: un blanco puro se ve
   *  digital y delata que no hay textura debajo. */
  cal: '#f4efe2',
  ocre: '#d9a441',
  terracota: '#c05a38',
  anil: '#2e4a7d',
  limon: '#9fc131',
  /** Rosa mexicano. El acento de máximo contraste; en dosis chicas. */
  rosa: '#d93a82',

  /* --- Lo desaturado, a propósito --- */

  /** El asfalto. Gris con una pizca de tierra, nunca neutro puro. */
  asfalto: '#4e4b4a',
  /** El concreto de banquetas y guarniciones. */
  concreto: '#a49c90',
  /** Cielo: del cenit al horizonte. El horizonte es el más cálido y es el
   *  color al que la niebla funde la geometría lejana. */
  cieloAlto: '#8fa8bd',
  cieloBajo: '#e0d5c2',

  /* --- Neutros de apoyo --- */

  /** Sombra pintada: no es negro, es el añil rebajado. Un negro real mata la
   *  calidez de todo lo que toca. */
  sombra: '#3b3a44',
  /** Metal viejo: rejas, postes, herrería. */
  metal: '#6e6a66',
  /** Cromo y vidrio, para la pipa. */
  cromo: '#dfe3e6',
  vidrio: '#33454f',
} as const

export type ColorPaleta = keyof typeof PALETA

/**
 * DÓNDE VA CADA COLOR.
 *
 * La paleta dice qué colores existen; esto dice qué es cada cosa. Separarlos
 * permite repintar la colonia entera moviendo un renglón de aquí, sin ir a
 * buscar hex sueltos por los componentes — que es exactamente el collage que
 * la sección 7 del documento advierte que hay que evitar.
 */
export const MUNDO = {
  asfalto: PALETA.asfalto,
  banqueta: PALETA.concreto,
  /** Las bardas de bloque con cal encima: la textura del juego. */
  barda: PALETA.cal,
  /** Los topes, pintados de amarillo como en la calle de verdad. */
  tope: PALETA.ocre,
  /** El camellón de la glorieta. */
  isla: PALETA.limon,
  kiosco: PALETA.terracota,
  taller: PALETA.anil,
  tallerLetrero: PALETA.ocre,
  /** La toma de agua. El azul es lectura, no decoración: es lo que buscas. */
  tomaBase: PALETA.concreto,
  tomaTubo: PALETA.anil,
  tomaValvula: PALETA.limon,
} as const

/**
 * Los edificios genéricos de la colonia. La variación de la Fase 2 era en
 * escala de grises; aquí se vuelve una tira de fachadas pintadas. Sigue
 * siendo color plano por instancia —cero texturas, cero draw calls extra—,
 * que es justo lo que el documento pide para el grueso de la colonia.
 */
export const FACHADAS: string[] = [
  PALETA.cal,
  '#e8dcc4', // cal amarillenta
  PALETA.ocre,
  '#c98f4e', // ocre quemado
  PALETA.terracota,
  '#b08968', // tierra
  '#7d9bb5', // añil lavado por el sol
  '#cfc4ae', // cal sucia
]

/** El color de una fachada a partir de un índice estable (la posición del
 *  edificio en el layout). Determinista a propósito: la colonia se ve igual
 *  en cada carga, y eso es lo que la vuelve un lugar y no un patrón nuevo
 *  cada vez. */
export function colorFachada(i: number): string {
  return FACHADAS[i % FACHADAS.length]
}
