import { useEffect, useRef } from 'react'
import { balance } from '../game/balance'
import { useGameStore } from '../state/gameStore'

const litros = (n: number) => Math.floor(n).toLocaleString('es-MX')
const pesos = (n: number) => `$${n.toFixed(2)}`

/**
 * Medidor de la carga en el pozo (sección 2.2): barra del tanque, litros que
 * van entrando, lo que llevan costado, la cartera en vivo, y el botón de
 * cortar. Cortar cuando quieras es parte del diseño —cargar solo lo que
 * necesitas es más rápido— así que el botón es grande y está siempre a la
 * vista, no escondido en el de contexto.
 *
 * Solo el montaje pasa por React (refill.active); los números cambian cada
 * frame y se escriben directo al DOM en un rAF, igual que TankGauge.
 */
export function RefillMeter() {
  const active = useGameStore((s) => s.refill.active)

  if (!active) return null
  return <Medidor />
}

function Medidor() {
  const barRef = useRef<HTMLDivElement>(null)
  const litrosRef = useRef<HTMLDivElement>(null)
  const costoRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let raf = 0
    const tick = () => {
      const { economy, refill, vehicle } = useGameStore.getState()
      if (barRef.current) {
        barRef.current.style.transform = `scaleX(${vehicle.fillLevel})`
      }
      if (litrosRef.current) {
        const enTanque = economy.liters + refill.litersLoaded
        litrosRef.current.textContent = `${litros(enTanque)} / ${litros(balance.tank.capacity)} L  (+${litros(refill.litersLoaded)})`
      }
      if (costoRef.current) {
        costoRef.current.textContent = `costo ${pesos(refill.cost)} · cartera ${pesos(economy.money - refill.cost)}`
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div className="refill-meter">
      <div className="refill-title">Cargando agua</div>
      <div className="hud-bar refill-bar">
        <div ref={barRef} className="hud-bar-fill" />
      </div>
      <div ref={litrosRef} className="refill-row" />
      <div ref={costoRef} className="refill-row" />
      <button
        className="refill-cut"
        // onPointerDown, como el botón de contexto: en móvil el click tarda.
        onPointerDown={() => useGameStore.getState().stopRefill()}
      >
        Cortar carga
      </button>
    </div>
  )
}
