import { useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import type { RapierRigidBody } from '@react-three/rapier'
import { Quaternion, Vector3 } from 'three'
import { balance } from '../balance'
import { tuning } from '../tuning'
import { poseEnCalle } from '../world/layout'
import { statsPipa, useGameStore } from '../../state/gameStore'
import { derrameVolcadura, estaVolcada } from './volcaduraModel'

const _fwd = new Vector3()
const _q = new Quaternion()
const _up = new Vector3(0, 1, 0)

type Fase = 'IDLE' | 'OSCURECE' | 'ACLARA'

/**
 * La volcadura (mismo molde que Rescue.tsx: refs + useFrame, sin estado
 * React). Si la pipa se queda de lado, el controlador de rapier muere solo —
 * los raycasts de suspensión apuntan al cielo — y sin esto la partida se
 * traba para siempre.
 *
 * Dos mitades:
 *   1. DETECCIÓN: inclinación sostenida (tuning.vuelco) marca
 *      vehicle.volcada, y el escaneo de contexto ofrece «Enderezar».
 *   2. ENDEREZADO: el botón deja `enderezando` en el store; aquí se funde a
 *      negro (mismo overlay del rescate), se reaparece la pipa DERECHA sobre
 *      la calle más cercana y se derrama agua según lo brusco del golpe.
 *
 * El castigo es tiempo y agua, no dinero. Si ibas manejando sigues dentro
 * (la puerta de una pipa volcada no es salida); a pie, te quedas donde estás.
 */
export function Volcadura({
  vehicleBody,
}: {
  vehicleBody: RefObject<RapierRigidBody | null>
}) {
  const fase = useRef<Fase>('IDLE')
  const t = useRef(0)
  /** Segundos que lleva inclinada sin llegar aún a «volcada». */
  const inclinada = useRef(0)
  /** |velocidad| máxima desde que empezó a irse de lado. */
  const golpe = useRef(0)

  const enderezar = () => {
    const vb = vehicleBody.current
    if (!vb) return
    const s = useGameStore.getState()
    const veh = s.vehicle
    const stats = statsPipa()

    // El rumbo actual: la pose lo conserva lo más posible.
    const r = veh.rot
    _fwd.set(0, 0, 1).applyQuaternion(_q.set(r.x, r.y, r.z, r.w))
    const rumbo = Math.atan2(_fwd.x, _fwd.z)

    // La pose de calle más cercana donde quepa ESTA pipa COMPLETA (ancho y
    // largo: con solo el ancho, la trompa queda encallada en la manzana); si
    // el mundo no coopera (no debería, hay test), se endereza en el sitio.
    // A pie, esquiva al jugador: reaparecerle la pipa encima la deja
    // recargada en su cápsula (cinemática, no se aparta) y volcada otra vez.
    const evitar =
      s.mode === 'ON_FOOT'
        ? { x: s.player.pos.x, z: s.player.pos.z, r: 5 }
        : null
    const pose = poseEnCalle(
      veh.pos.x,
      veh.pos.z,
      stats.fisica.chassis.width / 2 + 0.3,
      stats.fisica.chassis.length / 2 + 0.3,
      rumbo,
      evitar,
    ) ?? { x: veh.pos.x, z: veh.pos.z, yaw: rumbo }

    _q.setFromAxisAngle(_up, pose.yaw)
    vb.setTranslation({ x: pose.x, y: tuning.rescue.dropY, z: pose.z }, true)
    vb.setRotation(_q, true)
    vb.setLinvel({ x: 0, y: 0, z: 0 }, true)
    vb.setAngvel({ x: 0, y: 0, z: 0 }, true)

    // El agua que se fue por la escotilla mientras estuvo de lado.
    const derrame = derrameVolcadura(
      s.economy.liters,
      veh.golpeVuelco,
      stats.fisica.maxSpeed,
    )
    if (derrame >= 1) {
      s.setLiters(s.economy.liters - derrame)
      s.showNotice(
        `Enderezada. Se derramaron ${Math.round(derrame).toLocaleString('es-MX')} L`,
      )
    } else {
      s.showNotice('Enderezada. El tanque iba vacío')
    }

    veh.volcada = false
    veh.golpeVuelco = 0
    // Agua quieta al aterrizar: el chapoteo de estar de lado es basura y
    // volvería a tumbarla. Lo consume el paso de física.
    veh.sloshReset = true
    veh.slosh.x = 0
    veh.slosh.z = 0
  }

  useFrame((_state, delta) => {
    const s = useGameStore.getState()
    const veh = s.vehicle
    const media = balance.rescate.volcadura.pausaSegundos / 2

    if (fase.current === 'IDLE') {
      // ---- detección, corre siempre que no haya otro fundido encima
      if (!s.rescueFade) {
        if (estaVolcada(veh.rot, tuning.vuelco.upY)) {
          inclinada.current += delta
          golpe.current = Math.max(golpe.current, Math.abs(veh.speed))
          if (!veh.volcada && inclinada.current >= tuning.vuelco.segundos) {
            veh.volcada = true
            veh.golpeVuelco = golpe.current
          }
        } else {
          // Se enderezó sola (un golpe de suerte): no hay nada que rescatar.
          inclinada.current = 0
          golpe.current = 0
          if (veh.volcada) veh.volcada = false
        }
      }

      // ---- el botón dejó el pedido
      if (s.enderezando && veh.volcada) {
        fase.current = 'OSCURECE'
        t.current = 0
        s.setRescueFade(true)
      } else if (s.enderezando) {
        // Se enderezó sola entre el toque y este frame: no cobrar el viaje.
        s.setEnderezando(false)
      }
      return
    }

    t.current += delta

    if (fase.current === 'OSCURECE' && t.current >= media) {
      // Pantalla en negro: nadie ve el teletransporte, que es la gracia.
      enderezar()
      inclinada.current = 0
      golpe.current = 0
      fase.current = 'ACLARA'
      s.setRescueFade(false)
      s.setEnderezando(false)
      return
    }

    if (fase.current === 'ACLARA' && t.current >= media * 2) {
      fase.current = 'IDLE'
    }
  })

  return null
}
