import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Mesh } from 'three'
import { CLIENTES } from '../systems/clients'
import { dentroDeHorario, horaDelDia } from '../systems/acceptance'
import { useGameStore } from '../../state/gameStore'
import { locales } from './layout'

/*
 * La cortina metálica de cada local: la señal FÍSICA de «abierto/cerrado».
 * Fuera del horario del negocio la cortina está abajo (caja gris tapando el
 * vano); en horario no está y el local luce su color saturado. Es la manera
 * de saber DÓNDE vale la pena tocar sin marcadores flotantes: se lee desde
 * la calle, como en la vida real.
 *
 * Son 6 meshes que solo cambian `visible`; la hora se muestrea con throttle
 * dentro de useFrame porque clock.daySeconds se MUTA (no hay suscripción).
 * Sin collider: es una lámina de 12 cm pegada a una pared que ya tiene el
 * collider del local.
 */

/** Separación de la pared: cómodamente lejos de la precisión del depth. */
const SEPARACION = 0.1
const ANCHO = 3.2
const ALTO = 2.6
const GRUESO = 0.12
const COLOR_CORTINA = '#8f887b'

type Marco = {
  id: string
  pos: [number, number, number]
  rotY: number
}

/** El plano de fachada del local: la cara de su caja que mira a la puerta. */
function marcoDe(l: (typeof locales)[number]): Marco {
  const dx = l.door[0] - l.pos[0]
  const dz = l.door[2] - l.pos[2]
  const eje: 'x' | 'z' = Math.abs(dx) >= Math.abs(dz) ? 'x' : 'z'
  const signo = (eje === 'x' ? dx : dz) >= 0 ? 1 : -1
  const base = l.pos[1] - l.size[1] / 2
  if (eje === 'x') {
    const plano = l.pos[0] + signo * (l.size[0] / 2)
    return {
      id: l.id,
      pos: [plano + signo * (SEPARACION + GRUESO / 2), base + ALTO / 2, l.door[2]],
      rotY: Math.PI / 2,
    }
  }
  const plano = l.pos[2] + signo * (l.size[2] / 2)
  return {
    id: l.id,
    pos: [l.door[0], base + ALTO / 2, plano + signo * (SEPARACION + GRUESO / 2)],
    rotY: 0,
  }
}

export function CortinasLocales() {
  const marcos = useMemo(() => locales.map(marcoDe), [])
  const refs = useRef<(Mesh | null)[]>([])
  const acc = useRef(1) // arranca vencido: la primera pasada fija el estado

  useFrame((_state, delta) => {
    acc.current += delta
    if (acc.current < 0.25) return
    acc.current = 0
    const hora = horaDelDia(useGameStore.getState().clock.daySeconds)
    for (let i = 0; i < marcos.length; i++) {
      const mesh = refs.current[i]
      const cliente = CLIENTES[marcos[i].id]
      if (!mesh || !cliente) continue
      mesh.visible = !dentroDeHorario(hora, cliente.horario)
    }
  })

  return (
    <>
      {marcos.map((m, i) => (
        <mesh
          key={m.id}
          ref={(el) => {
            refs.current[i] = el
          }}
          position={m.pos}
          rotation={[0, m.rotY, 0]}
          visible={false}
        >
          <boxGeometry args={[ANCHO, ALTO, GRUESO]} />
          <meshLambertMaterial color={COLOR_CORTINA} />
        </mesh>
      ))}
    </>
  )
}
