import { useEffect, useRef } from 'react'
import { useInputStore } from '../state/inputStore'
import { useGameStore } from '../state/gameStore'

/**
 * Overlay de debug: valores del joystick, delta de cámara con sus
 * pointerId, y estado del jugador. Lee con getState() dentro de un rAF y
 * escribe textContent directo — cero re-renders de React.
 */
export function DebugOverlay() {
  const ref = useRef<HTMLPreElement>(null)

  useEffect(() => {
    let raf = 0
    const tick = () => {
      const { move, look, pointers } = useInputStore.getState()
      const player = useGameStore.getState().player
      if (ref.current) {
        const estado = player.exhausted
          ? 'exhausto'
          : player.running
            ? 'corriendo'
            : 'caminando'
        ref.current.textContent =
          `joystick  x ${move.x.toFixed(2)}  y ${move.y.toFixed(2)}  ptr ${pointers.move ?? '—'}\n` +
          `cámara Δ  x ${look.x.toFixed(0)}  y ${look.y.toFixed(0)}  ptr ${pointers.look ?? '—'}\n` +
          `jugador  ${player.speed.toFixed(1)} m/s  resist ${Math.round(player.stamina * 100)}%  ${estado}`
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return <pre ref={ref} className="debug-overlay" />
}
