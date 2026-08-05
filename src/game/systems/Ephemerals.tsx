import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { RigidBody } from '@react-three/rapier'
import { balance } from '../balance'
import { PALETA } from '../paleta'
import { useGameStore } from '../../state/gameStore'
import { generarEfimero, intervaloSpawn, type EphemeralClient } from './ephemeral'
import { EPHEMERAL_SPOTS } from '../world/layout'
import { Interactable } from '../world/Interactable'

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

    // Día nuevo: la colonia amanece distinta — pero NO en seco. Se siembran
    // unos cuantos de arranque para que haya trabajo visible desde el primer
    // minuto (la entrada al ciclo no debe depender del primer spawn).
    if (dia.current !== s.economy.day) {
      dia.current = s.economy.day
      nextAt.current = null
      const libres = [...EPHEMERAL_SPOTS]
      const siembra: EphemeralClient[] = []
      for (
        let i = 0;
        i < balance.efimeros.siembraInicial && libres.length > 0;
        i++
      ) {
        const k = Math.floor(Math.random() * libres.length)
        siembra.push(generarEfimero(libres[k], ++seq, t))
        libres.splice(k, 1)
      }
      s.setEphemeral(siembra)
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
          {/* Cajita en greybox: casa compacta o plancha de obra. Colores
              SATURADOS de la paleta: lo que ofrece trabajo resalta contra la
              colonia desaturada (jerarquía por contraste, sin marcadores). */}
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
              <meshLambertMaterial
                color={e.tipo === 'casa' ? PALETA.verdeLimon : PALETA.ocre}
              />
            </mesh>
          </RigidBody>
          {/* Prop alto y saturado FUERA del RigidBody (sin collider): el
              tinaco de la casa o la bandera de la obra asoman por encima de
              las bardas y se ven a media cuadra. */}
          {e.tipo === 'casa' ? (
            <mesh position={[e.pos[0] + 1, e.pos[1] + 2.8 + 0.55, e.pos[2] + 1]}>
              <cylinderGeometry args={[0.55, 0.55, 1.1, 10]} />
              <meshLambertMaterial color={PALETA.anil} />
            </mesh>
          ) : (
            <group position={[e.pos[0] + 1.6, e.pos[1], e.pos[2] + 1.6]}>
              <mesh position={[0, 2, 0]}>
                <boxGeometry args={[0.08, 4, 0.08]} />
                <meshLambertMaterial color={PALETA.bloque} />
              </mesh>
              <mesh position={[0.4, 3.7, 0]}>
                <boxGeometry args={[0.75, 0.45, 0.05]} />
                <meshLambertMaterial color={PALETA.rosa} />
              </mesh>
            </group>
          )}
          <Interactable id={e.id} label="Ofrecer servicio" position={e.pos} />
        </group>
      ))}
    </>
  )
}
