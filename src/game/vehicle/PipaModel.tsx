import type { RefObject } from 'react'
import type { Group, Texture } from 'three'
import { useGameStore } from '../../state/gameStore'
import { COLORES, ESTILO_DE_FABRICA, type Estilo } from '../systems/estilo'
import type { VehicleStats } from '../systems/garage'
import { Claxon, Cortina, Escapes, Espejos, Luces } from './PipaExtras'
import { PIPA_BODY, PIPA_MATERIALS } from './pipaParts'
import { useCromoEnvMap } from './useCromoEnvMap'
import { usePlacaTexture } from './usePlacaTexture'

/*
 * Modelo de la pipa con las partes SEPARADAS en la jerarquía desde la Fase 0.
 * Desde el Paso 5 de la Fase 2 aquí aterriza el ESTILO: pintura por parte,
 * placas con rótulo y calca, cromo y piezas compradas.
 *
 * La suscripción al estilo vive AQUÍ y no en Pipa.tsx: este componente es
 * hijo puro dentro del RigidBody, así que re-renderizarse por un cambio de
 * color no toca Rapier. Dos reglas que no se negocian:
 *   - El estilo NO pasa por el key={modelo} de Pipa.tsx (remontaría la
 *     física por pintar la cabina).
 *   - Ningún `args` de geometría deriva del estilo (r3f recrearía la malla).
 *
 * Convención de ejes: el frente de la pipa mira a +Z, igual que el personaje.
 */

/** Cromado: claro, metálico, con el entorno encima. El swap va por IDENTIDAD
 *  de material (key por rama): añadir envMap a un material vivo no recompila
 *  el shader, cambiar el elemento crea uno correcto y r3f dispone el viejo. */
function MaterialCromable({
  cromada,
  envMap,
  color,
}: {
  cromada: boolean
  envMap: Texture | null
  color: string
}) {
  return cromada && envMap ? (
    <meshStandardMaterial
      key="cromo"
      color="#f2f4f6"
      metalness={1}
      roughness={0.13}
      envMap={envMap}
      envMapIntensity={0.9}
    />
  ) : (
    <meshStandardMaterial key="plano" color={color} />
  )
}

/**
 * Cada rueda son dos grupos anidados: el de fuera lo coloca la suspensión y
 * lo gira el volante, el de dentro solo rueda sobre su eje. Sin refs propios:
 * Pipa.tsx los alcanza por los hijos del grupo «ruedas».
 */
function Wheel({
  w,
  rinCromado,
  envMap,
}: {
  w: VehicleStats['wheel']
  rinCromado: boolean
  envMap: Texture | null
}) {
  return (
    <group>
      <group>
        {/* El cilindro nace sobre Y; se acuesta para quedar sobre el eje X */}
        <mesh name="llanta" rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[w.radius, w.radius, w.width, 12]} />
          <meshStandardMaterial color={PIPA_MATERIALS.llanta} />
        </mesh>
        {/* El rin va aparte: se croma sin tocar la llanta (Paso 5). */}
        <mesh name="rin" rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry
            args={[w.radius * 0.58, w.radius * 0.58, w.width * 1.05, 10]}
          />
          <MaterialCromable
            cromada={rinCromado}
            envMap={envMap}
            color={PIPA_MATERIALS.rin}
          />
        </mesh>
      </group>
    </group>
  )
}

