import { useEffect, useRef } from 'react'
import { useGameStore } from '../state/gameStore'

/**
 * Nivel del tanque. Azul agua, para distinguirse de un vistazo de la barra de
 * temperatura, que comparte tamaño y posición.
 */
export function TankGauge() {
  const fillRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let raf = 0
    const tick = () => {
      const { fillLevel } = useGameStore.getState().vehicle
      if (fillRef.current) {
        fillRef.current.style.transform = `scaleX(${fillLevel})`
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div className="hud-bar tank-gauge">
      <div ref={fillRef} className="hud-bar-fill" />
    </div>
  )
}
