import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useRapier } from '@react-three/rapier'
import { Color, Matrix4, Quaternion, Vector3, type InstancedMesh } from 'three'
import {
  groundSlab,
  hitos,
  locales,
  sidewalks,
  taller,
  topes,
  waterParts,
  worldColliderBoxes,
  worldColliderCylinders,
  type Box,
} from './layout'
import { Interactable } from './Interactable'
import { Pintado } from '../render/Pintado'
import { MUNDO } from '../render/paleta'
import { ColoniaFachadas } from './ColoniaFachadas'

// Temporales de módulo: solo se usan en el llenado inicial, pero no hay razón
// para asignar mil objetos.
const _m = new Matrix4()
const _pos = new Vector3()
const _scale = new Vector3()
const _quat = new Quaternion()
const _up = new Vector3(0, 1, 0)
const _color = new Color()

/* Los colores viven en `render/paleta.ts`. Este alias existe para no tocar
 * los veintitantos usos de abajo, y para que se lea de un golpe qué parte de
 * la colonia toma qué color. */
const COLOR = {
  asfalto: MUNDO.asfalto,
  banqueta: MUNDO.banqueta,
  barda: MUNDO.barda,
  tope: MUNDO.tope,
  taller: MUNDO.taller,
  tallerLetrero: MUNDO.tallerLetrero,
  waterBase: MUNDO.tomaBase,
  waterPipe: MUNDO.tomaTubo,
  waterValve: MUNDO.tomaValvula,
}

/**
 * Un draw call por conjunto: una geometría de cubo unitario, escalada y
 * ROTADA por instancia (los topes de las curvas van girados).
 */
function InstancedBoxes({
  boxes,
  color,
  instanceColors,
}: {
  boxes: Box[]
  color: string
  /** Color por instancia; si viene, `color` queda de multiplicador base. */
  instanceColors?: string[]
}) {
  const ref = useRef<InstancedMesh>(null)

  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i]
      _pos.set(b.pos[0], b.pos[1], b.pos[2])
      _scale.set(b.size[0], b.size[1], b.size[2])
      _quat.setFromAxisAngle(_up, b.rotY ?? 0)
      mesh.setMatrixAt(i, _m.compose(_pos, _quat, _scale))
      if (instanceColors) mesh.setColorAt(i, _color.set(instanceColors[i]))
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    // Sin esto el frustum culling usa una esfera de radio 1 y la malla
    // desaparece en cuanto la cámara deja de ver el origen.
    mesh.computeBoundingSphere()
  }, [boxes, instanceColors])

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, boxes.length]}>
      <boxGeometry />
      <Pintado color={color} />
    </instancedMesh>
  )
}

