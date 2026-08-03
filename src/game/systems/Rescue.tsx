import { useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import type { RapierRigidBody } from '@react-three/rapier'
import { Quaternion, Vector3 } from 'three'
import { balance } from '../balance'
import { tuning } from '../tuning'
import { STREET_CENTERS } from '../world/layout'
import { useGameStore } from '../../state/gameStore'

const _fwd = new Vector3()
const _q = new Quaternion()
const _up = new Vector3(0, 1, 0)

/** La calle del anillo perimetral: terreno firme pegado al borde. */
const ANILLO = Math.max(...STREET_CENTERS)

const clampAnillo = (n: number) => Math.min(ANILLO, Math.max(-ANILLO, n))

/**
 * El punto firme del BORDE más cercano a donde caíste: el candidato más
 * próximo de las cuatro calles del anillo. Reaparecer ahí, y no donde
 * estabas, es parte del castigo: el regreso a la ruta corre por tu cuenta.
 */
function bordeCercano(x: number, z: number): { x: number; z: number } {
  const candidatos = [
    { x: ANILLO, z: clampAnillo(z) },
    { x: -ANILLO, z: clampAnillo(z) },
    { x: clampAnillo(x), z: ANILLO },
    { x: clampAnillo(x), z: -ANILLO },
  ]
  let mejor = candidatos[0]
  let mejorD = Infinity
  for (const c of candidatos) {
    const d = Math.hypot(c.x - x, c.z - z)
    if (d < mejorD) {
      mejor = c
      mejorD = d
    }
  }
  return mejor
}

type Fase = 'IDLE' | 'OSCURECE' | 'ACLARA'

/**
 * Rescate por caída (sin paredes: caerse del mapa es posible y es tuyo).
 * Al caer bajo tuning.rescue.belowY: fundido a negro, teletransporte al
 * borde más cercano con la pantalla en negro, y fundido de regreso. Sin
 * cobro — el reloj de la jornada nunca se detiene y eso ya cuesta.
 *
 * Si ibas manejando, la pipa se rescata contigo dentro (el modo no cambia).
 * Si la pipa cae sola (un empujón con nadie al volante), se rescata en
 * silencio: el fundido es para tus ojos, no para los de ella.
 */
export function Rescue({
  playerBody,
  vehicleBody,
}: {
  playerBody: RefObject<RapierRigidBody | null>
  vehicleBody: RefObject<RapierRigidBody | null>
}) {
  const fase = useRef<Fase>('IDLE')
  const t = useRef(0)
  const objetivo = useRef<'PIPA' | 'JUGADOR'>('JUGADOR')
  const punto = useRef({ x: 0, z: 0 })

  const rescatarPipa = (x: number, z: number) => {
    const vb = vehicleBody.current
    if (!vb) return
    const s = useGameStore.getState()
    // Solo el rumbo sobrevive: cabeceo y vuelco se descartan.
    const r = s.vehicle.rot
    _fwd.set(0, 0, 1).applyQuaternion(_q.set(r.x, r.y, r.z, r.w))
    _q.setFromAxisAngle(_up, Math.atan2(_fwd.x, _fwd.z))
    vb.setTranslation({ x, y: tuning.rescue.dropY, z }, true)
    vb.setRotation(_q, true)
    vb.setLinvel({ x: 0, y: 0, z: 0 }, true)
    vb.setAngvel({ x: 0, y: 0, z: 0 }, true)
  }

  const rescatarJugador = (x: number, z: number) => {
    const pb = playerBody.current
    if (!pb) return
    const s = useGameStore.getState()
    const y = tuning.rescue.dropY - 1.5
    pb.setTranslation({ x, y, z }, true)
    // Kinemático: sin el destino, el siguiente frame lo regresa al hoyo.
    pb.setNextKinematicTranslation({ x, y, z })
    s.player.pos.x = x
    s.player.pos.y = y
    s.player.pos.z = z
  }

  useFrame((_state, delta) => {
    const s = useGameStore.getState()
    const { belowY } = tuning.rescue
    const media = balance.rescate.pausaSegundos / 2

    if (fase.current === 'IDLE') {
      const driving = s.mode === 'DRIVING'
      if (driving && s.vehicle.pos.y < belowY) {
        objetivo.current = 'PIPA'
        punto.current = bordeCercano(s.vehicle.pos.x, s.vehicle.pos.z)
      } else if (!driving && s.player.pos.y < belowY) {
        objetivo.current = 'JUGADOR'
        punto.current = bordeCercano(s.player.pos.x, s.player.pos.z)
      } else {
        // La pipa vacía que alguien empujó al vacío regresa sin ceremonia.
        if (!driving && s.vehicle.pos.y < belowY) {
          const p = bordeCercano(s.vehicle.pos.x, s.vehicle.pos.z)
          rescatarPipa(p.x, p.z)
          s.showNotice('La grúa sacó la pipa del barranco')
        }
        return
      }
      fase.current = 'OSCURECE'
      t.current = 0
      s.setRescueFade(true)
      return
    }

    t.current += delta

    if (fase.current === 'OSCURECE' && t.current >= media) {
      // Pantalla en negro: nadie ve el teletransporte, que es la gracia.
      const { x, z } = punto.current
      if (objetivo.current === 'PIPA') rescatarPipa(x, z)
      else rescatarJugador(x, z)
      fase.current = 'ACLARA'
      s.setRescueFade(false)
      s.showNotice(
        objetivo.current === 'PIPA'
          ? 'La grúa los sacó del barranco'
          : 'De regreso al borde del mapa',
      )
      return
    }

    if (fase.current === 'ACLARA' && t.current >= media * 2) {
      fase.current = 'IDLE'
    }
  })

  return null
}
