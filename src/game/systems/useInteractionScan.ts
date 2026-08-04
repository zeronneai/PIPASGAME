import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Quaternion, Vector3 } from 'three'
import { balance } from '../balance'
import { tuning } from '../tuning'
import {
  capacidadPipa,
  statsPipa,
  useGameStore,
  type ContextAction,
} from '../../state/gameStore'
import { PIPA_DOOR } from '../vehicle/pipaParts'
import { nearestInteractable } from '../world/interactableRegistry'
import { taller, WATER_SOURCE } from '../world/layout'
import { canStartRefill } from './economy'

// Temporales de módulo: esto corre 10 veces por segundo, no vale la pena
// asignar vectores nuevos cada pasada.
const _door = new Vector3()
const _quat = new Quaternion()

/**
 * Punto de la puerta del conductor en coordenadas del mundo.
 *
 * El punto local se escala en planta con el modelo equipado: la puerta de la
 * grandota queda más lejos del centro que la de la heredada. La Y no: es un
 * ajuste contra la altura del personaje, que no cambia de tamaño.
 */
export function doorWorldPosition(out: Vector3, local = PIPA_DOOR) {
  const { pos, rot } = useGameStore.getState().vehicle
  const escala = statsPipa().escala
  out
    .set(local.x * escala, local.y, local.z * escala)
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
        const v = s.vehicle.pos

        /*
         * Entregar gana sobre todo (Paso 5): si estás detenido junto al
         * PUNTO DE ENTREGA de un pedido —el domicilio, ya no el negocio
         * donde lo conseguiste—, a eso viniste. Se mide de la PIPA al
         * punto (sección 2.6). Con varios cerca gana el más próximo.
         */
        let entregaId: string | null = null
        let entregaDist = tuning.interaction.deliverRadius
        for (const o of s.economy.orders) {
          const [dx, dy, dz] = o.delivery
          const d = Math.hypot(dx - v.x, dy - v.y, dz - v.z)
          if (d < entregaDist) {
            entregaId = o.clientId
            entregaDist = d
          }
        }

        /*
         * El pozo no pasa por el registro de interactuables: ese es para
         * cosas que se alcanzan A PIE, y aquí lo que tiene que estar cerca
         * es la PIPA, que es la que carga. Detenida junto a la toma, cargar
         * gana sobre bajar; ya cargando (o llena, o sin dinero) el botón
         * vuelve a «Bajar».
         */
        const [px, py, pz] = WATER_SOURCE.pos
        const dPozo = Math.hypot(px - v.x, py - v.y, pz - v.z)
        // Y el taller, con el mismo criterio: se llega manejando, así que lo
        // que se mide es la pipa contra el portón.
        const [tx, ty, tz] = taller.door
        const dTaller = Math.hypot(tx - v.x, ty - v.y, tz - v.z)
        const { liters, money } = s.economy

        if (entregaId && !s.delivery) {
          action = { kind: 'DELIVER', label: 'Entregar agua', targetId: entregaId }
        } else if (
          !s.refill.active &&
          dPozo < tuning.interaction.pozoRadius &&
          canStartRefill(liters, money, balance, capacidadPipa())
        ) {
          action = { kind: 'REFILL', label: 'Cargar agua' }
        } else if (!s.tallerAbierto && dTaller < tuning.interaction.tallerRadius) {
          action = { kind: 'TALLER', label: 'Entrar al taller' }
        } else {
          action = { kind: 'EXIT', label: 'Bajar' }
        }
      }
    }

    s.setContextAction(action)
  })
}
