import { useGameStore } from '../state/gameStore'
import { Speedometer } from './Speedometer'
import { StaminaBar } from './StaminaBar'
import { TankGauge } from './TankGauge'
import { TempGauge } from './TempGauge'

/**
 * HUD mínimo (Paso 10): solo lo que se lee, no lo que se toca.
 *
 * Los controles —joystick, volante, pedales, segunda, botón de contexto—
 * viven aparte. Esta separación es la que permite cambiar de modo sin que se
 * mezclen: a pie se lee la resistencia, manejando se lee velocidad, tanque y
 * temperatura.
 *
 * Todo va en DOM sobre el canvas, nunca dentro de la escena 3D, y ninguno
 * ocupa el centro de la pantalla.
 */
export function HUD() {
  // El modo cambia poco: se puede suscribir sin costo por frame.
  const driving = useGameStore((s) => s.mode === 'DRIVING')
  // El termómetro solo existe con la segunda ganada (Paso 6): aparece con el
  // desbloqueo, y es parte de la recompensa.
  const conSegunda = useGameStore((s) => s.economy.segundaDesbloqueada)

  if (!driving) return <StaminaBar />

  return (
    <div className="hud-drive">
      <Speedometer />
      <TankGauge />
      {conSegunda && <TempGauge />}
    </div>
  )
}
