import { useEffect, useRef } from 'react'
import { useGameStore } from '../state/gameStore'

/**
 * Velocímetro. Mismo patrón que las barras: rAF + getState() y escribir
 * textContent directo, cero re-renders.
 *
 * Muestra la magnitud, sin signo: en reversa marca la velocidad y no un
 * número negativo, que no dice nada.
 */
export function Speedometer() {
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    let raf = 0
    let ultimo = -1
    const tick = () => {
      const kmh = Math.round(Math.abs(useGameStore.getState().vehicle.speed) * 3.6)
      // Solo toca el DOM cuando el número cambia de verdad
      if (kmh !== ultimo && ref.current) {
        ref.current.textContent = String(kmh)
        ultimo = kmh
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <p className="speedometer">
      <span ref={ref}>0</span>
      <span className="speedometer-unit">km/h</span>
    </p>
  )
}
