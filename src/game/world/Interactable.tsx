import { useEffect } from 'react'
import {
  registerInteractable,
  unregisterInteractable,
} from './interactableRegistry'

/**
 * Zona con la que se puede interactuar: radio de detección y texto de prompt.
 *
 * No dibuja nada. Solo se apunta al registro mientras está montado, y el
 * escaneo de proximidad lo encuentra desde ahí.
 */
export function Interactable({
  id,
  label,
  position,
  radius,
  onInteract,
}: {
  id: string
  label: string
  position: [number, number, number]
  /** Si se omite, se usa tuning.interaction.localRadius. */
  radius?: number
  onInteract?: () => void
}) {
  const [x, y, z] = position

  useEffect(() => {
    registerInteractable({ id, label, pos: { x, y, z }, radius, onInteract })
    return () => unregisterInteractable(id)
  }, [id, label, x, y, z, radius, onInteract])

  return null
}
