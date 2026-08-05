import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { BufferGeometry, Group } from 'three'
import { useGameStore } from '../../state/gameStore'
import type { PerfilCliente } from './clients'
import { Pintado } from '../render/Pintado'
import { PALETA } from '../render/paleta'
import { Malla } from '../world/malla'

/*
 * EL MARCADOR DE UN PEDIDO ACEPTADO (Parte C del Paso 2).
 *
 * La regla que lo gobierna, y la razón de que sea lo único flotante del
 * mundo: SOLO para pedidos activos. Nunca para un lugar que simplemente
 * existe. Un local se reconoce por su rótulo y su cortina; una casa con sed,
 * por sus tambos y su tinaco. Eso lo cuenta la colonia sola. Lo que la
 * colonia no puede contar es «a este te comprometiste hoy», porque no es una
 * propiedad del lugar sino del trato — y solo para eso se señala.
 *
 * Antes era un poste con un cubo encima, en colores de semáforo (#3ddc84,
 * #ff5252) que no salían de ninguna paleta y que ahora, contra fachadas
 * pintadas, se verían de otro juego. Ahora es una BANDERITA de obra: asta
 * delgada y banderín del color del perfil, tomado de la paleta. Se lee a
 * distancia por la silueta y el movimiento, no por brillar más que el mundo.
 *
 * Se mece despacio, y esa es la parte que hace el trabajo: en un mundo quieto
 * lo único que se mueve es lo único que el ojo encuentra sin buscar. Costó un
 * seno.
 */

/**
 * El color del perfil, ahora de la paleta. Es el MISMO lenguaje de la lista
 * de pedidos y del minimapa, así que el banderín ocre de la calle y el
 * renglón ocre del HUD son el mismo pedido sin tener que explicarlo.
 */
const PERFIL_COLOR: Record<PerfilCliente, string> = {
  paciente: PALETA.limon,
  normal: PALETA.ocre,
  exigente: PALETA.rosa,
}

/*
 * El asta y el aro del piso van FUSIONADOS en una geometría con color por
 * vértice, y esa geometría se comparte entre todos los pedidos del mismo
 * perfil. Son dos draw calls por marcador —el poste y la tela, que necesita
 * transformación propia para ondear— en vez de tres, y no se construye
 * geometría nueva cada vez que se acepta un pedido.
 *
 * No es un ahorro cosmético: los pedidos activos no tienen tope, y a tres
 * mallas cada uno una jornada cargada se comía un cuarto del presupuesto.
 */
const asta = new Map<string, BufferGeometry>()

function geometriaAsta(color: string): BufferGeometry {
  const previa = asta.get(color)
  if (previa) return previa
  const m = new Malla()
  // El asta: delgada y de metal viejo, para que no compita con el banderín.
  m.cilindro([0, 1.6, 0], 0.035, 3.2, 5, PALETA.metal)
  /*
   * El aro del piso: un anillo bajo del color del perfil. Es lo que se sigue
   * viendo desde la cabina cuando el banderín ya salió de cuadro por lo alto
   * —manejando, la mirada va al suelo—.
   */
  const segs = 16
  for (let i = 0; i < segs; i++) {
    const a0 = (i / segs) * Math.PI * 2
    const a1 = ((i + 1) / segs) * Math.PI * 2
    const [r0, r1] = [0.55, 0.78]
    m.quad(
      [Math.cos(a0) * r0, 0.03, Math.sin(a0) * r0],
      [Math.cos(a0) * r1, 0.03, Math.sin(a0) * r1],
      [Math.cos(a1) * r1, 0.03, Math.sin(a1) * r1],
      [Math.cos(a1) * r0, 0.03, Math.sin(a1) * r0],
      color,
    )
  }
  const g = m.geometria()
  asta.set(color, g)
  return g
}

/** Un pedido: asta con su aro, y el banderín que ondea. */
function Banderin({
  pos,
  color,
  fase,
}: {
  pos: [number, number, number]
  color: string
  fase: number
}) {
  const tela = useRef<Group>(null)

  useFrame(({ clock }) => {
    // Ondear, no girar: el banderín se dobla sobre su asta.
    if (tela.current) {
      tela.current.rotation.y = Math.sin(clock.elapsedTime * 1.6 + fase) * 0.35
    }
  })

  return (
    <group position={pos}>
      <mesh geometry={geometriaAsta(color)}>
        <Pintado color="#ffffff" vertexColors />
      </mesh>

      {/* El banderín, colgado del tercio de arriba y descentrado del asta:
          así se dobla como tela y no gira como aspa. */}
      <group ref={tela} position={[0, 2.75, 0]}>
        <mesh position={[0.32, 0, 0]}>
          <boxGeometry args={[0.62, 0.42, 0.02]} />
          <Pintado color={color} />
        </mesh>
      </group>
    </group>
  )
}

export function DeliveryMarkers() {
  const orders = useGameStore((s) => s.economy.orders)

  return (
    <>
      {orders.map((o, i) => (
        <Banderin
          key={o.id}
          pos={[o.delivery[0], o.delivery[1], o.delivery[2]]}
          color={PERFIL_COLOR[o.perfil]}
          // Desfasados: dos banderines meciéndose al unísono se ven mecánicos.
          fase={i * 1.9}
        />
      ))}
    </>
  )
}
