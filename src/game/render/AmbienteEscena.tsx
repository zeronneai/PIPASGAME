import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { DirectionalLight, Fog } from 'three'
import { PALETA } from './paleta'
import { tuning } from '../tuning'

/*
 * LA LUZ Y LA NIEBLA (Fase 3, Paso 1).
 *
 * La niebla y la posición del sol se aplican por frame desde `tuning.arte`,
 * igual que el resto del juego: leva muta el objeto sin re-renders y esto lo
 * lee. Es lo que permite sentarse con el teléfono y mover el ambiente hasta
 * que la colonia se vea como debe, que es la única forma de afinar luz.
 *
 * La niebla se declara como elemento con `attach="fog"` y se toca por ref, en
 * vez de asignarle `scene.fog` a mano: r3f la monta y la desmonta con el
 * componente, y así no queda niebla colgada en la escena si esto se quita.
 *
 * El COLOR de la niebla no se ajusta: es el del horizonte y tiene que seguir
 * siéndolo. Si la niebla y el cielo se separan, lo lejano se recorta contra
 * el fondo y se ve peor que sin niebla.
 */

const GRADOS = Math.PI / 180

export function AmbienteEscena() {
  const sol = useRef<DirectionalLight>(null)
  const niebla = useRef<Fog>(null)

  useFrame(() => {
    const a = tuning.arte

    if (niebla.current) {
      niebla.current.near = a.nieblaCerca
      niebla.current.far = a.nieblaLejos
    }

    if (sol.current) {
      // Azimut y altura en grados a una posición sobre una esfera lejana. Se
      // piensa mejor «de dónde viene el sol» que en tres coordenadas sueltas.
      const alt = a.solAltura * GRADOS
      const azi = a.solAzimut * GRADOS
      const r = 100
      sol.current.position.set(
        Math.cos(alt) * Math.sin(azi) * r,
        Math.sin(alt) * r,
        Math.cos(alt) * Math.cos(azi) * r,
      )
      sol.current.intensity = a.solIntensidad
    }
  })

  return (
    <>
      <fog
        ref={niebla}
        attach="fog"
        args={[PALETA.cieloBajo, tuning.arte.nieblaCerca, tuning.arte.nieblaLejos]}
      />
      {/* El sol: cálido, porque la luz de la tarde en la colonia lo es. */}
      <directionalLight
        ref={sol}
        color="#fff0d4"
        intensity={tuning.arte.solIntensidad}
      />
      {/*
        El rebote. Cielo arriba, calle abajo — y la calle rebota terracota,
        no gris: el suelo caliente es la mitad de por qué una colonia se ve
        cálida aunque el cielo esté pálido.
      */}
      <hemisphereLight
        color={PALETA.cieloAlto}
        groundColor={PALETA.terracota}
        intensity={tuning.arte.hemiIntensidad}
      />
    </>
  )
}
