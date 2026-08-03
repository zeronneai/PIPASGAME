import { useEffect, useRef } from 'react'
import { useGameStore } from '../state/gameStore'

/**
 * Temperatura del motor. Mismo patrón que las demás barras: rAF +
 * getState() y escribir estilos directo, cero re-renders.
 *
 * Es la última del bloque a propósito: queda pegada al botón de la segunda,
 * que es lo que la sube.
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
    <div ref={wrapRef} className="hud-bar temp-gauge">
      <div ref={fillRef} className="hud-bar-fill" />
    </div>
  )
}
