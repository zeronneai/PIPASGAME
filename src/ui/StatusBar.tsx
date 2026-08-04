import { useEffect, useRef } from 'react'
import { balance } from '../game/balance'
import { COLONIAS } from '../game/systems/clients'
import { isRadioUnlocked } from '../game/systems/reputation'
import { useGameStore } from '../state/gameStore'

/*
 * Barra superior de estado (Paso 4): dinero, día y reputación de la colonia.
 * Arriba a la izquierda: el centro es de la calle, la derecha del debug.
 *
 * Desde el Paso 6 la reputación es un indicador de verdad: número, barra de
 * progreso hacia el máximo con la marca del umbral del radio, y color por
 * nivel (rojo por debajo del arranque, verde con el radio ganado). El
 * jugador tiene que PODER ver cuánto le falta para el hito de la fase.
 *
 * En Fase 1 hay una sola colonia; cuando la Fase 3 traiga más, aquí se
 * mostrará la de la zona donde estás parado.
 */
const COLONIA = Object.keys(COLONIAS)[0]

export function StatusBar() {
  const moneyRef = useRef<HTMLSpanElement>(null)
  const diaRef = useRef<HTMLSpanElement>(null)
  const repRef = useRef<HTMLSpanElement>(null)
  const repFillRef = useRef<HTMLDivElement>(null)
  const repTickRef = useRef<HTMLDivElement>(null)
  const segundaTickRef = useRef<HTMLDivElement>(null)
  const repWrapRef = useRef<HTMLSpanElement>(null)

  // Directo al DOM en un rAF, como los medidores: el dinero baila cada frame
  // durante una carga en el pozo y no amerita re-renders de React.
  useEffect(() => {
    let raf = 0
    let ultimo = ''
    const tick = () => {
      const { economy, refill } = useGameStore.getState()
      const r = balance.reputacion
      // Cartera EFECTIVA: lo cargado en el pozo aún no liquidado ya se resta.
      const money = economy.money - refill.cost
      const rep = economy.reputation[COLONIA] ?? 0
      const nivel = isRadioUnlocked(rep)
        ? 'lista'
        : rep < r.start
          ? 'baja'
          : ''
      const texto = `$${money.toFixed(2)}|Día ${economy.day}|${Math.round(rep)}|${nivel}`
      if (texto !== ultimo) {
        ultimo = texto
        if (moneyRef.current) moneyRef.current.textContent = `$${money.toFixed(2)}`
        if (diaRef.current) diaRef.current.textContent = `Día ${economy.day}`
        if (repRef.current) repRef.current.textContent = `★ ${Math.round(rep)}`
        if (repFillRef.current)
          repFillRef.current.style.transform = `scaleX(${rep / r.max})`
        if (repWrapRef.current)
          repWrapRef.current.className = `status-rep${nivel ? ` rep-${nivel}` : ''}`
      }
      // Las marcas de los umbrales siguen a leva en vivo; escritura barata.
      if (repTickRef.current)
        repTickRef.current.style.left = `${(r.radioUnlock / r.max) * 100}%`
      if (segundaTickRef.current)
        segundaTickRef.current.style.left = `${(r.segundaUnlock / r.max) * 100}%`
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div className="status-bar">
      <span ref={moneyRef} className="status-money" />
      <span ref={diaRef} className="status-dia" />
      <span ref={repWrapRef} className="status-rep">
        <span ref={repRef} className="status-rep-num" />
        <span className="rep-bar">
          <div ref={repFillRef} className="rep-bar-fill" />
          {/* Las marcas de los hitos: primero se gana la segunda, después
              se abre el radio de despacho. Se VE cuánto falta para cada uno. */}
          <div ref={segundaTickRef} className="rep-tick rep-tick-segunda" />
          <div ref={repTickRef} className="rep-tick" />
        </span>
      </span>
    </div>
  )
}
