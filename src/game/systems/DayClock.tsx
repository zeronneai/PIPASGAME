import { useFrame } from '@react-three/fiber'
import { useGameStore } from '../../state/gameStore'

/**
 * Avanza el reloj de la jornada (Paso 3). Segundos reales acumulados; la
 * hora del día se deriva con horaDelDia() donde se necesite.
 *
 * Corre solo mientras la escena renderiza: con la app en segundo plano el
 * rAF se congela y el día también, que es lo justo en un juego de reloj.
 * El fin de la jornada (y su pantalla de resumen) es del Paso 8.
 */
export function DayClock() {
  useFrame((_state, delta) => {
    useGameStore.getState().clock.daySeconds += delta
  })

  return null
}
