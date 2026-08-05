import type { Texture } from 'three'
import { COLORES, type Estilo } from '../systems/estilo'
import type { VehicleStats } from '../systems/garage'
import { Claxon, Cortina, Escapes, Espejos, Luces } from './PipaExtras'
import { PIPA_BODY, PIPA_MATERIALS } from './pipaParts'
import { useCromoEnvMap } from './useCromoEnvMap'
import { usePlacaTexture } from './usePlacaTexture'
import { Pintado } from '../render/Pintado'
import { PALETA } from '../render/paleta'

/*
 * La CARROCERÍA de la pipa: presentacional pura, sin rapier y sin store.
 * La usan dos escenas: el mundo (PipaModel, dentro del RigidBody) y la vista
 * previa del taller (PipaPreview, su propia Canvas chica). Todo lo que el
 * estilo pinta vive aquí, así lo que ves en el taller ES lo que sale a la
 * calle.
 *
 * Regla heredada de PipaModel: ningún `args` de geometría deriva del estilo
 * (r3f recrearía la malla); el estilo solo toca materiales y monta/desmonta
 * piezas.
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
    <Pintado key="cromo" color={PALETA.cromo} envMap={envMap} reflectivity={0.9} />
  ) : (
    <Pintado key="plano" color={color} />
  )
}

/**
 * Una rueda: el grupo de fuera lo coloca la suspensión y lo gira el volante,
 * el de dentro solo rueda sobre su eje. En el mundo los anima Pipa.tsx; en
 * la preview van quietas.
 */
export function Wheel({
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
          <Pintado color={PIPA_MATERIALS.llanta} />
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

export function PipaCarroceria({
  estilo,
  escala,
}: {
  estilo: Estilo
  escala: number
}) {
  const B = PIPA_BODY
  const cabinaHex = COLORES[estilo.pintura.cabina]?.hex ?? PIPA_MATERIALS.cabina
  const tanqueHex = COLORES[estilo.pintura.tanque]?.hex ?? PIPA_MATERIALS.tanque
  // Siempre `=== true`: la llave puede estar con false (pieza quitada).
  const cromo = {
    defensa: estilo.cromo.defensa === true,
    espejos: estilo.cromo.espejos === true,
    escapes: estilo.cromo.escapes === true,
  }
  const envMap = useCromoEnvMap(cromo.defensa || cromo.espejos || cromo.escapes)
  const lateral = usePlacaTexture(estilo.rotulo, estilo.calca, tanqueHex, 512, 160)
  const trasera = usePlacaTexture(estilo.rotulo, estilo.calca, tanqueHex, 256, 112)

  return (
    <group name="carroceria" scale={escala}>
      <group name="bastidor" position={[0, B.bastidor.y, 0]}>
        <mesh>
          <boxGeometry args={B.bastidor.size} />
          <Pintado color={PIPA_MATERIALS.bastidor} />
        </mesh>
      </group>

      <group name="cabina" position={[0, B.cabina.y, B.cabina.z]}>
        <mesh>
          <boxGeometry args={B.cabina.size} />
          <Pintado color={cabinaHex} />
        </mesh>
        <mesh name="parabrisas" position={[0, 0.35, 1.16]}>
          <boxGeometry args={[1.9, 0.85, 0.06]} />
          <Pintado color={PIPA_MATERIALS.cabinaVidrio} />
        </mesh>
        {[-0.8, 0.8].map((x) => (
          <mesh key={x} name="faro" position={[x, -0.7, 1.16]}>
            <boxGeometry args={[0.45, 0.25, 0.06]} />
            <Pintado color={PIPA_MATERIALS.faro} />
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
          <Pintado color={tanqueHex} />
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
            <Pintado color={PIPA_MATERIALS.tanqueTapa} />
          </mesh>
        ))}
        <mesh name="escotilla" position={[0, B.tanque.radius, 0.6]}>
          <cylinderGeometry args={[0.32, 0.32, 0.2, 10]} />
          <Pintado color={PIPA_MATERIALS.escotilla} />
        </mesh>

        {/*
          Área de calcas: el rótulo y el motivo, compuestos en un solo
          CanvasTexture por placa. Sin nada puesto, color plano como siempre.
          No hay espejado que corregir: BoxGeometry mapea sus caras correctas
          visto desde fuera en ambas rotaciones ±π/2, así que una misma
          textura sirve para los dos costados.
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
                <Pintado key="map" map={lateral} color="#ffffff" />
              ) : (
                <Pintado key="plano" color={PIPA_MATERIALS.calca} />
              )}
            </mesh>
          ))}
          <mesh name="calca-trasera" position={[0, 0, B.calcaTrasera.z]}>
            <boxGeometry args={B.calcaTrasera.size} />
            {trasera ? (
              <Pintado key="map" map={trasera} color="#ffffff" />
            ) : (
              <Pintado key="plano" color={PIPA_MATERIALS.calca} />
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
  )
}
