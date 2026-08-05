import { useEffect, useReducer } from 'react'
import { useGameStore } from '../state/gameStore'
import { cooldownRestante } from '../game/systems/acceptance'

/**
 * Botón de contexto (sección 4): aparece solo cuando hay algo cerca y cambia
 * de etiqueta — «Subir», «Bajar», «Ofrecer servicio».
 *
 * El texto viene con la acción, no de una tabla aquí: cada Interactable trae
 * su propio prompt, así que agregar cosas interactuables no toca este archivo.
 *
 * Con un cliente EN ENFRIAMIENTO el botón lo dice antes de dejarte tocar en
 * balde: «Vuelve al rato», deshabilitado. El restante se recalcula con un
 * tick de 1 s porque el reloj de la jornada se muta (no hay suscripción).
 *
 * Quién decide si aparece es useInteractionScan, y quién ejecuta la acción es
 * Interaction.tsx dentro del Canvas: desde el DOM no se puede tocar Rapier.
 */
export function ContextButton() {
  const action = useGameStore((s) => s.contextAction)
  const request = useGameStore((s) => s.requestContextAction)
  const [, tick] = useReducer((n: number) => n + 1, 0)

  const esServicio = action?.kind === 'SERVICE'
  useEffect(() => {
    if (!esServicio) return
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [esServicio])

  if (!action) return null

  let enfriadoMin = 0
  if (action.kind === 'SERVICE' && action.targetId) {
    const s = useGameStore.getState()
    const h = s.economy.clientHistory[action.targetId]
    if (h) enfriadoMin = cooldownRestante(h, s.economy.day, s.clock.daySeconds)
  }
  const enfriado = enfriadoMin > 0

  return (
    <button
      className={`context-button${enfriado ? ' context-button--espera' : ''}`}
      disabled={enfriado}
      // onPointerDown y no onClick: en móvil el click llega tarde y un botón
      // de acción que responde tarde se siente roto.
      onPointerDown={enfriado ? undefined : request}
    >
      {enfriado ? `Vuelve al rato (${Math.ceil(enfriadoMin)} min)` : action.label}
    </button>
  )
}
