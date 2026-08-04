/*
 * Blindaje contra los gestos del sistema en iOS (sección 3 del documento de
 * Fase 0: «hay que prevenir el zoom por doble tap, el pull-to-refresh y la
 * selección de texto»).
 *
 * El CSS hace la mitad del trabajo; esta es la otra mitad, la que el CSS no
 * puede hacer:
 *
 *   - El pellizco para hacer zoom lo maneja Safari con eventos PROPIETARIOS
 *     (`gesturestart` y compañía) que no son estándar, no aparecen en las
 *     definiciones del DOM y NO los cubre `touch-action: none`.
 *   - El zoom por doble tap se dispara desde el segundo `touchend`, y ahí ya
 *     no hay CSS que valga: hay que cancelarlo a mano.
 *
 * Todo esto importa porque el juego se controla MANTENIENDO el dedo sobre el
 * acelerador y el freno, que es justo lo que iOS interpreta como «este señor
 * quiere seleccionar texto» o «quiere hacer zoom».
 */

/** Dos toques más juntos que esto son un doble tap, no dos toques. */
const DOBLE_TAP_MS = 350
/** Y además tienen que caer casi en el mismo punto, en píxeles CSS. */
const DOBLE_TAP_PX = 40

/** Dónde SÍ se escribe: ahí no se estorba ni al foco ni al teclado. */
function esCampo(destino: EventTarget | null) {
  const el = destino as HTMLElement | null
  if (!el?.tagName) return false
  return (
    el.tagName === 'INPUT' ||
    el.tagName === 'TEXTAREA' ||
    el.tagName === 'SELECT' ||
    el.isContentEditable
  )
}

/**
 * Se llama una vez, antes del render. Devuelve la función que lo deshace,
 * por si algún día esto vive dentro de un efecto.
 */
export function blindarGestos(): () => void {
  const cancelar = (e: Event) => {
    if (esCampo(e.target)) return
    e.preventDefault()
  }

  /*
   * Zoom por pellizco. Los tres eventos van juntos: prevenir solo el primero
   * deja a Safari a medio gesto y la página se queda con la escala cambiada.
   * Se registran por nombre en un arreglo porque TypeScript no los conoce —
   * son de WebKit, no del estándar.
   */
  const gestos = ['gesturestart', 'gesturechange', 'gestureend']
  for (const tipo of gestos) {
    document.addEventListener(tipo, cancelar, { passive: false })
  }

  /*
   * Zoom por doble tap. `preventDefault` sobre el segundo `touchend` es lo que
   * lo mata.
   *
   * Se exige cerca EN TIEMPO y EN PANTALLA, que es lo que iOS considera un
   * doble tap. Cancelar por tiempo nada más se llevaría entre las patas dos
   * toques rápidos en botones DISTINTOS —soltar el acelerador y abrir el
   * panel, por ejemplo—, y ahí el segundo toque es legítimo.
   */
  let ultimoTap = 0
  let ultimoX = 0
  let ultimoY = 0
  const alSoltar = (e: TouchEvent) => {
    if (esCampo(e.target)) return
    const t = e.changedTouches[0]
    if (!t) return
    const cerca = Math.hypot(t.clientX - ultimoX, t.clientY - ultimoY) < DOBLE_TAP_PX
    if (e.timeStamp - ultimoTap < DOBLE_TAP_MS && cerca) e.preventDefault()
    ultimoTap = e.timeStamp
    ultimoX = t.clientX
    ultimoY = t.clientY
  }
  document.addEventListener('touchend', alSoltar, { passive: false })

  /*
   * La lupa y el menú contextual del mantener-presionado. `-webkit-touch-
   * callout: none` los cubre en Safari, pero no en todos los navegadores
   * móviles ni en escritorio, y aquí no hay nada que valga la pena copiar.
   */
  document.addEventListener('contextmenu', cancelar)
  document.addEventListener('selectstart', cancelar)

  return () => {
    for (const tipo of gestos) document.removeEventListener(tipo, cancelar)
    document.removeEventListener('touchend', alSoltar)
    document.removeEventListener('contextmenu', cancelar)
    document.removeEventListener('selectstart', cancelar)
  }
}
