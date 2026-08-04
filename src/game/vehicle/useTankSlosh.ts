import { useRef } from 'react'
import type {
  DynamicRayCastVehicleController,
  RigidBody,
} from '@dimforge/rapier3d-compat'
import {
  createSloshState,
  localAccel,
  stepSlosh,
  type SloshState,
} from './sloshModel'
import { useGameStore } from '../../state/gameStore'

/**
 * Mide la aceleración de la pipa y mueve el agua con ella.
 *
 * Toda la matemática vive en sloshModel.ts como funciones puras, para que el
 * banco headless mida exactamente esto. Aquí solo queda el pegamento: leer el
 * cuerpo y guardar la velocidad del paso anterior.
 *
 * Devuelve el estado del agua, que useVehicleController aplica como offset
 * del centro de masa.
 */
export function useTankSlosh() {
  const state = useRef<SloshState>(createSloshState())
  const prevSpeed = useRef(0)

  /** Se llama una vez por paso de física, con dt fijo. */
  const update = (
    controller: DynamicRayCastVehicleController,
    body: RigidBody,
    dt: number,
  ): SloshState => {
    const vehicle = useGameStore.getState().vehicle

    // El enderezado de una volcadura pide agua quieta: el estado que quedó
    // de estar de lado es basura y volvería a tumbar la pipa al aterrizar.
    if (vehicle.sloshReset) {
      state.current = createSloshState()
      prevSpeed.current = 0
      vehicle.sloshReset = false
    }

    const speed = controller.currentVehicleSpeed()
    const accel = localAccel(speed, prevSpeed.current, body.angvel().y, dt)
    prevSpeed.current = speed

    stepSlosh(state.current, accel.x, accel.z, vehicle.fillLevel, dt)

    vehicle.slosh.x = state.current.x
    vehicle.slosh.z = state.current.z
    return state.current
  }

  return update
}
