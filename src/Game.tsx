import { Scene } from './game/Scene'
import { GameUI } from './ui/GameUI'
import { initPersistence } from './game/systems/persistence'

/*
 * EL JUEGO, del otro lado de la frontera de carga.
 *
 * Este módulo y todo lo que cuelga de él —la escena, el HUD, el store, los
 * sistemas, la geometría de la colonia— viven en chunks diferidos. `App.tsx`
 * se queda con el cascarón: React, el gate de orientación y el «toca para
 * empezar», que es lo único que hace falta para pintar el primer cuadro.
 *
 * LA HIDRATACIÓN CORRE AQUÍ, a nivel de módulo, y ese es el detalle que hace
 * que el corte sea seguro. Antes vivía en `main.tsx` para garantizar que el
 * guardado estuviera puesto antes de que la pipa leyera su posición; el
 * problema es que arrastraba el store —y con él media colonia— al arranque.
 * Ponerla aquí conserva la garantía y le quita el costo: nada que lea el
 * store existe fuera de este chunk, así que cuando este módulo termina de
 * evaluarse, ya está hidratado y todavía no se ha montado nada.
 *
 * A nivel de módulo y no en un efecto a propósito: un efecto correría DESPUÉS
 * del primer render de la escena, que es justo el orden que hay que evitar.
 */
initPersistence()

export default function Game({ jugando }: { jugando: boolean }) {
  return (
    <>
      <Scene />
      {jugando && <GameUI />}
    </>
  )
}
