import { useEffect, useRef } from 'react'
import { useGameStore } from '../state/gameStore'

/**
 * Barra de resistencia: visible solo cuando no está llena. Se actualiza
 * con rAF + getState() escribiendo estilos directo — cero re-renders.
 */
export function StaminaBar() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const fillRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let raf = 0
    const tick = () => {
      const { stamina, exhausted } = useGameStore.getState().player
      if (wrapRef.current && fillRef.current) {
        wrapRef.current.style.opacity = stamina >= 1 ? '0' : '1'
        fillRef.current.style.transform = `scaleX(${stamina})`
        fillRef.current.classList.toggle('exhausted', exhausted)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div ref={wrapRef} className="stamina-bar" style={{ opacity: 0 }}>
      <div ref={fillRef} className="stamina-bar-fill" />
    </div>
  )
}
