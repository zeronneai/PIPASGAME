import { useFrame } from '@react-three/fiber'
import { renderStats } from '../../state/renderStats'

/**
 * Copia los contadores del WebGLRenderer al módulo que lee el overlay.
 *
 * three resetea `info.render` al empezar cada render y useFrame corre antes,
 * así que lo que se lee aquí son las cuentas del frame anterior. Da igual
 * para vigilar el presupuesto de la sección 2 (menos de 100 draw calls).
 */
export function RenderStats() {
  useFrame((state) => {
    const info = state.gl.info.render
    renderStats.calls = info.calls
    renderStats.triangles = info.triangles
  })
  return null
}
