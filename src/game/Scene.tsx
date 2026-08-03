import { Suspense, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { Physics, RigidBody, type RapierRigidBody } from '@react-three/rapier'
import { Player } from './player/Player'
import { ThirdPersonCamera } from './camera/ThirdPersonCamera'
import { tuning } from './tuning'

/**
 * Paredes provisionales para probar la colisión de la cámara. El mundo real
 * llega en el Paso 5 y las reemplaza.
 */
function TestWalls() {
  return (
    <RigidBody type="fixed" colliders="cuboid">
      <mesh position={[6, 2, -4]}>
        <boxGeometry args={[8, 4, 0.5]} />
        <meshStandardMaterial color="#8e8e8e" />
      </mesh>
      <mesh position={[10, 2, 0]}>
        <boxGeometry args={[0.5, 4, 8]} />
        <meshStandardMaterial color="#9a9a9a" />
      </mesh>
      <mesh position={[-7, 1.5, -6]}>
        <boxGeometry args={[3, 3, 3]} />
        <meshStandardMaterial color="#868686" />
      </mesh>
    </RigidBody>
  )
}

export function Scene() {
  const playerBody = useRef<RapierRigidBody>(null)

  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ position: [0, 5, 8], fov: tuning.camera.fovFoot }}
      gl={{ powerPreference: 'high-performance' }}
    >
      <color attach="background" args={['#5c6b7a']} />
      <directionalLight position={[10, 15, 5]} intensity={2.2} />
      <ambientLight intensity={0.35} />
      <Suspense fallback={null}>
        <Physics timeStep={1 / 60}>
          <RigidBody type="fixed" colliders="cuboid">
            <mesh position={[0, -0.1, 0]}>
              <boxGeometry args={[200, 0.2, 200]} />
              <meshStandardMaterial color="#7a7a7a" />
            </mesh>
          </RigidBody>
          <TestWalls />
          <Player bodyRef={playerBody} />
          {/* Después del Player en el árbol: su useFrame corre primero, así
              la cámara ya ve la posición de este frame. */}
          <ThirdPersonCamera targetBody={playerBody} />
        </Physics>
      </Suspense>
    </Canvas>
  )
}
