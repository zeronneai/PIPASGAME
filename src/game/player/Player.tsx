import { useRef, type RefObject } from 'react'
import type { Group } from 'three'
import { CapsuleCollider, RigidBody, type RapierRigidBody } from '@react-three/rapier'
import { usePlayerMovement } from './usePlayerMovement'

// Cápsula de 1.8 m de alto: cilindro de 1.1 (halfHeight 0.55) + tapas de 0.35
export function Player({
  /** Lo recibe de fuera: la cámara necesita el mismo cuerpo para su raycast. */
  bodyRef,
}: {
  bodyRef: RefObject<RapierRigidBody | null>
}) {
  const visualRef = useRef<Group>(null)

  usePlayerMovement(bodyRef, visualRef)

  return (
    <RigidBody
      ref={bodyRef}
      type="kinematicPosition"
      colliders={false}
      position={[0, 1, 0]}
    >
      <CapsuleCollider args={[0.55, 0.35]} />
      <group ref={visualRef}>
        <mesh>
          <capsuleGeometry args={[0.35, 1.1, 6, 12]} />
          <meshStandardMaterial color="#c8c8c8" />
        </mesh>
        {/* nariz: marca hacia dónde mira el personaje (local +z = frente) */}
        <mesh position={[0, 0.3, 0.35]}>
          <boxGeometry args={[0.15, 0.15, 0.3]} />
          <meshStandardMaterial color="#4da3ff" />
        </mesh>
      </group>
    </RigidBody>
  )
}
