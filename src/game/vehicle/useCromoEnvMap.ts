import { useThree } from '@react-three/fiber'
import { useMemo } from 'react'
import { PMREMGenerator, type Texture, type WebGLRenderer } from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

/*
 * El entorno que refleja el cromo. Un metal con metalness 1 y sin nada que
 * reflejar se ve NEGRO — la escena no tiene environment map (y no debe: el
 * greybox entero cambiaría de look). Aquí se genera una vez el RoomEnvironment
 * de three (viene con la librería, cero assets) y se aplica POR MATERIAL,
 * solo a las piezas cromadas.
 *
 * Singleton de módulo a propósito: sobrevive el doble montaje de StrictMode y
 * el remontaje por key={modelo} al cambiar de pipa. Cuesta unos ms una sola
 * vez y ~1 MB de VRAM; nunca se dispone (vive lo que la sesión).
 */
let envMap: Texture | null = null

function generar(gl: WebGLRenderer): Texture {
  if (!envMap) {
    const pmrem = new PMREMGenerator(gl)
    envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    pmrem.dispose()
  }
  return envMap
}

/** El envMap del cromo, generado perezoso: hasta que no hay una pieza
 *  cromada puesta, no se paga ni el milisegundo ni la VRAM. */
export function useCromoEnvMap(activo: boolean): Texture | null {
  const gl = useThree((s) => s.gl)
  return useMemo(() => (activo ? generar(gl) : null), [gl, activo])
}
