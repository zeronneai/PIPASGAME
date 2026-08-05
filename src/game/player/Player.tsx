import { useRef, useState, type RefObject } from 'react'
import type { Group } from 'three'
import { CapsuleCollider, RigidBody, type RapierRigidBody } from '@react-three/rapier'
import { usePlayerMovement } from './usePlayerMovement'
import { useGameStore } from '../../state/gameStore'
import { Pintado } from '../render/Pintado'
import { PALETA } from '../render/paleta'

// Cápsula de 1.8 m de alto: cilindro de 1.1 (halfHeight 0.55) + tapas de 0.35
export function Player({
  /** Lo recibe de fuera: la cámara necesita el mismo cuerpo para su raycast. */
  bodyRef,
}: {
  bodyRef: RefObject<RapierRigidBody | null>
}) {
  const visualRef = useRef<Group>(null)
  // El modo cambia poco: se puede suscribir sin costo por frame.
  const driving = useGameStore((s) => s.mode === 'DRIVING')

  // Foto del estado hidratado, UNA vez al montar (mismo patrón que la pipa):
  // el jugador despierta donde quedó, no en el centro. useState y no una
  // lectura en el render: player.pos se muta cada frame y un re-render
  // tardío teletransportaría el cuerpo.
  const [inicial] = useState(() => {
    const p = useGameStore.getState().player
    return { pos: [p.pos.x, p.pos.y, p.pos.z] as const, yaw: p.yaw }
  })

  usePlayerMovement(bodyRef, visualRef)

  return (
    <RigidBody
      ref={bodyRef}
      type="kinematicPosition"
      colliders={false}
      position={[inicial.pos[0], inicial.pos[1], inicial.pos[2]]}
    >
      <CapsuleCollider args={[0.55, 0.35]} />
      {/* Manejando se esconde. El cuerpo además se saca de la simulación en
          Interaction.tsx, para que no estorbe a la propia pipa. */}
      <group ref={visualRef} rotation={[0, inicial.yaw, 0]} visible={!driving}>
        <mesh>
          <capsuleGeometry args={[0.35, 1.1, 6, 12]} />
          <Pintado color={PALETA.cal} />
        </mesh>
        {/* nariz: marca hacia dónde mira el personaje (local +z = frente) */}
        <mesh position={[0, 0.3, 0.35]}>
          <boxGeometry args={[0.15, 0.15, 0.3]} />
          <Pintado color={PALETA.anil} />
        </mesh>
      </group>
    </RigidBody>
  )
}
