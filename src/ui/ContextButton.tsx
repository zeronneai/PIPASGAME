import { useGameStore } from '../state/gameStore'

/**
 * Botón de contexto (sección 4): aparece solo cuando hay algo cerca y cambia
 * de etiqueta — «Subir», «Bajar», «Ofrecer servicio».
 *
 * El texto viene con la acción, no de una tabla aquí: cada Interactable trae
 * su propio prompt, así que agregar cosas interactuables no toca este archivo.
 *
 * Quién decide si aparece es useInteractionScan, y quién ejecuta la acción es
 * Interaction.tsx dentro del Canvas: desde el DOM no se puede tocar Rapier.
 */
export function ContextButton() {
  const action = useGameStore((s) => s.contextAction)
  const request = useGameStore((s) => s.requestContextAction)

  if (!action) return null

  return (
    <button
      className="context-button"
      // onPointerDown y no onClick: en móvil el click llega tarde y un botón
      // de acción que responde tarde se siente roto.
      onPointerDown={request}
    >
      {action.label}
    </button>
  )
}
