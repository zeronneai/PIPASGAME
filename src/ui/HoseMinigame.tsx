import { useEffect, useRef, useState } from 'react'
import { balance } from '../game/balance'
import { getCliente } from '../game/systems/clients'
import {
  connectHit,
  flowTick,
  markerPos,
  pressureStep,
  zoneCenter,
} from '../game/systems/hose'
import { useGameStore, type DeliveryState } from '../state/gameStore'

/*
 * El minijuego de la manguera (sección 2.6), todo en DOM sobre el canvas.
 *
 * Dos fases en una tarjeta: CONECTAR (tap con el marcador en la zona) y
 * PRESIÓN (mantener presionado para subir; la banda buena se pasea). La
 * física vive en hose.ts como funciones puras; aquí solo input, rAF y DOM
 * directo — a 60 fps no puede haber un setState por frame.
 *
 * Diez segundos máximo de reloj TOTAL (las dos fases lo comparten): quien
 * no conecta pierde tiempo de surtir, igual que en la calle.
 */

const PUNTUALIDAD_TEXTO = {
  A_TIEMPO: 'a tiempo',
  TARDE: 'tarde',
  MUY_TARDE: 'muy tarde',
} as const

export function HoseMinigame() {
  const delivery = useGameStore((s) => s.delivery)
  if (!delivery) return null
  // key: cada entrega monta su juego de cero; sin estado fantasma entre dos.
  return <Juego key={delivery.pedido.id} delivery={delivery} />
}

function Juego({ delivery }: { delivery: DeliveryState }) {
  const { pedido, puntualidad } = delivery
  // Fase por estado de React: cambia una sola vez y reordena la tarjeta.
  const [fase, setFase] = useState<'CONECTAR' | 'PRESION'>('CONECTAR')

  // Todo lo por-frame va en refs; el rAF lo escribe directo al DOM.
  const sim = useRef({
    t: 0,
    pressure: 0,
    delivered: 0,
    spilled: 0,
    holding: false,
    fase: 'CONECTAR' as 'CONECTAR' | 'PRESION',
  })
  const markerRef = useRef<HTMLDivElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const bandRef = useRef<HTMLDivElement>(null)
  const litrosRef = useRef<HTMLDivElement>(null)
  const derrameRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const s = sim.current
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      s.t += dt
      const e = balance.entrega

      // El reloj total manda sobre las dos fases.
      if (timerRef.current) {
        const restante = Math.max(0, e.maxSeconds - s.t)
        timerRef.current.style.transform = `scaleX(${restante / e.maxSeconds})`
      }
      if (s.t >= e.maxSeconds) {
        const store = useGameStore.getState()
        // Sin una gota entregada no hay nada que cobrar: el pedido sigue.
        if (s.delivered > 0)
          store.finishDelivery({ delivered: s.delivered, spilled: s.spilled })
        else store.abortDelivery(s.spilled)
        return
      }

      if (s.fase === 'CONECTAR') {
        if (markerRef.current)
          markerRef.current.style.left = `${markerPos(s.t) * 100}%`
      } else {
        s.pressure = pressureStep(s.pressure, s.holding, dt)
        const centro = zoneCenter(s.t)
        const { delivered, spilled } = flowTick(
          {
            pressure: s.pressure,
            center: centro,
            dt,
            remaining: pedido.liters - s.delivered,
          },
        )
        s.delivered += delivered
        s.spilled += spilled

        if (barRef.current)
          barRef.current.style.transform = `scaleY(${s.pressure})`
        if (bandRef.current) {
          bandRef.current.style.bottom = `${(centro - balance.entrega.zoneSize / 2) * 100}%`
          bandRef.current.style.height = `${balance.entrega.zoneSize * 100}%`
        }
        if (litrosRef.current)
          litrosRef.current.textContent = `${Math.floor(s.delivered).toLocaleString('es-MX')} / ${pedido.liters.toLocaleString('es-MX')} L`
        if (derrameRef.current) {
          derrameRef.current.textContent =
            s.spilled > 0 ? `derramado ${Math.round(s.spilled)} L` : ''
        }

        if (s.delivered >= pedido.liters) {
          useGameStore
            .getState()
            .finishDelivery({ delivered: s.delivered, spilled: s.spilled })
          return
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // La sim vive fuera de React: el efecto corre una vez por montaje.
  }, [pedido.liters])

  const conectar = () => {
    const s = sim.current
    if (s.fase !== 'CONECTAR') return
    if (connectHit(markerPos(s.t))) {
      s.fase = 'PRESION'
      setFase('PRESION')
    } else {
      // Conexión fallida: fuga fija y el marcador sigue corriendo.
      s.spilled += balance.entrega.badConnectSpill
      cardRef.current?.classList.remove('hose-fallo')
      // Reflow para reiniciar la animación de sacudida si fallas dos veces.
      void cardRef.current?.offsetWidth
      cardRef.current?.classList.add('hose-fallo')
    }
  }

  const cliente = getCliente(pedido.clientId)
  return (
    <div className="offer-backdrop">
      <div ref={cardRef} className="offer-card hose-card">
        <div className="offer-cliente">{cliente?.name ?? pedido.clientId}</div>
        <div className="offer-colonia">
          {pedido.liters.toLocaleString('es-MX')} L ·{' '}
          <span className={`hose-puntualidad ${puntualidad.toLowerCase()}`}>
            {PUNTUALIDAD_TEXTO[puntualidad]}
          </span>
        </div>

        {/* Reloj total del minijuego, siempre a la vista. */}
        <div className="hud-bar hose-timer">
          <div ref={timerRef} className="hud-bar-fill" />
        </div>

        {fase === 'CONECTAR' ? (
          <>
            <div className="hose-instruccion">
              Conecta la manguera: toca con el marcador en la zona
            </div>
            <div className="hose-connect-bar">
              {/* Ancho desde el balance: si la zona se mueve en leva, la
                  siguiente entrega ya se dibuja con el número nuevo. */}
              <div
                className="hose-connect-zone"
                style={{
                  left: `${(0.5 - balance.entrega.connectZoneSize / 2) * 100}%`,
                  width: `${balance.entrega.connectZoneSize * 100}%`,
                }}
              />
              <div ref={markerRef} className="hose-connect-marker" />
            </div>
            <button className="offer-btn offer-si" onPointerDown={conectar}>
              Conectar
            </button>
          </>
        ) : (
          <>
            <div className="hose-instruccion">
              Mantén la presión dentro de la banda
            </div>
            <div className="hose-flow">
              <div className="hose-pressure">
                <div ref={bandRef} className="hose-band" />
                <div ref={barRef} className="hose-pressure-fill" />
              </div>
              <div className="hose-numeros">
                <div ref={litrosRef} className="refill-row" />
                <div ref={derrameRef} className="refill-row hose-derrame" />
              </div>
            </div>
            <button
              className="offer-btn offer-si hose-hold"
              onPointerDown={() => void (sim.current.holding = true)}
              onPointerUp={() => void (sim.current.holding = false)}
              onPointerLeave={() => void (sim.current.holding = false)}
              onPointerCancel={() => void (sim.current.holding = false)}
            >
              Mantén para presión
            </button>
          </>
        )}

        <button
          className="hose-soltar"
          onPointerDown={() =>
            useGameStore.getState().abortDelivery(sim.current.spilled)
          }
        >
          Soltar manguera
        </button>
      </div>
    </div>
  )
}
