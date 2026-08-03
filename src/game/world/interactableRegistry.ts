import { tuning } from '../tuning'

/*
 * Registro de zonas interactuables.
 *
 * Es un registro y no una lista fija dentro del escaneo porque la idea es que
 * cualquier cosa futura —la toma de agua, una misión, un cliente— se vuelva
 * interactuable soltando un <Interactable> en la escena, sin tocar el sistema
 * de proximidad.
 */

export type InteractableEntry = {
  id: string
  /** Texto que muestra el botón de contexto. */
  label: string
  pos: { x: number; y: number; z: number }
  /**
   * Radio propio en metros. Si se omite se usa el de tuning, que es lo que
   * permite moverlo en vivo desde leva para los seis locales a la vez.
   */
  radius?: number
  onInteract?: () => void
}

const registro = new Map<string, InteractableEntry>()

const radioDe = (e: InteractableEntry) =>
  e.radius ?? tuning.interaction.localRadius

export function registerInteractable(entry: InteractableEntry) {
  registro.set(entry.id, entry)
}

export function unregisterInteractable(id: string) {
  registro.delete(id)
}

export function getInteractable(id: string) {
  return registro.get(id) ?? null
}

/** El más cercano dentro de su radio, o null. Lo usa useInteractionScan. */
export function nearestInteractable(
  x: number,
  y: number,
  z: number,
): InteractableEntry | null {
  let mejor: InteractableEntry | null = null
  let mejorDist = Infinity
  for (const e of registro.values()) {
    const d = Math.hypot(e.pos.x - x, e.pos.y - y, e.pos.z - z)
    if (d < radioDe(e) && d < mejorDist) {
      mejor = e
      mejorDist = d
    }
  }
  return mejor
}
