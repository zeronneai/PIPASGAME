import { useEffect } from 'react'
import { saveGame } from '../game/systems/persistence'
import { useGameStore } from '../state/gameStore'

/*
 * La pantalla de fin de día (sección 2.9): el momento de «logré algo».
 * Modal de verdad sobre todo lo demás; el mundo espera (DayClock y el
 * despacho se detienen mientras exista el resumen).
 *
 * El progreso se guarda dos veces: al abrir el resumen (el día quedó
 * cerrado aunque no toques nada) y al arrancar el siguiente.
 */

const pesos = (n: number) => `$${n.toFixed(2)}`

export function SummaryScreen() {
  const summary = useGameStore((s) => s.summary)

  useEffect(() => {
    if (summary) saveGame()
  }, [summary])

  if (!summary) return null

  const repDelta = summary.repDespues - summary.repAntes
  const { entregas } = summary
  return (
    <div className="offer-backdrop">
      <div className="offer-card summary-card">
        <div className="summary-titulo">Fin del día {summary.day}</div>

        <div className="offer-rows summary-rows">
          <div className="offer-row">
            <span>Litros vendidos</span>
            <b>{summary.litrosVendidos.toLocaleString('es-MX')} L</b>
          </div>
          <div className="offer-row">
            <span>Dinero ganado</span>
            <b>{pesos(summary.ingresos)}</b>
          </div>
          <div className="offer-row">
            <span>Gasto en agua</span>
            <b>−{pesos(summary.gastoAgua)}</b>
          </div>
        </div>

        <div className={`summary-neta ${summary.neta < 0 ? 'perdida' : ''}`}>
          <span>Ganancia neta</span>
          <b>{summary.neta < 0 ? `−${pesos(-summary.neta)}` : pesos(summary.neta)}</b>
        </div>

        <div className="offer-rows summary-rows">
          <div className="offer-row">
            <span>Entregas</span>
            <b>
              {entregas.aTiempo} a tiempo · {entregas.tarde} tarde
              {entregas.muyTarde > 0 ? ` · ${entregas.muyTarde} muy tarde` : ''}
            </b>
          </div>
          {summary.canceladas > 0 && (
            <div className="offer-row summary-mal">
              <span>Canceladas</span>
              <b>{summary.canceladas}</b>
            </div>
          )}
          <div className="offer-row">
            <span>Reputación</span>
            <b className={repDelta < 0 ? 'summary-mal' : 'summary-bien'}>
              {Math.round(summary.repAntes)} → {Math.round(summary.repDespues)}{' '}
              ({repDelta >= 0 ? '+' : ''}
              {Math.round(repDelta)})
            </b>
          </div>
        </div>

        <button
          className="offer-btn offer-si summary-boton"
          onPointerDown={() => {
            useGameStore.getState().startNextDay()
            saveGame()
          }}
        >
          Empezar día {summary.day + 1}
        </button>
      </div>
    </div>
  )
}
