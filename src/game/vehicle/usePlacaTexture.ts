import { useEffect, useMemo } from 'react'
import { CanvasTexture, SRGBColorSpace } from 'three'
import type { CalcaId } from '../systems/estilo'
import { dibujarPlaca } from './estiloRender'

/**
 * La textura de una placa del tanque, o null si la placa va pelona (sin
 * rótulo ni calca la pipa se ve exactamente como antes del Paso 5: color
 * plano, cero texturas).
 *
 * Deps por PRIMITIVOS (texto, id, hex) a propósito: el objeto estilo cambia
 * de identidad con cualquier compra, y regenerar el canvas por comprarte unos
 * espejos sería tirar trabajo.
 *
 * r3f dispone materiales y geometrías declarados en JSX, pero NO texturas
 * hechas a mano: el efecto de abajo dispone la anterior en cada cambio y la
 * última al desmontar. En StrictMode el doble montaje dispone una textura que
 * se vuelve a usar — inofensivo: dispose solo suelta el lado GPU y three la
 * re-sube al siguiente render.
 */
export function usePlacaTexture(
  rotulo: string,
  calca: CalcaId | null,
  tanqueHex: string,
  w: number,
  h: number,
): CanvasTexture | null {
  const texture = useMemo(() => {
    if (!rotulo && !calca) return null
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    dibujarPlaca(canvas.getContext('2d')!, w, h, { rotulo, calca, tanqueHex })
    const t = new CanvasTexture(canvas)
    // El canvas 2D es sRGB; sin esto el rótulo sale lavado.
    t.colorSpace = SRGBColorSpace
    // Las placas se ven en ángulo rasante manejando: sin anisotropía se
    // vuelven papilla a tres metros.
    t.anisotropy = 4
    return t
  }, [rotulo, calca, tanqueHex, w, h])

  useEffect(() => () => texture?.dispose(), [texture])
  return texture
}
