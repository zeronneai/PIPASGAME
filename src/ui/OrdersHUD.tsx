import { useEffect, useRef } from 'react'
import { getCliente } from '../game/systems/clients'
import { orderClock } from '../game/systems/economy'
import { locales } from '../game/world/layout'
import { useGameStore } from '../state/gameStore'

/*
 * Lista compacta de pedidos activos (Paso 4), bajo la barra de estado.
 * Cada renglón: flecha hacia el cliente, nombre, litros y SU reloj.
 *
 * La lista (qué pedidos hay) es de React: cambia al aceptar o entregar.
 * La flecha, el conteo y el color de estado cambian cada frame, así que van
 * directo al DOM en un rAF sobre refs por pedido, como todos los medidores.
 */

/** Puerta de cada local, que es hacia donde apunta la flecha. */
const DOORS = new Map(locales.map((l) => [l.id, l.door]))

const ESTADO_CLASE = {
  A_TIEMPO: '',
  TARDE: 'tarde',
  MUY_TARDE: 'muytarde',
} as const

/** Minutos → «3:24»; el sobregiro (negativo) se enseña como «+1:07». */
function reloj(minutes: number): string {
  const total = Math.floor(Math.abs(minutes) * 60)
  const m = Math.floor(total / 60)
  const s = String(total % 60).padStart(2, '0')
  return minutes < 0 ? `+${m}:${s}` : `${m}:${s}`
}

type RowRefs = {
  arrow: HTMLSpanElement | null
  clock: HTMLSpanElement | null
  row: HTMLDivElement | null
  /** Última clase de estado aplicada, para no tocar el DOM sin cambio. */
  estado: string
}

export function OrdersHUD() {
  const orders = useGameStore((s) => s.economy.orders)
  const refs = useRef(new Map<string, RowRefs>())

  // Los refs de los hijos corren antes que el del padre: cada callback crea
  // la entrada si aún no existe, en vez de asumir quién llegó primero.
  const entry = (id: string): RowRefs => {
    let r = refs.current.get(id)
    if (!r) {
      r = { arrow: null, clock: null, row: null, estado: '' }
      refs.current.set(id, r)
    }
    return r
  }

  useEffect(() => {
    let raf = 0
    const tick = () => {
      const s = useGameStore.getState()
      const { daySeconds } = s.clock
      const actorPos = s.mode === 'DRIVING' ? s.vehicle.pos : s.player.pos
      const phi = s.camera.phi

      for (const pedido of s.economy.orders) {
        const r = refs.current.get(pedido.id)
        if (!r) continue

        const door = DOORS.get(pedido.clientId)
        if (r.arrow && door) {
          // Ángulo de la vista menos ángulo hacia el cliente: flecha hacia
          // arriba = de frente en pantalla. atan2(x, z), como camera.phi.
          const rot =
            phi - Math.atan2(door[0] - actorPos.x, door[2] - actorPos.z)
          r.arrow.style.transform = `rotate(${(rot * 180) / Math.PI}deg)`
        }

        const c = orderClock(pedido, daySeconds)
        if (r.clock) r.clock.textContent = reloj(c.remainingMinutes)
        const estado = c.warning ? 'alerta' : ESTADO_CLASE[c.puntualidad]
        if (r.row && estado !== r.estado) {
          r.row.className = `order-row perfil-borde-${pedido.perfil}${estado ? ` ${estado}` : ''}`
          r.estado = estado
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  if (orders.length === 0) return null
  return (
    <div className="orders-hud">
      {orders.map((pedido) => (
        <div
          key={pedido.id}
          className={`order-row perfil-borde-${pedido.perfil}`}
          ref={(el) => {
            entry(pedido.id).row = el
            if (!el) refs.current.delete(pedido.id)
          }}
        >
          {/* ▲ apunta hacia arriba en reposo: rotación 0 = de frente. */}
          <span
            className="order-arrow"
            ref={(el) => void (entry(pedido.id).arrow = el)}
          >
            ▲
          </span>
          <span className="order-name">
            {getCliente(pedido.clientId)?.name ?? pedido.clientId}
          </span>
          <span className="order-litros">
            {pedido.liters.toLocaleString('es-MX')} L
          </span>
          <span
            className="order-clock"
            ref={(el) => void (entry(pedido.id).clock = el)}
          />
        </div>
      ))}
    </div>
  )
}
