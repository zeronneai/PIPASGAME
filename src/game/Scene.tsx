import { Suspense } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Physics, RigidBody } from '@react-three/rapier'
import { Vector3 } from 'three'
import { Player } from './player/Player'
import { tuning } from './tuning'
import { useGameStore } from '../state/gameStore'

const _camTarget = new Vector3()

/**
 * Cámara provisional: sigue al jugador con un offset fijo, sin orbitar.
 * Existe solo para poder probar el movimiento; el Paso 4 la reemplaza por
 * la ThirdPersonCamera real (orbitar con arrastre, colisión con paredes).
 */
function ProvisionalFollowCamera() {
  useFrame((state, delta) => {
    const { pos } = useGameStore.getState().player
    const dt = Math.min(delta, 1 / 30)
    const c = tuning.camera
    _camTarget.set(pos.x, pos.y + c.offsetY, pos.z + c.offsetZ)
    state.camera.position.lerp(_camTarget, 1 - Math.exp(-c.followLerp * dt))
    state.camera.lookAt(pos.x, pos.y + 1, pos.z)
  })
  return null
}

export function Scene() {
  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ position: [0, 5, 8], fov: 60 }}
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
          <Player />
        </Physics>
      </Suspense>
      <ProvisionalFollowCamera />
    </Canvas>
  )
}
