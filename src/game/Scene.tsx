import { Suspense, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { Physics, type RapierRigidBody } from '@react-three/rapier'
import { Player } from './player/Player'
import { ThirdPersonCamera } from './camera/ThirdPersonCamera'
import { ColoniaGreybox } from './world/ColoniaGreybox'
import { RenderStats } from './systems/RenderStats'
import { tuning } from './tuning'

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
          <ColoniaGreybox />
          <Player bodyRef={playerBody} />
          {/* Después del Player en el árbol: su useFrame corre primero, así
              la cámara ya ve la posición de este frame. */}
          <ThirdPersonCamera targetBody={playerBody} />
        </Physics>
      </Suspense>
      <RenderStats />
    </Canvas>
  )
}
