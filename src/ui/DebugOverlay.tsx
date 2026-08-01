import { useEffect, useRef } from 'react'
import { useInputStore } from '../state/inputStore'

/**
 * Overlay de debug del input: valores del joystick, delta acumulado de
 * cámara y pointerId activo de cada zona. Lee con getState() dentro de un
 * rAF y escribe textContent directo — cero re-renders de React.
 */
export function DebugOverlay() {
  const ref = useRef<HTMLPreElement>(null)

  useEffect(() => {
    let raf = 0
    const tick = () => {
      const { move, look, pointers } = useInputStore.getState()
      if (ref.current) {
        ref.current.textContent =
          `joystick  x ${move.x.toFixed(2)}  y ${move.y.toFixed(2)}  ptr ${pointers.move ?? '—'}\n` +
          `cámara Δ  x ${look.x.toFixed(0)}  y ${look.y.toFixed(0)}  ptr ${pointers.look ?? '—'}`
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return <pre ref={ref} className="debug-overlay" />
}
