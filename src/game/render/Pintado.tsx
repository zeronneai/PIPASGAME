import { MixOperation, type ColorRepresentation, type Texture } from 'three'
import { useGameStore } from '../../state/gameStore'

/*
 * EL MATERIAL DEL JUEGO, en un solo lugar (Fase 3, Paso 1).
 *
 * La sección 1 del documento es tajante: Lambert o Toon, NUNCA Standard. Sin
 * normal maps, sin roughness, sin metalness. Y no es gusto — es la decisión
 * de rendimiento de toda la fase. Standard corre un modelo PBR completo por
 * píxel (BRDF, distribución de microfacetas, Fresnel, y el IBL aunque no
 * haya environment map); Lambert resuelve la luz POR VÉRTICE y en el
 * fragmento no hace más que multiplicar. En un iPhone, donde lo que se satura
 * es el fragment shader, esa diferencia es la fase entera.
 *
 * Por eso los 34 materiales de la escena pasan por aquí y no cada uno por su
 * cuenta: cuando el Paso 8 traiga el ciclo de luz, o si Toon gana sobre
 * Lambert, se cambia en un renglón en vez de en siete archivos.
 *
 * `standard` sigue existiendo como opción por una sola razón: es la MEDICIÓN.
 * El criterio de aceptación del Paso 1 es que los FPS suban, y eso no se
 * puede afirmar sin poder volver al material viejo en el mismo aparato y en
 * la misma escena. Se cambia desde leva (`arte · modelo de sombreado`) y no
 * debe quedarse puesto: no es una opción de arte, es el patrón de control.
 */

export type Sombreado = 'lambert' | 'toon' | 'standard'

export type PintadoProps = {
  color?: ColorRepresentation
  map?: Texture | null
  /** Para las piezas que sí emiten (faros, luces de colores). */
  emissive?: ColorRepresentation
  emissiveIntensity?: number
  transparent?: boolean
  opacity?: number
  /** Colores por instancia o por vértice: los edificios de la colonia. */
  vertexColors?: boolean
  wireframe?: boolean
  /**
   * Reflejo del entorno, para el cromo de la Fase 2.
   *
   * Lambert SÍ tiene envMap —es el reflejo pre-PBR de toda la vida, una
   * consulta al cubemap y una mezcla— así que cromar no obliga a volver a
   * Standard. Lo que se pierde es el reflejo dependiente de la rugosidad, que
   * en un juego pintado a mano no se echa de menos.
   */
  envMap?: Texture | null
  /** Cuánto pesa el reflejo, 0 a 1. */
  reflectivity?: number
}

/**
 * El material plano del juego. Toma color o mapa y ya: la información visual
 * vive en la textura y en el color, no en la iluminación, que es lo que hace
 * que el estilo pintado sea barato.
 */
export function Pintado({ envMap, reflectivity, ...props }: PintadoProps) {
  const sombreado = useGameStore((s) => s.debug.sombreado)

  /*
   * El `key` fuerza a React a construir un material NUEVO al cambiar de
   * modelo. Sin él, r3f intentaría reusar la instancia viva y aplicarle
   * propiedades que esa clase no tiene: el A/B se quedaría a medias y la
   * medición mentiría, que es lo contrario de para lo que existe.
   */
  if (sombreado === 'standard') {
    return (
      <meshStandardMaterial
        key="standard"
        {...props}
        envMap={envMap ?? undefined}
        // El equivalente PBR de «esto es cromo», solo para que el patrón de
        // control se vea como se veía antes y la comparación sea justa.
        metalness={envMap ? 1 : 0}
        roughness={envMap ? 0.13 : 1}
      />
    )
  }

  if (sombreado === 'toon') {
    // Toon no tiene envMap. El cromo pierde el reflejo y queda claro y plano,
    // que es lo coherente con el modelo: en un toon puro no hay reflejos.
    return <meshToonMaterial key="toon" {...props} />
  }

  return (
    <meshLambertMaterial
      key="lambert"
      {...props}
      envMap={envMap ?? undefined}
      // MixOperation mezcla reflejo y color base en vez de multiplicarlos:
      // multiplicar oscurece el cromo hasta volverlo peltre.
      combine={envMap ? MixOperation : undefined}
      reflectivity={reflectivity ?? 0}
    />
  )
}
