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
      /*
       * `near` y `far` DECLARADOS, y no es un detalle: los defaults de r3f
       * son 0.1 y 1000, un rango de 1:10,000 que deja la precisión de
       * profundidad por los suelos a media cuadra. Ahí nacía la mitad del
       * parpadeo de las fachadas — el z-fighting no era solo por geometría
       * coplanar, era por un buffer sin resolución para distinguirla.
       *
       * La precisión es proporcional a `near`, así que subirlo de 0.1 a 0.35
       * la multiplica por 3.5 en todo el mapa. 0.35 sigue por dentro del
       * colchón de la cámara contra muros (`collisionRadius` 0.35), así que
       * no abre el plano cercano a atravesar paredes. Con 200 m de mapa,
       * 400 de `far` sobra: el domo del cielo (350) cabe por dentro.
       */
      camera={{
        position: [0, 5, 8],
        fov: tuning.camera.fovFoot,
        near: 0.35,
        far: 400,
      }}
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
        luz), a ~60° de elevación — lo justo de ladeado para que los muros
        verticales SÍ reciban sol (vertical puro los apaga) — y un hemisferio
        (cielo azul arriba, rebote terroso abajo) en lugar del ambient plano:
        las caras en sombra se tiñen, no se apagan.
      */}
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
