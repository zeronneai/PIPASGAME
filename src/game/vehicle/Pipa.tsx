import { useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  CuboidCollider,
  RigidBody,
  type RapierRigidBody,
} from '@react-three/rapier'
import type { Group } from 'three'
import { PIPA_BODY } from './pipaParts'
import { PipaModel } from './PipaModel'
import { useVehicleController, WHEEL_COUNT } from './useVehicleController'
import { statsPipa, useGameStore } from '../../state/gameStore'

/**
 * La pipa que traes puesta.
 *
 * El `key` es lo importante: cambiar de modelo cambia el tamaño del chasis y
 * los puntos de anclaje de las ruedas, y esos dos Rapier los congela al crear
 * el collider y el controlador. Con el remontaje se reconstruye todo de un
 * golpe, y como el cuerpo nace donde diga el store, la pipa no se teletransporta.
 *
 * Las MEJORAS no pasan por aquí: no tocan geometría, así que entran en vivo
 * por el paso de física.
 */
export function Pipa({
  bodyRef,
}: {
  bodyRef: RefObject<RapierRigidBody | null>
}) {
  const modelo = useGameStore((s) => s.garage.equipada)
  return <PipaCuerpo key={modelo} bodyRef={bodyRef} />
}

function PipaCuerpo({
  bodyRef,
}: {
  /** Lo recibe de fuera: la cámara lo necesita para seguir a la pipa. */
  bodyRef: RefObject<RapierRigidBody | null>
}) {
  const wheelsRef = useRef<Group>(null)
  const waterRef = useRef<Group>(null)
  const controllerRef = useVehicleController(bodyRef)

  // Del garage, no de una constante: el modelo base más sus mejoras. Se lee
  // al montar, que es cuando se arma el cuerpo; lo que cambia en vivo lo
  // reaplica el paso de física.
  const stats = statsPipa()
  const t = stats.fisica
  const escala = stats.escala
  const B = PIPA_BODY

  // Las ruedas no son cuerpos físicos: el controlador las resuelve por raycast
  // y aquí solo se copian su altura de suspensión, su giro y su rodada.
  useFrame(() => {
    const controller = controllerRef.current
    const ruedas = wheelsRef.current
    if (!controller || !ruedas) return
    for (let i = 0; i < WHEEL_COUNT; i++) {
      const anchor = ruedas.children[i]
      const spin = anchor?.children[0]
      if (!anchor) continue
      const conn = controller.wheelChassisConnectionPointCs(i)
      const suspension =
        controller.wheelSuspensionLength(i) ??
        stats.fisica.suspension.restLength
      if (conn) anchor.position.set(conn.x, conn.y - suspension, conn.z)
      anchor.rotation.y = controller.wheelSteering(i) ?? 0
      if (spin) spin.rotation.x = controller.wheelRotation(i) ?? 0
    }

    // Marcador del agua (solo existe en desarrollo)
    const agua = waterRef.current
    if (agua) {
      const { slosh } = useGameStore.getState().vehicle
      agua.position.set(
        slosh.x,
        PIPA_BODY.tanque.y * escala,
        PIPA_BODY.tanque.z * escala + slosh.z,
      )
    }
  })

  // Nace donde diga el store, no donde diga una constante: si este componente
  // se remontara, la pipa reaparece donde la dejaste y no en su punto de
  // partida. Se lee una sola vez, al montar; después el store es el espejo.
  const { pos, rot } = useGameStore.getState().vehicle

  return (
    <RigidBody
      ref={bodyRef}
      type="dynamic"
      colliders={false}
      position={[pos.x, pos.y, pos.z]}
      quaternion={[rot.x, rot.y, rot.z, rot.w]}
      /* Los amortiguamientos se aplican en el paso de física, no aquí: este
         componente no se re-renderiza y se quedarían congelados. */
      // Si se duerme, el controlador deja de moverla y parece un bug.
      canSleep={false}
    >
      {/*
        Tres cuboides, ni un trimesh (sección 2). La masa NO sale de aquí:
        density 0 y las 12 t se ponen con setAdditionalMassProperties, que es
        también el gancho que el Paso 7 necesita para mover el centro de masa.
      */}
      <CuboidCollider
        args={[t.chassis.width / 2, t.chassis.height / 2, t.chassis.length / 2]}
        position={[0, 0.4 * escala, 0]}
        density={0}
      />
      <CuboidCollider
        args={[
          (B.cabina.size[0] / 2) * escala,
          (B.cabina.size[1] / 2) * escala,
          (B.cabina.size[2] / 2) * escala,
        ]}
        position={[0, B.cabina.y * escala, B.cabina.z * escala]}
        density={0}
      />
      <CuboidCollider
        args={[
          B.tanque.radius * escala,
          B.tanque.radius * escala,
          (B.tanque.length / 2) * escala,
        ]}
        position={[0, B.tanque.y * escala, B.tanque.z * escala]}
        density={0}
      />
      <PipaModel
        wheelsRef={wheelsRef}
        wheelCount={WHEEL_COUNT}
        waterRef={waterRef}
        stats={t}
        escala={escala}
      />
    </RigidBody>
  )
}
