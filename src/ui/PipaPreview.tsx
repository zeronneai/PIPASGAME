import { useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import type { Group } from 'three'
import { PipaCarroceria, Wheel } from '../game/vehicle/PipaCarroceria'
import { wheelAnchors } from '../game/vehicle/pipaParts'
import type { Estilo } from '../game/systems/estilo'
import { statsPipa } from '../state/gameStore'
import { PALETA } from '../game/render/paleta'

/*
 * La pipa del aparador: una SEGUNDA escena 3D chiquita dentro del taller,
 * girable con el dedo, que enseña la selección de estilo ANTES de comprar.
 *
 * Es un teléfono y ya hay una escena grande corriendo atrás, así que aquí
 * todo es tacaño a propósito:
 *   - frameloop="demand": no renderiza cada frame. Los cambios de estilo
 *     invalidan solos (r3f invalida al cambiar props); el arrastre invalida
 *     a mano.
 *   - El giro va por REF + invalidate, no por useState: un pointermove no
 *     debe costar un render de React.
 *   - dpr limitado, sin sombras, dos luces, low-power. Se desmonta al salir
 *     de la pestaña (TallerEstilo la carga perezosa: three no entra al
 *     bundle inicial por aquí).
 *
 * Este archivo se importa con lazy() — no meterlo a un import estático de la
 * UI o la Canvas arrastraría three al arranque.
 */

/** Dentro de la Canvas: carrocería compartida + ruedas estáticas asentadas. */
function Contenido({ estilo }: { estilo: Estilo }) {
  const stats = statsPipa()
  const rinCromado = estilo.cromo.rines === true
  return (
    <>
      <PipaCarroceria estilo={estilo} escala={stats.escala} />
      {/* Fuera de la carrocería escalada, como en el mundo: los anchors ya
          vienen en escala del chasis. La Y baja el largo de la suspensión en
          reposo para que las ruedas pisen en vez de flotar en su anclaje. */}
      {wheelAnchors(stats.fisica).map((a, i) => (
        <group
          key={i}
          position={[a.x, a.y - stats.fisica.suspension.restLength, a.z]}
        >
          <Wheel w={stats.fisica.wheel} rinCromado={rinCromado} />
        </group>
      ))}
    </>
  )
}

export function PipaPreview({ estilo }: { estilo: Estilo }) {
  const giroRef = useRef<Group>(null)
  const invalidateRef = useRef<() => void>(() => {})
  const arrastre = useRef<number | null>(null)

  return (
    <div
      className="estilo-vista-lienzo"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        arrastre.current = e.clientX
      }}
      onPointerMove={(e) => {
        if (arrastre.current === null || !giroRef.current) return
        giroRef.current.rotation.y += (e.clientX - arrastre.current) * 0.012
        arrastre.current = e.clientX
        invalidateRef.current()
      }}
      onPointerUp={() => (arrastre.current = null)}
      onPointerCancel={() => (arrastre.current = null)}
    >
      <Canvas
        frameloop="demand"
        dpr={[1, 1.5]}
        gl={{
          powerPreference: 'low-power',
          antialias: true,
          alpha: true,
          stencil: false,
        }}
        camera={{ position: [5, 2.8, 7], fov: 32 }}
        onCreated={(state) => {
          invalidateRef.current = state.invalidate
          state.camera.lookAt(0, 0.4, 0)
        }}
      >
        {/*
          El aparador usa la MISMA calibración que la calle (Fase 3, Paso 1):
          sol moderado y rebote de cielo generoso, en vez del sol fuerte con
          ambiente mínimo que pedía Standard. Tiene que ser la misma o el
          taller miente: lo que ves aquí es lo que sale a la calle, y con dos
          iluminaciones distintas el mismo color se ve de dos maneras.
        */}
        <directionalLight position={[6, 8, 4]} color="#fff0d4" intensity={1.9} />
        <hemisphereLight
          color={PALETA.cieloAlto}
          groundColor={PALETA.terracota}
          intensity={1.6}
        />
        {/* Arranca en 3/4: se ven costado y frente de un vistazo. */}
        <group ref={giroRef} rotation={[0, 0.7, 0]}>
          <Contenido estilo={estilo} />
        </group>
      </Canvas>
    </div>
  )
}

export default PipaPreview
