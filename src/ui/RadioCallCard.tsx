import { useEffect, useRef } from 'react'
import { COLONIAS } from '../game/systems/clients'
import { useGameStore } from '../state/gameStore'

/*
 * La llamada del despacho en pantalla (Paso 7): cliente, colonia, litros,
 * ventana y pago, con contestar o pasar. NO es un modal: llega mientras
 * manejas y el juego sigue; por eso vive arriba al centro, compacta, y se
 * va sola si no contestas (la barrita es el tiempo que le queda).
 *
 * El borde de color es el perfil, la misma clave que la lista de pedidos
 * y el chip de la oferta: tres lugares, un solo lenguaje.
 */
export function RadioCallCard() {
  const call = useGameStore((s) => s.radioCall)
  const barRef = useRef<HTMLDivElement>(null)

  // Solo la barrita corre por frame; el resto de la tarjeta es estática.
  useEffect(() => {
    if (!call) return
    let raf = 0
    const total = call.expiresAt - useGameStore.getState().clock.daySeconds
    const tick = () => {
      const restante = call.expiresAt - useGameStore.getState().clock.daySeconds
      if (barRef.current && total > 0)
        barRef.current.style.transform = `scaleX(${Math.max(0, restante / total)})`
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [call])

  if (!call) return null

  // Distancia a la ENTREGA desde donde estás ahora: se calcula una vez por
  // tarjeta (la llamada dura segundos; el orden de magnitud no cambia).
  const s = useGameStore.getState()
  const desde = s.mode === 'DRIVING' ? s.vehicle.pos : s.player.pos
  const dist = Math.round(
    Math.hypot(call.delivery[0] - desde.x, call.delivery[2] - desde.z),
  )

  return (
    // key: cada llamada remonta la tarjeta y reinicia la animación de entrada.
    <div className={`radio-card perfil-borde-${call.perfil}`} key={call.clientId + call.expiresAt}>
      <div className="radio-titulo">📻 Despacho</div>
      <div className="radio-cliente">
        {call.name} · {COLONIAS[call.colonia]?.name ?? call.colonia}
      </div>
      <div className="radio-datos">
        {call.litros.toLocaleString('es-MX')} L · {call.windowMinutes} min ·
        ~${call.estimate.toFixed(2)} · a {dist} m
      </div>
      <div className="hud-bar radio-timer">
        <div ref={barRef} className="hud-bar-fill" />
      </div>
      <div className="radio-actions">
        <button
          className="offer-btn offer-no"
          onPointerDown={() => useGameStore.getState().rejectRadioCall('RECHAZO')}
        >
          Pasar
        </button>
        <button
          className="offer-btn offer-si"
          onPointerDown={() => useGameStore.getState().acceptRadioCall()}
        >
          Aceptar
        </button>
      </div>
    </div>
  )
}
