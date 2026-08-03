/*
 * Contadores del renderer del último frame. Los escribe <RenderStats/> desde
 * dentro del Canvas y los lee el DebugOverlay desde el DOM.
 *
 * Objeto mutable a propósito, no un store suscrito: cambia 60 veces por
 * segundo y suscribir React a esto sería exactamente lo que prohíbe la
 * sección 5 del documento.
 */
export const renderStats = {
  calls: 0,
  triangles: 0,
}
