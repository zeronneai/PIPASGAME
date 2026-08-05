import { useGameStore } from '../../state/gameStore'
import type { PerfilCliente } from './clients'

/*
 * Un poste con cubo flotante en el PUNTO DE ENTREGA de cada pedido activo,
 * del color del perfil (el mismo lenguaje que la lista y el minimapa). En
 * greybox es lo que hace encontrable un domicilio: la flecha del HUD da el
 * rumbo, esto confirma la puerta. Son ≤ un puñado de meshes sin física.
 */

const PERFIL_COLOR: Record<PerfilCliente, string> = {
  paciente: '#3ddc84',
  normal: '#ffb74d',
  exigente: '#ff5252',
}

export function DeliveryMarkers() {
  const orders = useGameStore((s) => s.economy.orders)

  return (
    <>
      {orders.map((o) => (
        <group key={o.id} position={[o.delivery[0], o.delivery[1], o.delivery[2]]}>
          <mesh position={[0, 2, 0]}>
            <boxGeometry args={[0.22, 4, 0.22]} />
            <meshLambertMaterial color={PERFIL_COLOR[o.perfil]} />
          </mesh>
          <mesh position={[0, 4.6, 0]}>
            <boxGeometry args={[1, 1, 1]} />
            <meshLambertMaterial color={PERFIL_COLOR[o.perfil]} />
          </mesh>
        </group>
      ))}
    </>
  )
}
