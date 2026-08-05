import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BackSide, Color, ShaderMaterial, type Mesh } from 'three'
import { PALETA } from './paleta'

/*
 * EL CIELO (Fase 3, Paso 1).
 *
 * Una cúpula con gradiente del cenit al horizonte. Un draw call, sin luces,
 * sin texturas y sin depth write: el fragment shader es una interpolación
 * entre dos colores y nada más.
 *
 * POR QUÉ UNA CÚPULA Y NO UN GRADIENTE EN CSS. Poner el degradado detrás de
 * un canvas transparente costaría cero draw calls, y suena mejor hasta que se
 * mide: un canvas con alpha obliga al compositor de Safari a mezclar la capa
 * entera cada cuadro, y eso en un iPhone cuesta más que este draw call. Un
 * canvas opaco con una cúpula adentro es el camino barato.
 *
 * `depthWrite: false` y un `renderOrder` negativo la dejan pintarse primero y
 * no estorbar a nada: se comporta como el fondo, pero con gradiente.
 */

/**
 * Radio de la cúpula. Con `depthTest` apagado el tamaño no cambia nada de lo
 * que se ve; lo único que importa es que quepa DENTRO del plano lejano de la
 * cámara, o el recorte la borra y el cielo desaparece. Bajó de 600 a 320
 * cuando `far` se apretó a 400 para recuperar precisión de profundidad
 * (`Scene.tsx`). Sigue a la cámara, así que 320 sobra para 200 m de mapa.
 */
const RADIO = 320

const VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    // La posición local del vértice ES la dirección desde el centro: la
    // cúpula está centrada en la cámara, así que no hace falta más.
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const FRAG = /* glsl */ `
  uniform vec3 alto;
  uniform vec3 bajo;
  uniform float curva;
  varying vec3 vDir;
  void main() {
    // 0 en el horizonte, 1 en el cenit. El pow concentra la mezcla cerca del
    // horizonte, que es donde el cielo de verdad cambia rápido; una rampa
    // lineal se ve a plomo y delata el truco.
    float t = pow(clamp(vDir.y, 0.0, 1.0), curva);
    gl_FragColor = vec4(mix(bajo, alto, t), 1.0);
  }
`

export function Cielo() {
  const ref = useRef<Mesh>(null)

  /*
   * La cúpula viaja con la cámara. Anclada al origen, cruzar la colonia
   * movería el horizonte —el mundo mide 200 m y la esfera 600—, y un cielo
   * que se desliza al caminar se lee como un domo pintado, que es justo lo
   * que es. Siguiendo a la cámara queda infinitamente lejos, que es como se
   * comporta el cielo.
   */
  useFrame(({ camera }) => {
    ref.current?.position.copy(camera.position)
  })

  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms: {
          alto: { value: new Color(PALETA.cieloAlto) },
          bajo: { value: new Color(PALETA.cieloBajo) },
          curva: { value: 0.55 },
        },
        side: BackSide,
        depthWrite: false,
        depthTest: false,
        fog: false,
      }),
    [],
  )

  return (
    <mesh ref={ref} renderOrder={-1000} frustumCulled={false} material={material}>
      {/* Pocos segmentos: el gradiente lo calcula el shader por píxel, así que
          la malla solo tiene que ser redonda, no lisa. */}
      <sphereGeometry args={[RADIO, 16, 10]} />
    </mesh>
  )
}
