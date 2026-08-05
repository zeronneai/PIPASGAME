import { BufferAttribute, BufferGeometry } from 'three'
import { construirMallaColonia } from './fachadas'

/*
 * El mesh de la colonia: UNA BufferGeometry fusionada con colores por
 * vértice para toda la edificación genérica — un draw call en lugar del
 * InstancedMesh de 1000+ cajas, y el detalle de fachada viene YA en la
 * geometría (fachadas.ts), no en planos encimados.
 *
 * Singleton perezoso, como obtenerGeometria() de ColliderDebugView: el
 * layout es determinista y la malla no cambia nunca — remontar la escena
 * no debe pagar la generación otra vez.
 */

let geo: BufferGeometry | null = null

function obtenerMalla(): BufferGeometry {
  if (!geo) {
    const d = construirMallaColonia()
    geo = new BufferGeometry()
    geo.setAttribute('position', new BufferAttribute(d.position, 3))
    geo.setAttribute('normal', new BufferAttribute(d.normal, 3))
    // Los colores ya vienen en espacio lineal desde fachadas.ts.
    geo.setAttribute('color', new BufferAttribute(d.color, 3))
    geo.computeBoundingSphere()
  }
  return geo
}

export function MallaColonia() {
  return (
    <mesh geometry={obtenerMalla()}>
      <meshLambertMaterial vertexColors />
    </mesh>
  )
}
