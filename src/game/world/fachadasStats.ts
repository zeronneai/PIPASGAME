/**
 * El costo de la colonia construida, publicado para el overlay de debug.
 *
 * Módulo mutable y no estado de React por la misma razón que `renderStats`:
 * lo escribe la construcción de la malla una sola vez y lo lee un rAF, y
 * ninguno de los dos tiene por qué provocar un render.
 */
export const fachadasStats = {
  lotes: 0,
  /** Predios de verdad: cajas agrupadas por etiqueta de lote. */
  predios: 0,
  /** Paños que recibieron fachada completa (frente ≥ 4 m). */
  fachadas: 0,
  /** Mediana del frente de esos paños. Es la cifra que dice si la colonia se
   *  ve de casas o de columnas. */
  frenteMediano: 0,
  tinacos: 0,
  locales: 0,
  bolardos: 0,
  glorieta: 0,
  triangulos: 0,
  vertices: 0,
}
