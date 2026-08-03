import { balance } from '../game/balance'
import { useGameStore } from '../state/gameStore'

/**
 * Fundido a negro del rescate por caída. Siempre montado: solo cambia la
 * opacidad, y la transición de CSS hace el trabajo — la mitad de la pausa
 * para oscurecer, la otra mitad para aclarar (el ritmo lo lleva Rescue.tsx).
 */
export function RescueFade() {
  const on = useGameStore((s) => s.rescueFade)

  return (
    <div
      className="rescue-fade"
      style={{
        opacity: on ? 1 : 0,
        transitionDuration: `${balance.rescate.pausaSegundos / 2}s`,
      }}
    />
  )
}
