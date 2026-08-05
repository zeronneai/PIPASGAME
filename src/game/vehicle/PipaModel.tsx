import type { RefObject } from 'react'
import type { Group } from 'three'
import { useGameStore } from '../../state/gameStore'
import { ESTILO_DE_FABRICA, type Estilo } from '../systems/estilo'
import type { VehicleStats } from '../systems/garage'
import { PipaCarroceria, Wheel } from './PipaCarroceria'
import { PIPA_BODY } from './pipaParts'
import { useCromoEnvMap } from './useCromoEnvMap'
import { Pintado } from '../render/Pintado'

/*
 * Modelo de la pipa EN EL MUNDO: el adaptador entre el store y la carrocería
 * presentacional (PipaCarroceria, compartida con la vista previa del taller).
 *
 * La suscripción al estilo vive AQUÍ y no en Pipa.tsx: este componente es
 * hijo puro dentro del RigidBody, así que re-renderizarse por un cambio de
 * color no toca Rapier. El estilo NO pasa por el key={modelo} de Pipa.tsx
 * (remontaría la física por pintar la cabina).
 *
 * Convención de ejes: el frente de la pipa mira a +Z, igual que el personaje.
 */
export function PipaModel({
  wheelsRef,
  wheelCount,
  waterRef,
  stats,
  escala,
}: {
  /** Grupo «ruedas»; Pipa.tsx anima sus hijos cada frame. */
  wheelsRef: RefObject<Group | null>
  wheelCount: number
  /** Marcador del agua, solo en desarrollo. */
  waterRef: RefObject<Group | null>
  /** Las de la pipa equipada: de ahí sale el tamaño de las ruedas. */
  stats: VehicleStats
  /** Tamaño del modelo respecto a la pipa de referencia. */
  escala: number
}) {
  /*
   * El estilo de la pipa equipada. El ?? devuelve la CONSTANTE de fábrica
   * (misma identidad siempre), así que una pipa sin pintar no re-renderiza
   * nada de gratis; con estilo, el objeto solo cambia al comprar.
   */
  const estilo: Estilo = useGameStore(
    (s) => s.garage.pipas[s.garage.equipada]?.estilo ?? ESTILO_DE_FABRICA,
  )
  const rinCromado = estilo.cromo.rines === true
  const envMap = useCromoEnvMap(rinCromado)

  return (
    <group name="pipa">
      {/* Las ruedas quedan FUERA de la carrocería escalada a propósito: el
          controlador les da su posición ya en la escala del chasis, y
          meterlas dentro las escalaría dos veces. */}
      <PipaCarroceria estilo={estilo} escala={escala} />

      {/*
        Dónde está el agua, solo en desarrollo. El tanque es opaco, así que
        sin esto el chapoteo solo se puede sentir y no ver; con el marcador se
        entiende de un vistazo por qué media pipa es la más difícil. No entra
        al bundle de producción.
      */}
      {import.meta.env.DEV && (
        <group
          ref={waterRef}
          position={[0, PIPA_BODY.tanque.y, PIPA_BODY.tanque.z]}
        >
          <mesh name="debug-agua">
            <sphereGeometry args={[0.3, 10, 8]} />
            <Pintado color="#2f9ee0" wireframe />
          </mesh>
        </group>
      )}

      {/* El orden de los hijos ES el orden de ruedas del controlador:
          0 delantera izq, 1 delantera der, 2 trasera izq, 3 trasera der. */}
      <group name="ruedas" ref={wheelsRef}>
        {Array.from({ length: wheelCount }, (_, i) => (
          <Wheel key={i} w={stats.wheel} rinCromado={rinCromado} envMap={envMap} />
        ))}
      </group>
    </group>
  )
}
