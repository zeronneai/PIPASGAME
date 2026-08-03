import type { RefObject } from 'react'
import type { Group } from 'three'
import { tuning } from '../tuning'
import { PIPA_BODY, PIPA_MATERIALS } from './pipaParts'

/*
 * Modelo de la pipa con las partes SEPARADAS en la jerarquía desde la Fase 0.
 *
 * En la Fase 2 se va a poder personalizar (color de cabina, rines, calcas en
 * el tanque). Si esto fuera una sola malla habría que rehacerlo entero, así
 * que cada pieza nace con su propio grupo y su propia entrada de material,
 * aunque hoy todas sean cajas grises.
 *
 * Convención de ejes: el frente de la pipa mira a +Z, igual que el personaje.
 */

/**
 * Cada rueda son dos grupos anidados: el de fuera lo coloca la suspensión y
 * lo gira el volante, el de dentro solo rueda sobre su eje. Sin refs propios:
 * Pipa.tsx los alcanza por los hijos del grupo «ruedas».
 */
function Wheel() {
  const w = tuning.vehicle.wheel
  return (
    <group>
      <group>
        {/* El cilindro nace sobre Y; se acuesta para quedar sobre el eje X */}
        <mesh name="llanta" rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[w.radius, w.radius, w.width, 12]} />
          <meshStandardMaterial color={PIPA_MATERIALS.llanta} />
        </mesh>
        {/* El rin va aparte: en la Fase 2 se personaliza sin tocar la llanta */}
        <mesh name="rin" rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry
            args={[w.radius * 0.58, w.radius * 0.58, w.width * 1.05, 10]}
          />
          <meshStandardMaterial color={PIPA_MATERIALS.rin} />
        </mesh>
      </group>
    </group>
  )
}

export function PipaModel({
  wheelsRef,
  wheelCount,
}: {
  /** Grupo «ruedas»; Pipa.tsx anima sus hijos cada frame. */
  wheelsRef: RefObject<Group | null>
  wheelCount: number
}) {
  const B = PIPA_BODY
  return (
    <group name="pipa">
      <group name="bastidor" position={[0, B.bastidor.y, 0]}>
        <mesh>
          <boxGeometry args={B.bastidor.size} />
          <meshStandardMaterial color={PIPA_MATERIALS.bastidor} />
        </mesh>
      </group>

      <group name="cabina" position={[0, B.cabina.y, B.cabina.z]}>
        <mesh>
          <boxGeometry args={B.cabina.size} />
          <meshStandardMaterial color={PIPA_MATERIALS.cabina} />
        </mesh>
        <mesh name="parabrisas" position={[0, 0.35, 1.16]}>
          <boxGeometry args={[1.9, 0.85, 0.06]} />
          <meshStandardMaterial color={PIPA_MATERIALS.cabinaVidrio} />
        </mesh>
        {[-0.8, 0.8].map((x) => (
          <mesh key={x} name="faro" position={[x, -0.7, 1.16]}>
            <boxGeometry args={[0.45, 0.25, 0.06]} />
            <meshStandardMaterial color={PIPA_MATERIALS.faro} />
          </mesh>
        ))}
      </group>

      <group name="tanque" position={[0, B.tanque.y, B.tanque.z]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry
            args={[B.tanque.radius, B.tanque.radius, B.tanque.length, 16]}
          />
          <meshStandardMaterial color={PIPA_MATERIALS.tanque} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh
            key={s}
            name="tapa"
            position={[0, 0, (s * B.tanque.length) / 2]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <cylinderGeometry
              args={[B.tanque.radius * 1.02, B.tanque.radius * 1.02, 0.12, 16]}
            />
            <meshStandardMaterial color={PIPA_MATERIALS.tanqueTapa} />
          </mesh>
        ))}
        <mesh name="escotilla" position={[0, B.tanque.radius, 0.6]}>
          <cylinderGeometry args={[0.32, 0.32, 0.2, 10]} />
          <meshStandardMaterial color={PIPA_MATERIALS.escotilla} />
        </mesh>

        {/* Área de calcas: placas planas con su propia malla y su propio
            material, listas para recibir un map en la Fase 2. */}
        <group name="calcas">
          {[-1, 1].map((s) => (
            <mesh
              key={s}
              name={s < 0 ? 'calca-izquierda' : 'calca-derecha'}
              position={[s * B.calcaLateral.x, 0, 0]}
              rotation={[0, s * (Math.PI / 2), 0]}
            >
              <boxGeometry args={B.calcaLateral.size} />
              <meshStandardMaterial color={PIPA_MATERIALS.calca} />
            </mesh>
          ))}
          <mesh name="calca-trasera" position={[0, 0, B.calcaTrasera.z]}>
            <boxGeometry args={B.calcaTrasera.size} />
            <meshStandardMaterial color={PIPA_MATERIALS.calca} />
          </mesh>
        </group>
      </group>

      <group name="defensa">
        <mesh position={[0, B.defensaFrente.y, B.defensaFrente.z]}>
          <boxGeometry args={B.defensaFrente.size} />
          <meshStandardMaterial color={PIPA_MATERIALS.defensa} />
        </mesh>
        <mesh position={[0, B.defensaAtras.y, B.defensaAtras.z]}>
          <boxGeometry args={B.defensaAtras.size} />
          <meshStandardMaterial color={PIPA_MATERIALS.defensa} />
        </mesh>
      </group>

      {/* El orden de los hijos ES el orden de ruedas del controlador:
          0 delantera izq, 1 delantera der, 2 trasera izq, 3 trasera der. */}
      <group name="ruedas" ref={wheelsRef}>
        {Array.from({ length: wheelCount }, (_, i) => (
          <Wheel key={i} />
        ))}
      </group>
    </group>
  )
}
