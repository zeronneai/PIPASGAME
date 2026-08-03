import { useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, RigidBody, type RapierRigidBody } from '@react-three/rapier'
import type { Group } from 'three'
import { tuning } from '../tuning'
import { PIPA_BODY, PIPA_SPAWN } from './pipaParts'
import { PipaModel } from './PipaModel'
import { useVehicleController, WHEEL_COUNT } from './useVehicleController'

export function Pipa({
  bodyRef,
}: {
  /** Lo recibe de fuera: la cámara lo necesita para seguir a la pipa. */
  bodyRef: RefObject<RapierRigidBody | null>
}) {
  const wheelsRef = useRef<Group>(null)
  const controllerRef = useVehicleController(bodyRef)

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
        controller.wheelSuspensionLength(i) ?? tuning.vehicle.suspension.restLength
      if (conn) anchor.position.set(conn.x, conn.y - suspension, conn.z)
      anchor.rotation.y = controller.wheelSteering(i) ?? 0
      if (spin) spin.rotation.x = controller.wheelRotation(i) ?? 0
    }
  })

  const t = tuning.vehicle
  const B = PIPA_BODY

  return (
    <RigidBody
      ref={bodyRef}
      type="dynamic"
      colliders={false}
      position={PIPA_SPAWN}
      linearDamping={t.linearDamping}
      angularDamping={t.angularDamping}
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
        position={[0, 0.4, 0]}
        density={0}
      />
      <CuboidCollider
        args={[B.cabina.size[0] / 2, B.cabina.size[1] / 2, B.cabina.size[2] / 2]}
        position={[0, B.cabina.y, B.cabina.z]}
        density={0}
      />
      <CuboidCollider
        args={[B.tanque.radius, B.tanque.radius, B.tanque.length / 2]}
        position={[0, B.tanque.y, B.tanque.z]}
        density={0}
      />
      <PipaModel wheelsRef={wheelsRef} wheelCount={WHEEL_COUNT} />
    </RigidBody>
  )
}
