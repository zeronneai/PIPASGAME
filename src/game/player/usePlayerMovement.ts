import { useEffect, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { useRapier, type RapierRigidBody } from '@react-three/rapier'
import { Vector3, type Group } from 'three'
import type { KinematicCharacterController } from '@dimforge/rapier3d-compat'
import { tuning } from '../tuning'
import { useInputStore } from '../../state/inputStore'
import { useGameStore } from '../../state/gameStore'

// Temporales a nivel de módulo para no crear objetos cada frame
const _forward = new Vector3()
const _right = new Vector3()
const _targetVel = new Vector3()

export function usePlayerMovement(
  bodyRef: RefObject<RapierRigidBody | null>,
  visualRef: RefObject<Group | null>,
) {
  const { world } = useRapier()
  const controllerRef = useRef<KinematicCharacterController | null>(null)
  const velocity = useRef(new Vector3())
  const verticalVel = useRef(0)
  const grounded = useRef(true)
  const wasDriving = useRef(false)

  useEffect(() => {
    const controller = world.createCharacterController(0.05)
    controller.enableAutostep(0.3, 0.2, true)
    controller.enableSnapToGround(0.3)
    controller.setApplyImpulsesToDynamicBodies(true)
    controllerRef.current = controller
    return () => {
      world.removeCharacterController(controller)
      controllerRef.current = null
    }
  }, [world])

  useFrame((state, delta) => {
    const body = bodyRef.current
    const controller = controllerRef.current
    if (!body || !controller) return
    const collider = body.collider(0)
    if (!collider) return

    const dt = Math.min(delta, 1 / 30)
    const t = tuning.player
    const { move } = useInputStore.getState()
    const { player, mode } = useGameStore.getState()

    // Manejando el cuerpo está deshabilitado: moverlo aquí sería mover un
    // cuerpo fuera de la simulación.
    if (mode === 'DRIVING') {
      wasDriving.current = true
      return
    }
    if (wasDriving.current) {
      // Al bajarse arranca quieto, o heredaría la velocidad que traía al subir.
      wasDriving.current = false
      velocity.current.set(0, 0, 0)
      verticalVel.current = 0
      player.speed = 0
    }

    // Dirección relativa a la cámara (solo el yaw, aplanado al piso)
    _forward.set(0, 0, -1).applyQuaternion(state.camera.quaternion)
    _forward.y = 0
    _forward.normalize()
    _right.set(1, 0, 0).applyQuaternion(state.camera.quaternion)
    _right.y = 0
    _right.normalize()

    const mag = Math.min(1, Math.hypot(move.x, move.y))

    // Correr: automático con el joystick al tope, limitado por resistencia.
    // Histéresis: al agotarse no puede correr hasta recuperar staminaRecover.
    if (player.exhausted && player.stamina >= t.staminaRecover) {
      player.exhausted = false
    }
    const running = mag >= t.runThreshold && !player.exhausted
    if (running) {
      player.stamina = Math.max(0, player.stamina - t.staminaDrain * dt)
      if (player.stamina === 0) player.exhausted = true
    } else {
      player.stamina = Math.min(1, player.stamina + t.staminaRegen * dt)
    }
    player.running = running

    // Aceleración y desaceleración suaves (independientes del framerate)
    const maxSpeed = running ? t.runSpeed : t.walkSpeed
    _targetVel
      .copy(_forward)
      .multiplyScalar(move.y)
      .addScaledVector(_right, move.x)
      .multiplyScalar(maxSpeed)
    const rate =
      _targetVel.lengthSq() > velocity.current.lengthSq() ? t.accel : t.decel
    velocity.current.lerp(_targetVel, 1 - Math.exp(-rate * dt))
    player.speed = velocity.current.length()

    // Gravedad: pegado al piso empuja un poco hacia abajo para el snap
    verticalVel.current = grounded.current
      ? -1
      : verticalVel.current - t.gravity * dt

    // Mover con el character controller (resuelve colisiones y escalones)
    controller.computeColliderMovement(collider, {
      x: velocity.current.x * dt,
      y: verticalVel.current * dt,
      z: velocity.current.z * dt,
    })
    grounded.current = controller.computedGrounded()
    const m = controller.computedMovement()
    const pos = body.translation()
    body.setNextKinematicTranslation({
      x: pos.x + m.x,
      y: pos.y + m.y,
      z: pos.z + m.z,
    })
    player.pos.x = pos.x + m.x
    player.pos.y = pos.y + m.y
    player.pos.z = pos.z + m.z

    // Rotación suave del modelo hacia la dirección de movimiento
    const visual = visualRef.current
    if (visual && mag > 0 && player.speed > 0.2) {
      const target = Math.atan2(velocity.current.x, velocity.current.z)
      let diff = target - visual.rotation.y
      diff = ((((diff + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI
      visual.rotation.y += diff * (1 - Math.exp(-t.turnSpeed * dt))
    }
  })
}
