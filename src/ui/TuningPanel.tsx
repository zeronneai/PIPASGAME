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

  useControls('cámara (provisional)', {
    offsetY: {
      value: tuning.camera.offsetY,
      min: 1,
      max: 15,
      step: 0.5,
      onChange: (v: number) => void (tuning.camera.offsetY = v),
    },
    offsetZ: {
      value: tuning.camera.offsetZ,
      min: 2,
      max: 20,
      step: 0.5,
      onChange: (v: number) => void (tuning.camera.offsetZ = v),
    },
    followLerp: {
      value: tuning.camera.followLerp,
      min: 1,
      max: 20,
      step: 0.5,
      onChange: (v: number) => void (tuning.camera.followLerp = v),
    },
  })

  return <Leva collapsed />
}
