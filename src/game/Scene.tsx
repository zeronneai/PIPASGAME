import { Suspense, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { Physics, type RapierRigidBody } from '@react-three/rapier'
import { Player } from './player/Player'
import { Pipa } from './vehicle/Pipa'
import { ThirdPersonCamera } from './camera/ThirdPersonCamera'
import { ColoniaGreybox } from './world/ColoniaGreybox'
import { DayClock } from './systems/DayClock'
import { Interaction } from './systems/Interaction'
import { RadioDispatch } from './systems/RadioDispatch'
import { Refill } from './systems/Refill'
import { Rescue } from './systems/Rescue'
import { RenderStats } from './systems/RenderStats'
import { PHYSICS_STEP, tuning } from './tuning'

export function Scene() {
  const playerBody = useRef<RapierRigidBody>(null)
  const vehicleBody = useRef<RapierRigidBody>(null)

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
        <DayClock />
        <RadioDispatch />
        <Physics timeStep={PHYSICS_STEP}>
          <ColoniaGreybox />
          <Player bodyRef={playerBody} />
          <Pipa bodyRef={vehicleBody} />
          {/* Antes de la cámara: espeja el transform de la pipa al store, que
              es de donde la cámara lo lee. */}
          <Interaction playerBody={playerBody} vehicleBody={vehicleBody} />
          {/* Después de Interaction: usa la posición de la pipa ya espejada
              en este mismo frame. */}
          <Refill />
          <Rescue playerBody={playerBody} vehicleBody={vehicleBody} />
          {/* Después del Player y la Pipa en el árbol: sus useFrame corren
              primero, así la cámara ya ve la posición de este frame. */}
          <ThirdPersonCamera
            playerBody={playerBody}
            vehicleBody={vehicleBody}
          />
        </Physics>
      </Suspense>
      <RenderStats />
    </Canvas>
  )
}
