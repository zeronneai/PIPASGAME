import type { RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import type { RapierRigidBody } from '@react-three/rapier'
import { Vector3 } from 'three'
import { useGameStore } from '../../state/gameStore'
import { PIPA_EXIT } from '../vehicle/pipaParts'
import { doorWorldPosition, useInteractionScan } from './useInteractionScan'

const _exit = new Vector3()

/**
 * Une el escaneo de proximidad con la ejecución de subir y bajar.
 *
 * El botón vive en el DOM y no puede tocar Rapier, así que solo deja una
 * acción pendiente en el store; aquí, ya dentro del Canvas y con los cuerpos
 * a la mano, se ejecuta. Así el store nunca guarda objetos de física.
 */
export function Interaction({
  playerBody,
  vehicleBody,
}: {
  playerBody: RefObject<RapierRigidBody | null>
  vehicleBody: RefObject<RapierRigidBody | null>
}) {
  useInteractionScan()

  useFrame(() => {
    const store = useGameStore.getState()

    // Espejo del transform de la pipa hacia el store (sección 6: su posición
    // vive en el store, no en el componente).
    const vb = vehicleBody.current
    if (vb) {
      const t = vb.translation()
      const r = vb.rotation()
      const v = store.vehicle
      v.pos.x = t.x
      v.pos.y = t.y
      v.pos.z = t.z
      v.rot.x = r.x
      v.rot.y = r.y
      v.rot.z = r.z
      v.rot.w = r.w
    }

    const pending = store.consumePendingAction()
    if (!pending) return

    if (pending.kind === 'REFILL') {
      // Solo abre la sesión; el tick corre en Refill.tsx y cortar puede
      // venir del medidor en el DOM, que habla directo con el store.
      store.startRefill()
      return
    }

    if (pending.kind === 'SERVICE') {
      // Toda la aceptación vive en el store (Paso 3): aquí solo se dispara.
      if (pending.targetId) store.offerService(pending.targetId)
      return
    }

    if (pending.kind === 'DELIVER') {
      // Igual que SERVICE: la lógica vive en el store, el minijuego en el DOM.
      if (pending.targetId) store.startDelivery(pending.targetId)
      return
    }

    const pb = playerBody.current
    if (!pb) return

    if (pending.kind === 'BOARD') {
      // Se saca de la simulación: si solo se ocultara, la cápsula seguiría
      // ahí como obstáculo y la pipa chocaría contra su propio conductor.
      pb.setEnabled(false)
      store.setMode('DRIVING')
    } else {
      doorWorldPosition(_exit, PIPA_EXIT)
      pb.setEnabled(true)
      pb.setTranslation({ x: _exit.x, y: _exit.y, z: _exit.z }, true)
      // También el destino cinemático: si no, el cuerpo regresa de un salto
      // al que tenía guardado desde antes de subirse.
      pb.setNextKinematicTranslation({ x: _exit.x, y: _exit.y, z: _exit.z })
      // Y el espejo del store, que es de donde la cámara arranca la
      // transición de regreso; con el valor viejo daría un tirón al inicio.
      store.player.pos.x = _exit.x
      store.player.pos.y = _exit.y
      store.player.pos.z = _exit.z
      store.setMode('ON_FOOT')
    }
  })

  return null
}
