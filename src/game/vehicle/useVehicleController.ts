import { useCallback, useEffect, useRef, type RefObject } from 'react'
import {
  useBeforePhysicsStep,
  useRapier,
  type RapierRigidBody,
} from '@react-three/rapier'
import type { DynamicRayCastVehicleController } from '@dimforge/rapier3d-compat'
import { PHYSICS_STEP, tuning } from '../tuning'
import { useInputStore } from '../../state/inputStore'
import { useGameStore } from '../../state/gameStore'
import { computeDrive } from './driveModel'

/** Orden fijo de ruedas. Las de adelante giran, las de atrás empujan. */
export const WHEEL_COUNT = 4
const isFront = (i: number) => i < 2

/** Sin control: la pipa estacionada mientras vas a pie. */
const PARKED = { steer: 0, throttle: 0, brake: 0 }

/** Posición de anclaje de cada rueda respecto al centro del chasis. */
export function wheelAnchors() {
  const w = tuning.vehicle.wheel
  return [
    { x: w.halfTrack, y: w.connectionY, z: w.frontZ }, // 0 delantera izquierda
    { x: -w.halfTrack, y: w.connectionY, z: w.frontZ }, // 1 delantera derecha
    { x: w.halfTrack, y: w.connectionY, z: w.rearZ }, // 2 trasera izquierda
    { x: -w.halfTrack, y: w.connectionY, z: w.rearZ }, // 3 trasera derecha
  ]
}

/**
 * Controlador de la pipa sobre el DynamicRayCastVehicleController de Rapier.
 *
 * Aquí vive todo el tacto del manejo: el suavizado del volante, el tope que
 * se cierra con la velocidad, el freno motor y la reversa. Las fuentes de
 * volante (botones, giroscopio, joystick) solo escriben una intención cruda
 * en `input.drive.steer`, así que cambiar de fuente no cambia cómo se siente.
 */
export function useVehicleController(
  bodyRef: RefObject<RapierRigidBody | null>,
) {
  const { world } = useRapier()
  const controllerRef = useRef<DynamicRayCastVehicleController | null>(null)
  const steerAngle = useRef(0)
  // Últimas propiedades de masa aplicadas, para no recalcularlas cada paso ni
  // despertar el cuerpo sin razón. El Paso 7 va a moverlas cada frame.
  const lastMass = useRef({ mass: 0, comY: NaN })

  /**
   * Masa explícita de 12 t con el centro de masa abajo, más la inercia de una
   * caja de las dimensiones del chasis. Se calcula en vez de teclearse para
   * que ajustar el tamaño en leva no obligue a re-tunear la inercia a mano.
   */
  const applyMassProperties = useCallback((body: RapierRigidBody) => {
    const t = tuning.vehicle
    if (lastMass.current.mass === t.mass && lastMass.current.comY === t.comY) {
      return
    }
    const { width: a, height: b, length: c } = t.chassis
    const k = t.mass / 12
    body.setAdditionalMassProperties(
      t.mass,
      { x: 0, y: t.comY, z: 0 },
      {
        x: k * (b * b + c * c),
        y: k * (a * a + c * c),
        z: k * (a * a + b * b),
      },
      { x: 0, y: 0, z: 0, w: 1 },
      true,
    )
    lastMass.current = { mass: t.mass, comY: t.comY }
  }, [])

  /*
   * Creación perezosa, no en un useEffect de montaje: el ref del cuerpo lo
   * llena <RigidBody> y depender de ese orden es frágil. Si el efecto llegara
   * antes, el controlador no se crearía nunca y la pipa quedaría inerte sin
   * un solo error en consola. Así se crea en el primer paso de física que
   * encuentre el cuerpo listo.
   */
  const ensureController = useCallback(() => {
    if (controllerRef.current) return controllerRef.current
    const body = bodyRef.current
    if (!body) return null

    const controller = world.createVehicleController(body)
    controller.indexUpAxis = 1
    // Ojo: el getter se llama indexForwardAxis pero el setter de los bindings
    // se llama setIndexForwardAxis. No es un typo nuestro.
    controller.setIndexForwardAxis = 2

    const t = tuning.vehicle
    for (const anchor of wheelAnchors()) {
      controller.addWheel(
        anchor,
        { x: 0, y: -1, z: 0 }, // la suspensión y el raycast van hacia abajo
        { x: -1, y: 0, z: 0 }, // eje de giro de la rueda
        t.suspension.restLength,
        t.wheel.radius,
      )
    }

    applyMassProperties(body)
    controllerRef.current = controller
    return controller
  }, [world, bodyRef, applyMassProperties])

  useEffect(() => {
    const created = controllerRef
    return () => {
      if (created.current) world.removeVehicleController(created.current)
      created.current = null
      lastMass.current = { mass: 0, comY: NaN }
    }
  }, [world])

  useBeforePhysicsStep(() => {
    const controller = ensureController()
    const body = bodyRef.current
    if (!controller || !body) return

    const t = tuning.vehicle
    const veh = useGameStore.getState().vehicle
    const driving = useGameStore.getState().mode === 'DRIVING'
    const { drive } = useInputStore.getState()

    applyMassProperties(body)

    const speed = controller.currentVehicleSpeed()
    veh.speed = speed

    // Todo el tacto vive en computeDrive, que es una función pura: así el
    // banco de pruebas headless mide exactamente esta lógica.
    const cmd = computeDrive(
      speed,
      driving ? drive : PARKED,
      steerAngle.current,
      PHYSICS_STEP,
    )
    steerAngle.current = cmd.steer
    veh.steer = cmd.steer

    let onGround = 0
    for (let i = 0; i < WHEEL_COUNT; i++) {
      // Se reaplica cada paso para que los sliders de leva se sientan en vivo.
      controller.setWheelSuspensionStiffness(i, t.suspension.stiffness)
      controller.setWheelSuspensionCompression(i, t.suspension.compression)
      controller.setWheelSuspensionRelaxation(i, t.suspension.relaxation)
      controller.setWheelMaxSuspensionForce(i, t.suspension.maxForce)
      controller.setWheelMaxSuspensionTravel(i, t.suspension.maxTravel)
      controller.setWheelSuspensionRestLength(i, t.suspension.restLength)
      controller.setWheelRadius(i, t.wheel.radius)
      controller.setWheelFrictionSlip(i, t.frictionSlip)
      controller.setWheelSideFrictionStiffness(i, t.sideFrictionStiffness)

      controller.setWheelSteering(i, isFront(i) ? cmd.steer : 0)
      controller.setWheelEngineForce(i, isFront(i) ? 0 : cmd.engine)
      controller.setWheelBrake(i, isFront(i) ? cmd.brakeFront : cmd.brakeRear)
      if (controller.wheelIsInContact(i)) onGround++
    }
    veh.wheelsOnGround = onGround

    controller.updateVehicle(PHYSICS_STEP)
  })

  return controllerRef
}
