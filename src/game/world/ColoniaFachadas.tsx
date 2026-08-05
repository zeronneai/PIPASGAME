import { useEffect, useMemo } from 'react'
import { Pintado } from '../render/Pintado'
import { construirFachadas } from './fachadas'
import { fachadasStats } from './fachadasStats'

/**
 * La colonia entera en UN draw call: lotes, fachadas, ventanas, tinacos y los
 * seis locales, fusionados en una geometría con color por vértice.
 *
 * El material va en blanco a propósito: con `vertexColors` el color del
 * material MULTIPLICA al del vértice, así que cualquier otro tono teñiría la
 * colonia completa.
 */
export function ColoniaFachadas() {
  const geometria = useMemo(() => {
    const { malla, stats } = construirFachadas()
    // Se publican para el overlay de debug: el presupuesto se vigila desde el
    // teléfono, no desde una nota en el commit.
    Object.assign(fachadasStats, stats)
    return malla.geometria()
  }, [])

  useEffect(() => () => geometria.dispose(), [geometria])

  return (
    <mesh geometry={geometria}>
      <Pintado color="#ffffff" vertexColors />
    </mesh>
  )
}
