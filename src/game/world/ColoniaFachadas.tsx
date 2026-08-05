import { useEffect, useMemo } from 'react'
import { Pintado } from '../render/Pintado'
import { construirFachadas } from './fachadas'
import { fachadasStats } from './fachadasStats'

/**
 * La colonia entera —lotes, fachadas, ventanas, tinacos, los seis locales, la
 * glorieta y los bolardos— en CUATRO draw calls.
 *
 * Cuatro y no uno a propósito. Una sola malla fusionada es un draw call, pero
 * también es un objeto que el frustum no puede descartar nunca: sus decenas de
 * miles de triángulos se envían enteros cada cuadro, incluidos los de la
 * manzana que tienes a la espalda. Partida en cuadrantes, parado en cualquier
 * calle el frustum tira uno o dos. Sobra presupuesto de draw calls (vamos en
 * 13 de 100) y no sobra tanto de triángulos: es el mejor cambio de moneda
 * disponible.
 *
 * El material va en blanco a propósito: con `vertexColors` el color del
 * material MULTIPLICA al del vértice, así que cualquier otro tono teñiría la
 * colonia completa.
 */
export function ColoniaFachadas() {
  const geometrias = useMemo(() => {
    const { mallas, stats } = construirFachadas()
    // Se publican para el overlay de debug: el presupuesto se vigila desde el
    // teléfono, no desde una nota en el commit.
    Object.assign(fachadasStats, stats)
    return mallas.map((m) => m.geometria())
  }, [])

  useEffect(() => () => geometrias.forEach((g) => g.dispose()), [geometrias])

  return (
    <>
      {geometrias.map((g, i) => (
        <mesh key={i} geometry={g}>
          <Pintado color="#ffffff" vertexColors />
        </mesh>
      ))}
    </>
  )
}
