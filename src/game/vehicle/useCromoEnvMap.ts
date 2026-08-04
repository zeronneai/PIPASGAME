import { useThree } from '@react-three/fiber'
import { useMemo } from 'react'
import { PMREMGenerator, type Texture, type WebGLRenderer } from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

/*
 * El entorno que refleja el cromo. Un metal con metalness 1 y sin nada que
 * reflejar se ve NEGRO — la escena no tiene environment map (y no debe: el
 * greybox entero cambiaría de look). Aquí se genera el RoomEnvironment de
 * three (viene con la librería, cero assets) y se aplica POR MATERIAL, solo
 * a las piezas cromadas.
 *
 * Caché POR RENDERER, no singleton: el PMREM produce un render-target
 * texture, y esos viven casados con el contexto WebGL que los generó — en
 * otro (la Canvas de la vista previa del taller) el binding sale nulo y el
 * cromo se ve negro. El WeakMap sobrevive StrictMode y el remontaje por
 * key={modelo}, y suelta la entrada sola si el renderer muere.
 */
const porRenderer = new WeakMap<WebGLRenderer, Texture>()

function generar(gl: WebGLRenderer): Texture {
  let envMap = porRenderer.get(gl)
  if (!envMap) {
    const pmrem = new PMREMGenerator(gl)
    envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    pmrem.dispose()
    porRenderer.set(gl, envMap)
  }
  return envMap
}

/** El envMap del cromo, generado perezoso: hasta que no hay una pieza
 *  cromada puesta, no se paga ni el milisegundo ni la VRAM. */
export function useCromoEnvMap(activo: boolean): Texture | null {
  const gl = useThree((s) => s.gl)
  return useMemo(() => (activo ? generar(gl) : null), [gl, activo])
}
