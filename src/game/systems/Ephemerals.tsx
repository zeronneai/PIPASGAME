import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { RigidBody } from '@react-three/rapier'
import { balance } from '../balance'
import { useGameStore } from '../../state/gameStore'
import { generarEfimero, intervaloSpawn } from './ephemeral'
import { EPHEMERAL_SPOTS } from '../world/layout'
import { Interactable } from '../world/Interactable'
import { Pintado } from '../render/Pintado'
import { PALETA } from '../render/paleta'

/*
 * Ciclo de vida de los clientes efímeros: aparecen sobre spots libres a
 * intervalos del balance, viven unos minutos y se van. El sistema solo
 * administra la lista del store; ofrecer, aceptar y entregar los tratan
 * como a cualquier cliente (el pedido copia nombre y entrega, así que un
 * efímero puede irse a media entrega sin romper nada).
 *
 * También los dibuja: cajita de casa u obra sobre su spot, con collider
 * fijo, más su Interactable de «Ofrecer servicio». Son ≤ maxActivos
 * meshes: el presupuesto ni lo nota.
 */

let seq = 0

export function Ephemerals() {
  const list = useGameStore((s) => s.ephemeral)
  const nextAt = useRef<number | null>(null)
  const dia = useRef(-1)

  useFrame(() => {
    const s = useGameStore.getState()
    if (s.summary || s.logroSegunda) return
    const t = s.clock.daySeconds

    // Día nuevo: la colonia amanece distinta.
    if (dia.current !== s.economy.day) {
      dia.current = s.economy.day
      nextAt.current = null
      if (s.ephemeral.length) s.setEphemeral([])
      return
    }

    // Los que ya se fueron. Un pedido activo no los retiene: el pedido ya
    // copió lo suyo y el marcador de entrega es del pedido, no del cliente.
    const vivos = s.ephemeral.filter((e) => e.hastaSeconds > t)
    if (vivos.length !== s.ephemeral.length) s.setEphemeral(vivos)

    if (nextAt.current === null) nextAt.current = t + intervaloSpawn()
    if (t < nextAt.current) return
    nextAt.current = t + intervaloSpawn()

    if (vivos.length >= balance.efimeros.maxActivos) return
    const ocupados = new Set(vivos.map((e) => e.spotId))
    const libres = EPHEMERAL_SPOTS.filter((sp) => !ocupados.has(sp.id))
    if (libres.length === 0) return
    const spot = libres[Math.floor(Math.random() * libres.length)]
    s.setEphemeral([...vivos, generarEfimero(spot, ++seq, t)])
  })

  return (
    <>
      {list.map((e) => (
        <group key={e.id}>
          {/* Cajita en greybox: casa compacta o plancha de obra. */}
          <RigidBody type="fixed" colliders="cuboid">
            <mesh
              position={[
                e.pos[0],
                e.pos[1] + (e.tipo === 'casa' ? 1.4 : 0.8),
                e.pos[2],
              ]}
            >
              <boxGeometry
                args={e.tipo === 'casa' ? [3.5, 2.8, 3.5] : [4.5, 1.6, 4.5]}
              />
              <Pintado
                color={e.tipo === 'casa' ? PALETA.limon : PALETA.terracota}
              />
            </mesh>
          </RigidBody>
          <Interactable id={e.id} label="Ofrecer servicio" position={e.pos} />
        </group>
      ))}
    </>
  )
}
