import { Suspense, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { Physics, type RapierRigidBody } from '@react-three/rapier'
import { Player } from './player/Player'
import { Pipa } from './vehicle/Pipa'
import { ThirdPersonCamera } from './camera/ThirdPersonCamera'
import { Cielo } from './world/Cielo'
import { ColliderDebugView } from './world/ColliderDebugView'
import { ColoniaGreybox } from './world/ColoniaGreybox'
import { PALETA } from './paleta'
import { useGameStore } from '../state/gameStore'
import { DayClock } from './systems/DayClock'
import { DeliveryMarkers } from './systems/DeliveryMarkers'
import { Ephemerals } from './systems/Ephemerals'
import { Interaction } from './systems/Interaction'
import { RadioDispatch } from './systems/RadioDispatch'
import { Refill } from './systems/Refill'
import { Rescue } from './systems/Rescue'
import { Volcadura } from './systems/Volcadura'
import { RenderStats } from './systems/RenderStats'
import { PHYSICS_STEP, tuning } from './tuning'

export function Scene() {
  const playerBody = useRef<RapierRigidBody>(null)
  const vehicleBody = useRef<RapierRigidBody>(null)
  // Debug de rapier: cambia poco (checkbox de leva) — puede re-renderizar.
  const debugPhysics = useGameStore((s) => s.debug.physics)

  return (
    <Canvas
      dpr={[1, 1.5]}
      /* near explícito: el default (0.1) regala precisión de depth y hace
         vibrar caras cercanas-paralelas a distancia. La cámara nunca se
         acerca a menos de ~0.85 m de un muro (minDistance/collisionRadius),
         así que 0.3 es seguro y triplica la precisión. */
      camera={{ position: [0, 5, 8], fov: tuning.camera.fovFoot, near: 0.3, far: 500 }}
      gl={{ powerPreference: 'high-performance' }}
      /* Sin tone mapping (Fase 3): la información visual vive en el color
         declarado, no en la curva de la cámara. Los hex de la paleta son
         literales en pantalla — look plano, de rótulo. */
      flat
    >
      {/* Respaldo detrás del domo, en el tono del horizonte. */}
      <color attach="background" args={[PALETA.cieloHorizonte]} />
      {/* Niebla lineal LEJANA: mediodía de calor seco, no bruma. Empieza a
          120 m (antes 45: se comía la profundidad desde media cuadra) y solo
          el fondo se funde con el horizonte del domo. */}
      <fog attach="fog" args={[PALETA.niebla, 120, 420]} />
      <Cielo />
      {/*
        MEDIODÍA: sol alto y casi neutro (el calor lo pone la paleta, no la
        luz) apenas ladeado para que las fachadas modelen, y un hemisferio
        (cielo azul arriba, rebote terroso abajo) en lugar del ambient plano
        — las caras en sombra se tiñen, no se apagan.
      */}
      {/* Elevación ~60°: alto para leer mediodía, ladeado lo justo para que
          los muros verticales SÍ reciban sol (vertical puro los apaga). */}
      <directionalLight position={[35, 70, 18]} color={PALETA.sol} intensity={1.85} />
      {/* El azul del hemisferio es MÁS claro que el del domo a propósito:
          con el cenit puro las sombras se teñían de azul marino. */}
      <hemisphereLight args={['#a9c6e6', PALETA.rebote, 0.95]} />
      <Suspense fallback={null}>
        <DayClock />
        <RadioDispatch />
        <Physics timeStep={PHYSICS_STEP} debug={debugPhysics}>
          <ColoniaGreybox />
          <Ephemerals />
          <DeliveryMarkers />
          <Player bodyRef={playerBody} />
          <Pipa bodyRef={vehicleBody} />
          {/* Antes de la cámara: espeja el transform de la pipa al store, que
              es de donde la cámara lo lee. */}
          <Interaction playerBody={playerBody} vehicleBody={vehicleBody} />
          {/* Después de Interaction: usa la posición de la pipa ya espejada
              en este mismo frame. */}
          <Refill />
          <Rescue playerBody={playerBody} vehicleBody={vehicleBody} />
          <Volcadura vehicleBody={vehicleBody} />
          {/* Después del Player y la Pipa en el árbol: sus useFrame corren
              primero, así la cámara ya ve la posición de este frame. */}
          <ThirdPersonCamera
            playerBody={playerBody}
            vehicleBody={vehicleBody}
          />
        </Physics>
        <ColliderDebugView />
      </Suspense>
      <RenderStats />
    </Canvas>
  )
}
