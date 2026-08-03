import { useEffect, useRef } from 'react'
import { COLONIAS } from '../game/systems/clients'
import { useGameStore } from '../state/gameStore'

/*
 * Barra superior de estado (Paso 4): dinero, día y reputación de la colonia.
 * Arriba a la izquierda: el centro es de la calle, la derecha del debug.
 *
 * En Fase 1 hay una sola colonia; cuando la Fase 3 traiga más, aquí se
 * mostrará la de la zona donde estás parado.
 */
const COLONIA = Object.keys(COLONIAS)[0]

export function StatusBar() {
  const moneyRef = useRef<HTMLSpanElement>(null)
  const diaRef = useRef<HTMLSpanElement>(null)

  // Directo al DOM en un rAF, como los medidores: el dinero baila cada frame
  // durante una carga en el pozo y no amerita re-renders de React.
  useEffect(() => {
    let raf = 0
    let ultimo = ''
    const tick = () => {
      const { economy, refill } = useGameStore.getState()
      // Cartera EFECTIVA: lo cargado en el pozo aún no liquidado ya se resta.
      const money = economy.money - refill.cost
      const rep = Math.round(economy.reputation[COLONIA] ?? 0)
      const texto = `$${money.toFixed(2)}|Día ${economy.day} · ★ ${rep}`
      if (texto !== ultimo && moneyRef.current && diaRef.current) {
        const [m, d] = texto.split('|')
        moneyRef.current.textContent = m
        diaRef.current.textContent = d
        ultimo = texto
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div className="status-bar">
      <span ref={moneyRef} className="status-money" />
      <span ref={diaRef} className="status-dia" />
    </div>
  )
}
