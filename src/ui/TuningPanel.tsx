import { Leva, useControls } from 'leva'
import { tuning } from '../game/tuning'

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
  })

  return <Leva collapsed />
}
