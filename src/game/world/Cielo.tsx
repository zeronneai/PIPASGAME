import { useEffect, useMemo } from 'react'
import { BackSide, CanvasTexture, SRGBColorSpace } from 'three'
import { PALETA } from '../paleta'

/*
 * El cielo (Fase 3): un domo con gradiente vertical generado por canvas —
 * MEDIODÍA de calor seco: cenit azul franco arriba, un azul empolvado a
 * media altura y horizonte claro y cálido abajo, casando con el color de la
 * niebla para que el fondo se funda sin costura.
 *
 * Cero shaders custom y cero assets: una textura de 2×256 píxeles pintada al
 * vuelo. Cuesta exactamente +1 draw call y ~500 triángulos.
 */
export function Cielo() {
  const textura = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 2
    canvas.height = 256
    const ctx = canvas.getContext('2d')!
    const grad = ctx.createLinearGradient(0, 0, 0, 256)
    // Con flipY, la fila 0 del canvas cae en v=1 = el polo norte de la
    // esfera: el canvas se pinta de cenit (arriba) a horizonte (abajo).
    grad.addColorStop(0, PALETA.cieloCenit)
    grad.addColorStop(0.45, '#8fb4dd') // azul empolvado, todavía cielo
    grad.addColorStop(0.62, '#cfd8d2') // la calina sobre los techos
    grad.addColorStop(0.78, PALETA.cieloHorizonte)
    grad.addColorStop(1, PALETA.cieloHorizonte)
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, 2, 256)
    const t = new CanvasTexture(canvas)
    t.colorSpace = SRGBColorSpace
    return t
  }, [])

  useEffect(() => () => textura.dispose(), [textura])

  return (
    <mesh>
      <sphereGeometry args={[350, 24, 12]} />
      {/* Basic: al cielo no lo ilumina nadie. fog=false o la niebla se lo
          comería a sí mismo. */}
      <meshBasicMaterial map={textura} side={BackSide} fog={false} />
    </mesh>
  )
}
