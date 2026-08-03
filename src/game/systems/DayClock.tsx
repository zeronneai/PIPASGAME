import { useFrame } from '@react-three/fiber'
import { useGameStore } from '../../state/gameStore'
import { jornadaTerminada } from './jornada'

/**
 * Avanza el reloj de la jornada (Paso 3) y dispara su cierre (Paso 8).
 * Segundos reales acumulados; la hora del día se deriva con horaDelDia().
 *
 * Con el resumen en pantalla el mundo espera: el reloj no corre. Y el
 * cierre respeta lo que está a medias — una carga en el pozo o una entrega
 * con la manguera conectada terminan primero; el resumen llega al soltar.
 *
 * Corre solo mientras la escena renderiza: con la app en segundo plano el
 * rAF se congela y el día también, que es lo justo en un juego de reloj.
 */
export function DayClock() {
  useFrame((_state, delta) => {
    const s = useGameStore.getState()
    if (s.summary) return
    s.clock.daySeconds += delta
    if (
      jornadaTerminada(s.clock.daySeconds) &&
      !s.delivery &&
      !s.refill.active
    ) {
      s.endDay()
    }
  })

  return null
}
