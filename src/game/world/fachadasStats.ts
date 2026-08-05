/**
 * El costo de la colonia construida, publicado para el overlay de debug.
 *
 * Módulo mutable y no estado de React por la misma razón que `renderStats`:
 * lo escribe la construcción de la malla una sola vez y lo lee un rAF, y
 * ninguno de los dos tiene por qué provocar un render.
 */
export const fachadasStats = {
  lotes: 0,
  frentesALaCalle: 0,
  tinacos: 0,
  locales: 0,
  triangulos: 0,
  vertices: 0,
}
