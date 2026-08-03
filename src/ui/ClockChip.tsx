import { useEffect, useRef } from 'react'
import { formatHora, horaDelDia } from '../game/systems/acceptance'
import { useGameStore } from '../state/gameStore'

/**
 * La hora del día, arriba al centro (Paso 3). Sin ella la aceptación por
 * horario se sentiría aleatoria: el jugador necesita PODER saber que la
 * fonda ya cerró. El reloj avanza cada frame, así que se escribe directo al
 * DOM en un rAF, como los medidores.
 */
export function ClockChip() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let raf = 0
    let ultimo = ''
    const tick = () => {
      const hora = formatHora(horaDelDia(useGameStore.getState().clock.daySeconds))
      // Cambia una vez por minuto de juego: no vale la pena tocar el DOM antes.
      if (ref.current && hora !== ultimo) {
        ref.current.textContent = hora
        ultimo = hora
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return <div ref={ref} className="clock-chip" />
}
