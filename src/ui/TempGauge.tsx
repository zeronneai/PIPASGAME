import { useEffect, useRef } from 'react'
import { useGameStore } from '../state/gameStore'

/**
 * Temperatura del motor. Mismo patrón que StaminaBar: rAF + getState() y
 * escribir estilos directo, cero re-renders.
 *
 * Va justo encima del botón de la segunda para que la causa y el efecto estén
 * pegados: subes la barra con ese botón.
 */
export function TempGauge() {
  const fillRef = useRef<HTMLDivElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let raf = 0
    const tick = () => {
      const { engineTemp, overheated, boostActive } =
        useGameStore.getState().vehicle
      const fill = fillRef.current
      const wrap = wrapRef.current
      if (fill && wrap) {
        fill.style.transform = `scaleX(${engineTemp})`
        // Tres estados y nada más: fría, cerca del tope, fundida.
        fill.classList.toggle('caliente', !overheated && engineTemp > 0.7)
        fill.classList.toggle('fundido', overheated)
        wrap.classList.toggle('activa', boostActive)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div ref={wrapRef} className="temp-gauge">
      <div ref={fillRef} className="temp-gauge-fill" />
    </div>
  )
}
