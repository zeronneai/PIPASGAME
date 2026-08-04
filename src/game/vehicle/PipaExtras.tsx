import type { Texture } from 'three'

/*
 * Las piezas compradas del estilo (Fase 2, sección 5): espejos, escapes,
 * claxon, luces y cortina. Primitivas greybox — cajas, cilindros y conos —
 * sin un solo asset; el arte de verdad es de la Fase 3.
 *
 * Todas cuelgan de los grupos existentes (cabina o carroceria) y heredan la
 * escala del modelo gratis. Cada componente recibe puros primitivos para que
 * React pueda saltárselos cuando no cambian.
 *
 * Presupuesto: 12 meshes con todo puesto (la pipa pasa de 22 a 34; el tope
 * del documento son 100 draw calls por frame en total).
 */

/** Material de cromo: claro, metálico y con el entorno del taller encima. */
function Cromo({ envMap, roughness = 0.12 }: { envMap: Texture; roughness?: number }) {
  return (
    <meshStandardMaterial
      color="#f2f4f6"
      metalness={1}
      roughness={roughness}
      envMap={envMap}
      envMapIntensity={0.9}
    />
  )
}

/** Dos orejas cromadas a los lados de la cabina. Va DENTRO del grupo cabina. */
export function Espejos({ envMap }: { envMap: Texture }) {
  return (
    <>
      {[-1, 1].map((s) => (
        <group key={s} name="espejo">
          <mesh position={[s * 1.22, 0.45, 1.0]}>
            <boxGeometry args={[0.05, 0.05, 0.4]} />
            <meshStandardMaterial color="#54575f" />
          </mesh>
          <mesh position={[s * 1.38, 0.45, 1.05]}>
            <boxGeometry args={[0.06, 0.42, 0.28]} />
            <Cromo envMap={envMap} roughness={0.08} />
          </mesh>
        </group>
      ))}
    </>
  )
}

/** Dos chimeneas de acero pegadas a la cara trasera de la cabina. Va en el
 *  grupo carroceria (coordenadas absolutas del chasis). */
export function Escapes({ envMap }: { envMap: Texture }) {
  return (
    <>
      {[-1, 1].map((s) => (
        <mesh key={s} name="escape" position={[s * 1.0, 1.1, 1.25]}>
          <cylinderGeometry args={[0.09, 0.09, 1.6, 8]} />
          <Cromo envMap={envMap} roughness={0.25} />
        </mesh>
      ))}
    </>
  )
}

/** Dos trompetas de latón sobre el techo, apuntando al frente. En cabina. */
export function Claxon() {
  return (
    <>
      {[-1, 1].map((s) => (
        <mesh
          key={s}
          name="claxon"
          position={[s * 0.35, 1.02, 0.4]}
          rotation={[Math.PI / 2 - 0.25, 0, 0]}
        >
          {/* Cono: boca ancha al frente (la base del cilindro cónico). */}
          <cylinderGeometry args={[0.12, 0.035, 0.5, 8]} />
          <meshStandardMaterial color="#e3c65b" metalness={0.6} roughness={0.3} />
        </mesh>
      ))}
    </>
  )
}

const LUCES: { x: number; color: string }[] = [
  { x: -0.45, color: '#ff2d2d' },
  { x: 0, color: '#2dff6a' },
  { x: 0.45, color: '#ffb02d' },
]

/** Tres puntos encendidos sobre la cabina. Emissive sin bloom: no hay halo,
 *  pero sobre el greybox desaturado se leen como luz prendida. En cabina. */
export function Luces() {
  return (
    <>
      {LUCES.map((l) => (
        <mesh key={l.x} name="luz" position={[l.x, 1.02, 0.75]}>
          <boxGeometry args={[0.3, 0.12, 0.3]} />
          <meshStandardMaterial
            color="#1a1a1a"
            emissive={l.color}
            emissiveIntensity={1.1}
          />
        </mesh>
      ))}
    </>
  )
}

/** El fleco sobre el borde superior del parabrisas. En cabina. */
export function Cortina() {
  return (
    <mesh name="cortina" position={[0, 0.84, 1.2]}>
      <boxGeometry args={[1.95, 0.18, 0.05]} />
      <meshStandardMaterial color="#8a2f3b" roughness={0.9} />
    </mesh>
  )
}
