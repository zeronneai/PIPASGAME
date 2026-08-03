import { Leva, useControls } from 'leva'
import { tuning } from '../game/tuning'
import { useGameStore } from '../state/gameStore'
import { STEERING_SOURCES, type SteeringId } from '../game/vehicle/steering'

/**
 * Panel de leva (solo en desarrollo, se carga con lazy import). Cada
 * control escribe directo en el objeto `tuning` vía onChange (updates
 * transitorios, sin re-renders); el juego lo lee cada frame.
 */
export default function TuningPanel() {
  useControls('jugador', {
    walkSpeed: {
      value: tuning.player.walkSpeed,
      min: 1,
      max: 12,
      step: 0.1,
      onChange: (v: number) => void (tuning.player.walkSpeed = v),
    },
    runSpeed: {
      value: tuning.player.runSpeed,
      min: 1,
      max: 15,
      step: 0.1,
      onChange: (v: number) => void (tuning.player.runSpeed = v),
    },
    accel: {
      value: tuning.player.accel,
      min: 1,
      max: 40,
      step: 0.5,
      onChange: (v: number) => void (tuning.player.accel = v),
    },
    decel: {
      value: tuning.player.decel,
      min: 1,
      max: 40,
      step: 0.5,
      onChange: (v: number) => void (tuning.player.decel = v),
    },
    turnSpeed: {
      value: tuning.player.turnSpeed,
      min: 1,
      max: 30,
      step: 0.5,
      onChange: (v: number) => void (tuning.player.turnSpeed = v),
    },
    gravity: {
      value: tuning.player.gravity,
      min: 5,
      max: 50,
      step: 0.5,
      onChange: (v: number) => void (tuning.player.gravity = v),
    },
    staminaDrain: {
      value: tuning.player.staminaDrain,
      min: 0.05,
      max: 1,
      step: 0.01,
      onChange: (v: number) => void (tuning.player.staminaDrain = v),
    },
    staminaRegen: {
      value: tuning.player.staminaRegen,
      min: 0.05,
      max: 1,
      step: 0.01,
      onChange: (v: number) => void (tuning.player.staminaRegen = v),
    },
  })

  useControls('cámara', {
    distance: {
      value: tuning.camera.distance,
      min: 2,
      max: 15,
      step: 0.25,
      onChange: (v: number) => void (tuning.camera.distance = v),
    },
    height: {
      value: tuning.camera.height,
      min: 0.5,
      max: 3,
      step: 0.1,
      onChange: (v: number) => void (tuning.camera.height = v),
    },
    followLerp: {
      value: tuning.camera.followLerp,
      min: 1,
      max: 25,
      step: 0.5,
      onChange: (v: number) => void (tuning.camera.followLerp = v),
    },
    sensitivity: {
      value: tuning.camera.sensitivity,
      min: 0.001,
      max: 0.02,
      step: 0.0005,
      onChange: (v: number) => void (tuning.camera.sensitivity = v),
    },
    minPitch: {
      value: tuning.camera.minPitch,
      min: -60,
      max: 0,
      step: 1,
      onChange: (v: number) => void (tuning.camera.minPitch = v),
    },
    maxPitch: {
      value: tuning.camera.maxPitch,
      min: 10,
      max: 85,
      step: 1,
      onChange: (v: number) => void (tuning.camera.maxPitch = v),
    },
    minDistance: {
      value: tuning.camera.minDistance,
      min: 0.5,
      max: 4,
      step: 0.1,
      onChange: (v: number) => void (tuning.camera.minDistance = v),
    },
    collisionRadius: {
      value: tuning.camera.collisionRadius,
      min: 0.1,
      max: 1,
      step: 0.05,
      onChange: (v: number) => void (tuning.camera.collisionRadius = v),
    },
    returnLerp: {
      value: tuning.camera.returnLerp,
      min: 0.5,
      max: 15,
      step: 0.5,
      onChange: (v: number) => void (tuning.camera.returnLerp = v),
    },
    fovFoot: {
      value: tuning.camera.fovFoot,
      min: 50,
      max: 95,
      step: 1,
      onChange: (v: number) => void (tuning.camera.fovFoot = v),
    },
    fovDrive: {
      value: tuning.camera.fovDrive,
      min: 50,
      max: 95,
      step: 1,
      onChange: (v: number) => void (tuning.camera.fovDrive = v),
    },
    driveDistance: {
      value: tuning.camera.driveDistance,
      min: 4,
      max: 25,
      step: 0.5,
      onChange: (v: number) => void (tuning.camera.driveDistance = v),
    },
    driveHeight: {
      value: tuning.camera.driveHeight,
      min: 0.5,
      max: 8,
      step: 0.1,
      onChange: (v: number) => void (tuning.camera.driveHeight = v),
    },
    driveRecenter: {
      value: tuning.camera.driveRecenter,
      min: 0,
      max: 8,
      step: 0.1,
      onChange: (v: number) => void (tuning.camera.driveRecenter = v),
    },
  })

  useControls('interacción', {
    boardRadius: {
      value: tuning.interaction.boardRadius,
      min: 1,
      max: 10,
      step: 0.25,
      onChange: (n: number) => void (tuning.interaction.boardRadius = n),
    },
    exitSpeed: {
      value: tuning.interaction.exitSpeed,
      min: 0.05,
      max: 3,
      step: 0.05,
      onChange: (n: number) => void (tuning.interaction.exitSpeed = n),
    },
    modeTransition: {
      value: tuning.camera.modeTransition,
      min: 0.1,
      max: 2,
      step: 0.05,
      onChange: (n: number) => void (tuning.camera.modeTransition = n),
    },
  })

  const v = tuning.vehicle
  useControls('pipa · manejo', {
    // El desplegable se arma solo desde el registro: cuando entren el
    // giroscopio y el joystick horizontal aparecen aquí sin tocar nada.
    volante: {
      value: useGameStore.getState().steeringId,
      options: Object.fromEntries(
        STEERING_SOURCES.map((s) => [s.label, s.id]),
      ) as Record<string, SteeringId>,
      onChange: (id: SteeringId) => useGameStore.getState().setSteeringId(id),
    },
    tareMass: {
      value: v.tareMass,
      min: 1000,
      max: 16000,
      step: 250,
      onChange: (n: number) => void (v.tareMass = n),
    },
    waterMass: {
      value: v.waterMass,
      min: 0,
      max: 16000,
      step: 250,
      onChange: (n: number) => void (v.waterMass = n),
    },
    comY: {
      value: v.comY,
      min: -2,
      max: 1,
      step: 0.05,
      onChange: (n: number) => void (v.comY = n),
    },
    engineForce: {
      value: v.engineForce,
      min: 1000,
      max: 40000,
      step: 250,
      onChange: (n: number) => void (v.engineForce = n),
    },
    // Ojo: brakeForce y engineBrake son IMPULSOS, no newtons como
    // engineForce. Por eso los rangos son dos órdenes de magnitud menores.
    brakeForce: {
      value: v.brakeForce,
      min: 50,
      max: 2000,
      step: 10,
      onChange: (n: number) => void (v.brakeForce = n),
    },
    engineBrake: {
      value: v.engineBrake,
      min: 0,
      max: 600,
      step: 5,
      onChange: (n: number) => void (v.engineBrake = n),
    },
    maxSpeed: {
      value: v.maxSpeed,
      min: 4,
      max: 40,
      step: 0.5,
      onChange: (n: number) => void (v.maxSpeed = n),
    },
    frictionSlip: {
      value: v.frictionSlip,
      min: 0.5,
      max: 12,
      step: 0.1,
      onChange: (n: number) => void (v.frictionSlip = n),
    },
    sideFrictionStiffness: {
      value: v.sideFrictionStiffness,
      min: 0.1,
      max: 4,
      step: 0.05,
      onChange: (n: number) => void (v.sideFrictionStiffness = n),
    },
    angularDamping: {
      value: v.angularDamping,
      min: 0,
      max: 4,
      step: 0.05,
      onChange: (n: number) => void (v.angularDamping = n),
    },
  })

  useControls('pipa · chapoteo', {
    // fillLevel es estado de juego, no un ajuste: escribe al store, no a
    // tuning. Está aquí para poder probar todos los niveles sin llenar el
    // tanque, hasta que el Paso 9 lo llene en la toma de agua.
    fillLevel: {
      value: useGameStore.getState().vehicle.fillLevel,
      min: 0,
      max: 1,
      step: 0.05,
      onChange: (n: number) =>
        void (useGameStore.getState().vehicle.fillLevel = n),
    },
    response: {
      value: tuning.slosh.response,
      min: 0,
      max: 0.3,
      step: 0.005,
      onChange: (n: number) => void (tuning.slosh.response = n),
    },
    stiffness: {
      value: tuning.slosh.stiffness,
      min: 0.5,
      max: 30,
      step: 0.5,
      onChange: (n: number) => void (tuning.slosh.stiffness = n),
    },
    // Por encima de 2·√rigidez el chapoteo desaparece: el agua llega tarde
    // pero ya no sobrepasa ni se sigue moviendo.
    damping: {
      value: tuning.slosh.damping,
      min: 0,
      max: 12,
      step: 0.1,
      onChange: (n: number) => void (tuning.slosh.damping = n),
    },
    maxOffset: {
      value: tuning.slosh.maxOffset,
      min: 0.1,
      max: 2,
      step: 0.05,
      onChange: (n: number) => void (tuning.slosh.maxOffset = n),
    },
  })

  useControls('pipa · volante', {
    maxDeg: {
      value: v.steer.maxDeg,
      min: 5,
      max: 45,
      step: 1,
      onChange: (n: number) => void (v.steer.maxDeg = n),
    },
    speedFalloff: {
      value: v.steer.speedFalloff,
      min: 0.05,
      max: 1,
      step: 0.05,
      onChange: (n: number) => void (v.steer.speedFalloff = n),
    },
    speed: {
      value: v.steer.speed,
      min: 0.2,
      max: 6,
      step: 0.1,
      onChange: (n: number) => void (v.steer.speed = n),
    },
    returnSpeed: {
      value: v.steer.returnSpeed,
      min: 0.2,
      max: 8,
      step: 0.1,
      onChange: (n: number) => void (v.steer.returnSpeed = n),
    },
  })

  useControls('pipa · suspensión', {
    stiffness: {
      value: v.suspension.stiffness,
      min: 5,
      max: 120,
      step: 1,
      onChange: (n: number) => void (v.suspension.stiffness = n),
    },
    compression: {
      value: v.suspension.compression,
      min: 0,
      max: 6,
      step: 0.1,
      onChange: (n: number) => void (v.suspension.compression = n),
    },
    relaxation: {
      value: v.suspension.relaxation,
      min: 0,
      max: 8,
      step: 0.1,
      onChange: (n: number) => void (v.suspension.relaxation = n),
    },
    restLength: {
      value: v.suspension.restLength,
      min: 0.1,
      max: 1.2,
      step: 0.05,
      onChange: (n: number) => void (v.suspension.restLength = n),
    },
    maxForce: {
      value: v.suspension.maxForce,
      min: 10000,
      max: 400000,
      step: 5000,
      onChange: (n: number) => void (v.suspension.maxForce = n),
    },
    maxTravel: {
      value: v.suspension.maxTravel,
      min: 0.05,
      max: 1,
      step: 0.05,
      onChange: (n: number) => void (v.suspension.maxTravel = n),
    },
  })

  return <Leva collapsed />
}
