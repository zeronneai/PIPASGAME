import { useGameStore } from '../state/gameStore'

const ETIQUETA = {
  BOARD: 'Subir',
  EXIT: 'Bajar',
} as const

/**
 * Botón de contexto (sección 4): aparece solo cuando hay algo cerca y cambia
 * de etiqueta. Hoy solo sube y baja de la pipa; el Paso 9 le agrega los
 * locales con «Ofrecer servicio».
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
      {ETIQUETA[action]}
    </button>
  )
}
