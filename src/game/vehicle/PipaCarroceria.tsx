import { PALETA } from '../paleta'
import { COLORES, type Estilo } from '../systems/estilo'
import type { VehicleStats } from '../systems/garage'
import { Claxon, Cortina, Escapes, Espejos, Luces } from './PipaExtras'
import { PIPA_BODY, PIPA_MATERIALS } from './pipaParts'
import { usePlacaTexture } from './usePlacaTexture'

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

/** Cromado a la Fase 3: PLATA PINTADA, plana como de rótulo — sin PBR ni
 *  envMap (Lambert no los tiene y el estilo tampoco los quiere). El espejeo
 *  de verdad regresa pintado en la textura con el Paso 7. */
function MaterialCromable({
  cromada,
  color,
}: {
  cromada: boolean
  color: string
}) {
  return <meshLambertMaterial color={cromada ? PALETA.plata : color} />
}

/**
 * Una rueda: el grupo de fuera lo coloca la suspensión y lo gira el volante,
 * el de dentro solo rueda sobre su eje. En el mundo los anima Pipa.tsx; en
 * la preview van quietas.
 */
export function Wheel({
  w,
  rinCromado,
}: {
  w: VehicleStats['wheel']
  rinCromado: boolean
}) {
  return (
    <group>
      <group>
        {/* El cilindro nace sobre Y; se acuesta para quedar sobre el eje X */}
        <mesh name="llanta" rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[w.radius, w.radius, w.width, 12]} />
          <meshLambertMaterial color={PIPA_MATERIALS.llanta} />
        </mesh>
        {/* El rin va aparte: se croma sin tocar la llanta (Paso 5). */}
        <mesh name="rin" rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry
            args={[w.radius * 0.58, w.radius * 0.58, w.width * 1.05, 10]}
          />
          <MaterialCromable cromada={rinCromado} color={PIPA_MATERIALS.rin} />
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
  const lateral = usePlacaTexture(estilo.rotulo, estilo.calca, tanqueHex, 512, 160)
  const trasera = usePlacaTexture(estilo.rotulo, estilo.calca, tanqueHex, 256, 112)

  return (
    <group name="carroceria" scale={escala}>
      <group name="bastidor" position={[0, B.bastidor.y, 0]}>
        <mesh>
          <boxGeometry args={B.bastidor.size} />
          <meshLambertMaterial color={PIPA_MATERIALS.bastidor} />
        </mesh>
      </group>

      <group name="cabina" position={[0, B.cabina.y, B.cabina.z]}>
        <mesh>
          <boxGeometry args={B.cabina.size} />
          <meshLambertMaterial color={cabinaHex} />
        </mesh>
        <mesh name="parabrisas" position={[0, 0.35, 1.16]}>
          <boxGeometry args={[1.9, 0.85, 0.06]} />
          <meshLambertMaterial color={PIPA_MATERIALS.cabinaVidrio} />
        </mesh>
        {[-0.8, 0.8].map((x) => (
          <mesh key={x} name="faro" position={[x, -0.7, 1.16]}>
            <boxGeometry args={[0.45, 0.25, 0.06]} />
            <meshLambertMaterial color={PIPA_MATERIALS.faro} />
          </mesh>
        ))}
        {cromo.espejos && <Espejos />}
        {estilo.detalles.claxon === true && <Claxon />}
        {estilo.detalles.luces === true && <Luces />}
        {estilo.detalles.cortinas === true && <Cortina />}
      </group>

      {cromo.escapes && <Escapes />}

      <group name="tanque" position={[0, B.tanque.y, B.tanque.z]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry
            args={[B.tanque.radius, B.tanque.radius, B.tanque.length, 16]}
          />
          <meshLambertMaterial color={tanqueHex} />
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
            <meshLambertMaterial color={PIPA_MATERIALS.tanqueTapa} />
          </mesh>
        ))}
        <mesh name="escotilla" position={[0, B.tanque.radius, 0.6]}>
          <cylinderGeometry args={[0.32, 0.32, 0.2, 10]} />
          <meshLambertMaterial color={PIPA_MATERIALS.escotilla} />
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
                <meshLambertMaterial key="map" map={lateral} color="#ffffff" />
              ) : (
                <meshLambertMaterial key="plano" color={PIPA_MATERIALS.calca} />
              )}
            </mesh>
          ))}
          <mesh name="calca-trasera" position={[0, 0, B.calcaTrasera.z]}>
            <boxGeometry args={B.calcaTrasera.size} />
            {trasera ? (
              <meshLambertMaterial key="map" map={trasera} color="#ffffff" />
            ) : (
              <meshLambertMaterial key="plano" color={PIPA_MATERIALS.calca} />
            )}
          </mesh>
        </group>
      </group>

      <group name="defensa">
        <mesh position={[0, B.defensaFrente.y, B.defensaFrente.z]}>
          <boxGeometry args={B.defensaFrente.size} />
          <MaterialCromable
            cromada={cromo.defensa}
            color={PIPA_MATERIALS.defensa}
          />
        </mesh>
        <mesh position={[0, B.defensaAtras.y, B.defensaAtras.z]}>
          <boxGeometry args={B.defensaAtras.size} />
          <MaterialCromable
            cromada={cromo.defensa}
            color={PIPA_MATERIALS.defensa}
          />
        </mesh>
      </group>
    </group>
  )
}