export function PipaModel({
  wheelsRef,
  wheelCount,
  waterRef,
  stats,
  escala,
}: {
  /** Grupo «ruedas»; Pipa.tsx anima sus hijos cada frame. */
  wheelsRef: RefObject<Group | null>
  wheelCount: number
  /** Marcador del agua, solo en desarrollo. */
  waterRef: RefObject<Group | null>
  /** Las de la pipa equipada: de ahí sale el tamaño de las ruedas. */
  stats: VehicleStats
  /** Tamaño del modelo respecto a la pipa de referencia. */
  escala: number
}) {
  const B = PIPA_BODY

  /*
   * El estilo de la pipa equipada. El ?? devuelve la CONSTANTE de fábrica
   * (misma identidad siempre), así que una pipa sin pintar no re-renderiza
   * nada de gratis; con estilo, el objeto solo cambia al comprar.
   */
  const estilo: Estilo = useGameStore(
    (s) => s.garage.pipas[s.garage.equipada]?.estilo ?? ESTILO_DE_FABRICA,
  )
  const cabinaHex = COLORES[estilo.pintura.cabina]?.hex ?? PIPA_MATERIALS.cabina
  const tanqueHex = COLORES[estilo.pintura.tanque]?.hex ?? PIPA_MATERIALS.tanque
  // Siempre `=== true`: llave presente con false = comprada pero quitada.
  const cromo = {
    defensa: estilo.cromo.defensa === true,
    espejos: estilo.cromo.espejos === true,
    escapes: estilo.cromo.escapes === true,
    rines: estilo.cromo.rines === true,
  }
  const hayCromo =
    cromo.defensa || cromo.espejos || cromo.escapes || cromo.rines
  const envMap = useCromoEnvMap(hayCromo)
  const lateral = usePlacaTexture(estilo.rotulo, estilo.calca, tanqueHex, 512, 160)
  const trasera = usePlacaTexture(estilo.rotulo, estilo.calca, tanqueHex, 256, 112)

  return (
    <group name="pipa">
      {/*
        La carrocería se escala entera con el modelo. Las ruedas quedan FUERA
        a propósito: el controlador les da su posición ya en la escala del
        chasis, y meterlas aquí las escalaría dos veces.
      */}
      <group name="carroceria" scale={escala}>
        <group name="bastidor" position={[0, B.bastidor.y, 0]}>
          <mesh>
            <boxGeometry args={B.bastidor.size} />
            <meshStandardMaterial color={PIPA_MATERIALS.bastidor} />
          </mesh>
        </group>

        <group name="cabina" position={[0, B.cabina.y, B.cabina.z]}>
          <mesh>
            <boxGeometry args={B.cabina.size} />
            <meshStandardMaterial color={cabinaHex} />
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
          {cromo.espejos && envMap && <Espejos envMap={envMap} />}
          {estilo.detalles.claxon === true && <Claxon />}
          {estilo.detalles.luces === true && <Luces />}
          {estilo.detalles.cortinas === true && <Cortina />}
        </group>

        {cromo.escapes && envMap && <Escapes envMap={envMap} />}

        <group name="tanque" position={[0, B.tanque.y, B.tanque.z]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry
              args={[B.tanque.radius, B.tanque.radius, B.tanque.length, 16]}
            />
            <meshStandardMaterial color={tanqueHex} />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh
              key={s}
              name="tapa"
              position={[0, 0, (s * B.tanque.length) / 2]}
              rotation={[Math.PI / 2, 0, 0]}
            >
              <cylinderGeometry
                args={[
                  B.tanque.radius * 1.02,
                  B.tanque.radius * 1.02,
                  0.12,
                  16,
                ]}
              />
              <meshStandardMaterial color={PIPA_MATERIALS.tanqueTapa} />
            </mesh>
          ))}
          <mesh name="escotilla" position={[0, B.tanque.radius, 0.6]}>
            <cylinderGeometry args={[0.32, 0.32, 0.2, 10]} />
            <meshStandardMaterial color={PIPA_MATERIALS.escotilla} />
          </mesh>

          {/*
            Área de calcas: aquí aterrizan el rótulo y el motivo, compuestos
            en un solo CanvasTexture por placa. Sin nada puesto, color plano
            como siempre. No hay espejado que corregir: BoxGeometry mapea sus
            caras correctas visto desde fuera en ambas rotaciones ±π/2, así
            que una misma textura sirve para los dos costados.
          */}
          <group name="calcas">
            {[-1, 1].map((s) => (
              <mesh
                key={s}
                name={s < 0 ? 'calca-izquierda' : 'calca-derecha'}
                position={[s * B.calcaLateral.x, 0, 0]}
                rotation={[0, s * (Math.PI / 2), 0]}
              >
                <boxGeometry args={B.calcaLateral.size} />
                {lateral ? (
                  <meshStandardMaterial key="map" map={lateral} color="#ffffff" />
                ) : (
                  <meshStandardMaterial key="plano" color={PIPA_MATERIALS.calca} />
                )}
              </mesh>
            ))}
            <mesh name="calca-trasera" position={[0, 0, B.calcaTrasera.z]}>
              <boxGeometry args={B.calcaTrasera.size} />
              {trasera ? (
                <meshStandardMaterial key="map" map={trasera} color="#ffffff" />
              ) : (
                <meshStandardMaterial key="plano" color={PIPA_MATERIALS.calca} />
              )}
            </mesh>
          </group>
        </group>

        <group name="defensa">
          <mesh position={[0, B.defensaFrente.y, B.defensaFrente.z]}>
            <boxGeometry args={B.defensaFrente.size} />
            <MaterialCromable
              cromada={cromo.defensa}
              envMap={envMap}
              color={PIPA_MATERIALS.defensa}
            />
          </mesh>
          <mesh position={[0, B.defensaAtras.y, B.defensaAtras.z]}>
            <boxGeometry args={B.defensaAtras.size} />
            <MaterialCromable
              cromada={cromo.defensa}
              envMap={envMap}
              color={PIPA_MATERIALS.defensa}
            />
          </mesh>
        </group>
      </group>

      {/*
        Dónde está el agua, solo en desarrollo. El tanque es opaco, así que
        sin esto el chapoteo solo se puede sentir y no ver; con el marcador se
        entiende de un vistazo por qué media pipa es la más difícil. No entra
        al bundle de producción.
      */}
      {import.meta.env.DEV && (
        <group ref={waterRef} position={[0, B.tanque.y, B.tanque.z]}>
          <mesh name="debug-agua">
            <sphereGeometry args={[0.3, 10, 8]} />
            <meshStandardMaterial color="#2f9ee0" wireframe />
          </mesh>
        </group>
      )}

      {/* El orden de los hijos ES el orden de ruedas del controlador:
          0 delantera izq, 1 delantera der, 2 trasera izq, 3 trasera der. */}
      <group name="ruedas" ref={wheelsRef}>
        {Array.from({ length: wheelCount }, (_, i) => (
          <Wheel key={i} w={stats.wheel} rinCromado={cromo.rines} envMap={envMap} />
        ))}
      </group>
    </group>
  )
}
