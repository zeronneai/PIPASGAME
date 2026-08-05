import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { balance } from '../balance'
import { useGameStore } from '../../state/gameStore'
import { generarEfimero, intervaloSpawn, type EphemeralClient } from './ephemeral'
import { EPHEMERAL_SPOTS } from '../world/layout'
import { Interactable } from '../world/Interactable'
import { Pintado } from '../render/Pintado'
import { EFIMERO_CAJA, construirEfimero } from '../world/efimerosGeom'

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

/**
 * Un cliente eventual: su volumen más las señas de que ahí hace falta agua
 * (`efimerosGeom.ts`). Todo va en UNA malla fusionada, así que los tres que
 * puede haber a la vez cuestan tres draw calls y no veinte.
 *
 * El collider se declara a mano en vez de dejar que rapier lo deduzca: con
 * `colliders="cuboid"` envolvería también los tambos y la varilla, y el
 * jugador chocaría con una caja invisible mucho más grande que la casa. Las
 * señas son estorbo visual, no muro.
 */
function Efimero({ e }: { e: EphemeralClient }) {
  const caja = EFIMERO_CAJA[e.tipo]
  // La semilla sale del id: dos casas no acomodan igual sus tambos, y la
  // misma casa se ve igual mientras exista.
  const geometria = useMemo(
    () => construirEfimero(e.tipo, hashId(e.id)),
    [e.tipo, e.id],
  )
  useEffect(() => () => geometria.dispose(), [geometria])

  return (
    <group>
      <RigidBody type="fixed" colliders={false} position={e.pos}>
        <CuboidCollider
          args={[caja.size[0] / 2, caja.size[1] / 2, caja.size[2] / 2]}
          position={[0, caja.y, 0]}
        />
        <mesh geometry={geometria}>
          <Pintado color="#ffffff" vertexColors />
        </mesh>
      </RigidBody>
      <Interactable id={e.id} label="Ofrecer servicio" position={e.pos} />
    </group>
  )
}

/** El id a un entero estable. No necesita ser bueno, solo determinista. */
function hashId(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  return Math.abs(h)
}

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
        <Efimero key={e.id} e={e} />
      ))}
    </>
  )
}
