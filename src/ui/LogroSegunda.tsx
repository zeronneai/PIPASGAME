import { useEffect } from 'react'
import { saveGame } from '../game/systems/persistence'
import { useGameStore } from '../state/gameStore'

/*
 * El momento del logro (Fase 2, Paso 6): te GANASTE la segunda.
 *
 * El documento lo pide explícito: «un momento claro de logro, no que
 * simplemente aparezca el botón». Tarjeta modal como el resumen de jornada
 * — el mundo espera mientras está abierta (reloj, radio y efímeros la
 * chequean) — y se guarda al abrir: un logro no se pierde por cerrar la app.
 */
export function LogroSegunda() {
  const abierto = useGameStore((s) => s.logroSegunda)

  useEffect(() => {
    if (abierto) saveGame()
  }, [abierto])

  if (!abierto) return null

  return (
    <div className="offer-backdrop">
      <div className="offer-card logro-card">
        <div className="logro-marca">2ª</div>
        <div className="logro-titulo">¡Te ganaste la segunda!</div>
        <p className="logro-texto">
          La colonia ya te conoce, y a pipero cumplidor no se le regatea el
          motor. Mantén apretado el botón de la <b>2ª</b> en recta y con
          velocidad: empuja como mula — nomás no lo fundas, que el termómetro
          ya está en tu tablero.
        </p>
        <button
          className="offer-btn offer-si summary-boton"
          onPointerDown={() => useGameStore.getState().setLogroSegunda(false)}
        >
          A probarla
        </button>
      </div>
    </div>
  )
}
