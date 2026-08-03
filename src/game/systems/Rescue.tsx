import type { RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import type { RapierRigidBody } from '@react-three/rapier'
import { Quaternion, Vector3 } from 'three'
import { tuning } from '../tuning'
import { STREET_CENTERS } from '../world/layout'
import { useGameStore } from '../../state/gameStore'

const _fwd = new Vector3()
const _q = new Quaternion()
const _up = new Vector3(0, 1, 0)

/** La calle del anillo perimetral: el punto firme más cercano al borde. */
const ANILLO = Math.max(...STREET_CENTERS)

/** Recorta al anillo: quien cayó por el borde reaparece sobre esa calle;
 *  quien cayó dentro del mapa estaba parado en un lugar válido y regresa ahí. */
const alMapa = (n: number) => Math.min(ANILLO, Math.max(-ANILLO, n))

/**
 * Plano de rescate (bugfix): si el jugador o la pipa caen debajo de
 * tuning.rescue.belowY —las paredes del borde son la primera línea; esto
 * cubre cualquier rendija—, se les regresa a terreno firme.
 *
 * La pipa conserva el rumbo pero se endereza (volcada no sirve de nada), y
 * se le apagan las velocidades para que no siga «cayendo» al aterrizar.
 */
export function Rescue({
  playerBody,
  vehicleBody,
}: {
  playerBody: RefObject<RapierRigidBody | null>
  vehicleBody: RefObject<RapierRigidBody | null>
}) {
  useFrame(() => {
    const s = useGameStore.getState()
    const { belowY, dropY } = tuning.rescue

    const vb = vehicleBody.current
    if (vb && s.vehicle.pos.y < belowY) {
      const x = alMapa(s.vehicle.pos.x)
      const z = alMapa(s.vehicle.pos.z)
      // Solo el rumbo sobrevive: cabeceo y vuelco se descartan.
      const r = s.vehicle.rot
      _fwd.set(0, 0, 1).applyQuaternion(_q.set(r.x, r.y, r.z, r.w))
      _q.setFromAxisAngle(_up, Math.atan2(_fwd.x, _fwd.z))
      vb.setTranslation({ x, y: dropY, z }, true)
      vb.setRotation(_q, true)
      vb.setLinvel({ x: 0, y: 0, z: 0 }, true)
      vb.setAngvel({ x: 0, y: 0, z: 0 }, true)
      s.showNotice('La grúa sacó la pipa del barranco')
    }

    // Manejando, el cuerpo del jugador está deshabilitado y su posición es
    // vieja: solo se rescata a pie.
    const pb = playerBody.current
    if (pb && s.mode === 'ON_FOOT' && s.player.pos.y < belowY) {
      const x = alMapa(s.player.pos.x)
      const z = alMapa(s.player.pos.z)
      const y = dropY - 1.5 // la cápsula no necesita caer desde tan alto
      pb.setTranslation({ x, y, z }, true)
      // Kinemático: sin el destino, el siguiente frame lo regresa al hoyo.
      pb.setNextKinematicTranslation({ x, y, z })
      s.player.pos.x = x
      s.player.pos.y = y
      s.player.pos.z = z
      s.showNotice('De regreso a la banqueta')
    }
  })

  return null
}