export function ColoniaGreybox() {
  const hitoBoxes = useMemo<Box[]>(
    () => hitos.map((h) => ({ pos: h.pos, size: h.size })),
    [],
  )
  const hitoColors = useMemo(() => hitos.map((h) => h.color), [])

  return (
    <>
      {/*
        El asfalto: una sola losa con la cara superior en y = 0. Las calles ya
        no son cajas — son el hueco que dejan las manzanas — así que no hay
        juntas entre segmentos ni el escalón anti z-fighting de antes.
      */}
      <mesh position={groundSlab.pos}>
        <boxGeometry args={groundSlab.size} />
        <Pintado color={COLOR.asfalto} />
      </mesh>

      <InstancedBoxes boxes={sidewalks} color={COLOR.banqueta} />

      {/*
        LA COLONIA (Fase 3, Paso 2). Los 1059 lotes y los seis locales ya no
        son cajas instanciadas de color plano: son una sola malla fusionada
        con color por vértice, con sus bandas de cal, sus manchas de humedad,
        sus ventanas, sus tinacos y los rótulos de los locales. Un draw call
        para todo, y ahí está lo que hace viable el detalle.
      */}
      <ColoniaFachadas />
      {/*
        Los cuatro hitos. Son lo único que sobresale del perfil de la colonia,
        y para eso están: se ven desde lejos y contestan «¿dónde estoy?» sin
        abrir el minimapa.
      */}
      <InstancedBoxes
        boxes={hitoBoxes}
        color="#ffffff"
        instanceColors={hitoColors}
      />

      <InstancedBoxes boxes={topes} color={COLOR.tope} />

      {/*
        El taller: la nave y su letrero. Se llega manejando (sección 2 de la
        Fase 2), así que lo que tiene que verse desde la calle es el letrero.
      */}
      <mesh position={taller.pos}>
        <boxGeometry args={taller.size} />
        <Pintado color={COLOR.taller} />
      </mesh>
      <mesh position={taller.letrero.pos}>
        <boxGeometry args={taller.letrero.size} />
        <Pintado color={COLOR.tallerLetrero} />
      </mesh>

      {/*
        La glorieta ya NO se dibuja aquí. Era un cilindro liso más una caja
        de 6×2.5×6 —«una caja roja flotando sobre el pasto»— y ahora es una
        plaza entera (guarnición pintada, caminos radiales, jardineras y un
        kiosco con columnas) que se construye dentro de la malla fusionada de
        `fachadas.ts`. Ahí cuesta cero draw calls; aquí costaba dos y se veía
        peor. Los colliders no se movieron: siguen saliendo de `layout.ts`.
      */}

      {/* Toma de agua: pocas piezas, no vale la pena instanciar */}
      <mesh position={waterParts.base.pos}>
        <boxGeometry args={waterParts.base.size} />
        <Pintado color={COLOR.waterBase} />
      </mesh>
      <mesh position={waterParts.pipe.pos}>
        <cylinderGeometry
          args={[
            waterParts.pipe.radius,
            waterParts.pipe.radius,
            waterParts.pipe.height,
            12,
          ]}
        />
        <Pintado color={COLOR.waterPipe} />
      </mesh>
      <mesh position={waterParts.valve.pos}>
        <boxGeometry args={waterParts.valve.size} />
        <Pintado color={COLOR.waterValve} />
      </mesh>

      {/*
        Los seis locales usan Interactable. Sin radio propio: así toman el de
        tuning y se puede ajustar en vivo desde leva para los seis a la vez.
        Se registra la PUERTA y no el centro del local.
      */}
      {locales.map((l) => (
        <Interactable
          key={l.id}
          id={l.id}
          label="Ofrecer servicio"
          position={l.door}
        />
      ))}

      <WorldColliders />
    </>
  )
}

/**
 * Todo el mundo estático cuelga de UN cuerpo fijo, y los colliders se crean
 * DIRECTO contra Rapier en vez de con un componente por caja.
 *
 * El motivo es el conteo: seguir el borde de una curva a medio metro cuesta
 * más de mil cuboides. Para Rapier eso no es nada (son estáticos, entran una
 * vez al BVH y ahí se quedan), pero mil componentes de React con su estado y
 * su ciclo de vida sí se sienten al montar la escena. Aquí es una pasada de
 * mil llamadas y se acabó.
 *
 * Cada caja que se dibuja tiene su collider y cada collider se dibuja: no hay
 * muros invisibles ni fachadas que se atraviesen.
 */
function WorldColliders() {
  const { rapier, world } = useRapier()

  useEffect(() => {
    // Las listas viven en layout.ts (worldColliderBoxes/Cylinders): son las
    // MISMAS de las que sale el conteo de layoutStats y el visor de debug —
    // una sola fuente, imposible que diverjan.
    const body = world.createRigidBody(rapier.RigidBodyDesc.fixed())
    for (const b of worldColliderBoxes) {
      const desc = rapier.ColliderDesc.cuboid(
        b.size[0] / 2,
        b.size[1] / 2,
        b.size[2] / 2,
      ).setTranslation(b.pos[0], b.pos[1], b.pos[2])
      if (b.rotY) {
        const half = b.rotY / 2
        desc.setRotation({ x: 0, y: Math.sin(half), z: 0, w: Math.cos(half) })
      }
      world.createCollider(desc, body)
    }
    for (const c of worldColliderCylinders) {
      world.createCollider(
        rapier.ColliderDesc.cylinder(c.height / 2, c.radius).setTranslation(
          ...c.pos,
        ),
        body,
      )
    }

    return () => {
      world.removeRigidBody(body)
    }
  }, [rapier, world])

  return null
}
