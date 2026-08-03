import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Quaternion, Vector3 } from 'three'
import { tuning } from '../tuning'
import { useGameStore, type ContextAction } from '../../state/gameStore'
import { PIPA_DOOR } from '../vehicle/pipaParts'
import { nearestInteractable } from '../world/interactableRegistry'
import { WATER_SOURCE } from '../world/layout'
import { canStartRefill } from './economy'

// Temporales de módulo: esto corre 10 veces por segundo, no vale la pena
// asignar vectores nuevos cada pasada.
const _door = new Vector3()
const _quat = new Quaternion()

/** Punto de la puerta del conductor en coordenadas del mundo. */
export function doorWorldPosition(out: Vector3, local = PIPA_DOOR) {
  const { pos, rot } = useGameStore.getState().vehicle
  out
    .set(local.x, local.y, local.z)
    .applyQuaternion(_quat.set(rot.x, rot.y, rot.z, rot.w))
  return out.set(out.x + pos.x, out.y + pos.y, out.z + pos.z)
}

/**
 * Escaneo de proximidad para el botón de contexto.
 *
 * Corre con throttle (cada 100 ms, no cada frame): la distancia a una puerta
 * no cambia lo suficiente en 16 ms como para justificar el costo.
 *
 * Solo decide QUÉ acción está disponible; ejecutarla es de Interaction.tsx.
 */
export function useInteractionScan() {
  const acc = useRef(0)

  useFrame((_state, delta) => {
    acc.current += delta
    if (acc.current < tuning.interaction.scanInterval) return
    acc.current = 0

    const s = useGameStore.getState()
    let action: ContextAction | null = null

    if (s.mode === 'ON_FOOT') {
      const p = s.player.pos
      // La pipa gana sobre un local si ambos están en rango: subirse es lo
      // específico y los locales están en la banqueta, no en la calle.
      doorWorldPosition(_door)
      const d = Math.hypot(_door.x - p.x, _door.y - p.y, _door.z - p.z)
      if (d < tuning.interaction.boardRadius) {
        action = { kind: 'BOARD', label: 'Subir' }
      } else {
        const cerca = nearestInteractable(p.x, p.y, p.z)
        if (cerca) {
          action = { kind: 'SERVICE', label: cerca.label, targetId: cerca.id }
        }
      }
    } else {
      // Bajarse solo con la pipa detenida, o saldrías en movimiento.
      if (Math.abs(s.vehicle.speed) < tuning.interaction.exitSpeed) {
        /*
         * El pozo no pasa por el registro de interactuables: ese es para
         * cosas que se alcanzan A PIE, y aquí lo que tiene que estar cerca
         * es la PIPA, que es la que carga. Detenida junto a la toma, cargar
         * gana sobre bajar; ya cargando (o llena, o sin dinero) el botón
         * vuelve a «Bajar».
         */
        const v = s.vehicle.pos
        const [px, py, pz] = WATER_SOURCE.pos
        const d = Math.hypot(px - v.x, py - v.y, pz - v.z)
        const { liters, money } = s.economy
        if (
          !s.refill.active &&
          d < tuning.interaction.pozoRadius &&
          canStartRefill(liters, money)
        ) {
          action = { kind: 'REFILL', label: 'Cargar agua' }
        } else {
          action = { kind: 'EXIT', label: 'Bajar' }
        }
      }
    }

    s.setContextAction(action)
  })
}
