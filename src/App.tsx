import { lazy, Suspense, useState } from 'react'
import { OrientationGate } from './ui/OrientationGate'
import { TapToStart } from './ui/TapToStart'

/*
 * EL CASCARÓN, y nada más.
 *
 * Lo único que este chunk necesita para pintar el primer cuadro es React, el
 * gate de orientación y el «toca para empezar». El juego entero —motor 3D,
 * HUD, store, sistemas, geometría— cuelga de `./Game`, que se descarga en
 * paralelo con esta pantalla y no antes de ella.
 *
 * La descarga arranca YA (el import() está a nivel de módulo, no dentro del
 * onClick): para cuando el jugador termina de leer el botón, el motor va a
 * medio camino. Diferir no es hacer esperar; es dejar de bloquear el primer
 * cuadro con cosas que no se ven todavía.
 */
const gamePromise = import('./Game')
const Game = lazy(() => gamePromise)

export default function App() {
  const [jugando, setJugando] = useState(false)

  return (
    <>
      <Suspense fallback={null}>
        <Game jugando={jugando} />
      </Suspense>
      {!jugando && <TapToStart onStart={() => setJugando(true)} />}
      <OrientationGate />
    </>
  )
}
