import { useGameStore } from '../state/gameStore'

/**
 * ANDAMIO DEL PASO 8. Alterna entre ir a pie y manejar sin la mecánica real
 * de subir y bajar: no esconde al personaje, no hay transición de cámara ni
 * detección de proximidad.
 *
 * El Paso 8 borra este botón y deja el mismo `setMode` colgado del botón de
 * contexto, cuando haya una zona de detección en la puerta de la pipa.
 */
export function ModeToggle() {
  const mode = useGameStore((s) => s.mode)
  const setMode = useGameStore((s) => s.setMode)

  return (
    <button
      className="mode-toggle"
      onClick={() => setMode(mode === 'ON_FOOT' ? 'DRIVING' : 'ON_FOOT')}
    >
      {mode === 'ON_FOOT' ? 'Manejar' : 'Bajar'}
    </button>
  )
}
