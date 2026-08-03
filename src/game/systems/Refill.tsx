import { useFrame } from '@react-three/fiber'
import { balance } from '../balance'
import { tuning } from '../tuning'
import { useGameStore } from '../../state/gameStore'
import { WATER_SOURCE } from '../world/layout'
import { refillTick } from './economy'

/**
 * Tick de la carga de agua en el pozo (Paso 2 de Fase 1).
 *
 * Mientras la sesión está abierta, cada frame mete litros y acumula costo en
 * refill (que se liquida al cortar), y actualiza vehicle.fillLevel EN VIVO:
 * eso es lo que hace que la masa y el chapoteo respondan mientras cae el
 * agua, porque ya estaban conectados a fillLevel desde la Fase 0.
 *
 * La sesión se corta sola por tres razones: tanque lleno, dinero agotado, o
 * la pipa se alejó de la toma (la manguera no da para llevársela puesta).
 */
export function Refill() {
  useFrame((_state, delta) => {
    const s = useGameStore.getState()
    const r = s.refill
    if (!r.active) return

    const v = s.vehicle.pos
    const [px, py, pz] = WATER_SOURCE.pos
    const d = Math.hypot(px - v.x, py - v.y, pz - v.z)
    // +2 m de holgura sobre el radio de arranque: sin histéresis, cargar
    // parado justo en la orilla del radio se cortaría solo por el bamboleo.
    if (d > tuning.interaction.pozoRadius + 2) {
      s.stopRefill()
      return
    }

    // Litros y dinero EFECTIVOS: lo del tanque más lo de la sesión, que aún
    // no se liquida. Sin esto, la carga no sabría cuándo topar.
    const t = refillTick(
      s.economy.liters + r.litersLoaded,
      s.economy.money - r.cost,
      delta,
    )
    r.litersLoaded += t.added
    r.cost += t.cost
    s.vehicle.fillLevel =
      (s.economy.liters + r.litersLoaded) / balance.tank.capacity

    if (t.stop) s.stopRefill()
  })

  return null
}
