import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useRapier } from '@react-three/rapier'
import { Color, Matrix4, Quaternion, Vector3, type InstancedMesh } from 'three'
import {
  BARDA_ALTURA,
  buildings,
  groundSlab,
  hitos,
  isla,
  kiosco,
  locales,
  sidewalks,
  taller,
  topes,
  waterParts,
  type Box,
} from './layout'
import { Interactable } from './Interactable'

// Temporales de módulo: solo se usan en el llenado inicial, pero no hay razón
// para asignar mil objetos.
const _m = new Matrix4()
const _pos = new Vector3()
const _scale = new Vector3()
const _quat = new Quaternion()
const _up = new Vector3(0, 1, 0)
const _color = new Color()

const COLOR = {
  asfalto: '#54545a',
  banqueta: '#8d8d93',
  barda: '#8a7f6b',
  tope: '#b9a44e',
  isla: '#6f7a5f',
  kiosco: '#9a8a5c',
  taller: '#57616e',
  tallerLetrero: '#e0a33a',
  waterBase: '#6a6a70',
  waterPipe: '#4d8fbf',
  waterValve: '#37d0a7',
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
      <meshStandardMaterial color={color} />
    </instancedMesh>
  )
}

export function ColoniaGreybox() {
  /*
   * Gris más claro entre más alto: sin esto la manzana es una masa plana
   * imposible de leer al caminar. El rango va apretado (2.8 a 6.6 m) porque la
   * colonia es de una y dos plantas, así que el contraste se reparte ahí y no
   * en una escala de rascacielos que ya no existe. Los patios van en tono de
   * adobe, para que se lean como barda de predio y no como casa chaparra.
   */
  const buildingColors = useMemo(
    () =>
      buildings.map((b) =>
        b.size[1] <= BARDA_ALTURA + 0.01
          ? COLOR.barda
          : _color
              .setHSL(0, 0, 0.4 + Math.min(1, (b.size[1] - 2.8) / 3.8) * 0.26)
              .getStyle(),
      ),
    [],
  )
  const hitoBoxes = useMemo<Box[]>(
    () => hitos.map((h) => ({ pos: h.pos, size: h.size })),
    [],
  )
  const hitoColors = useMemo(() => hitos.map((h) => h.color), [])
  const localeColors = useMemo(() => locales.map((l) => l.color), [])
  const localeBoxes = useMemo<Box[]>(
    () => locales.map((l) => ({ pos: l.pos, size: l.size })),
    [],
  )

  return (
    <>
      {/*
        El asfalto: una sola losa con la cara superior en y = 0. Las calles ya
        no son cajas — son el hueco que dejan las manzanas — así que no hay
        juntas entre segmentos ni el escalón anti z-fighting de antes.
      */}
      <mesh position={groundSlab.pos}>
        <boxGeometry args={groundSlab.size} />
        <meshStandardMaterial color={COLOR.asfalto} />
      </mesh>

      <InstancedBoxes boxes={sidewalks} color={COLOR.banqueta} />
      <InstancedBoxes
        boxes={buildings}
        color="#ffffff"
        instanceColors={buildingColors}
      />
      <InstancedBoxes
        boxes={localeBoxes}
        color="#ffffff"
        instanceColors={localeColors}
      />
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
        <meshStandardMaterial color={COLOR.taller} />
      </mesh>
      <mesh position={taller.letrero.pos}>
        <boxGeometry args={taller.letrero.size} />
        <meshStandardMaterial color={COLOR.tallerLetrero} />
      </mesh>

      {/* La isla de la glorieta y su kiosco: el obstáculo que obliga a rodear. */}
      <mesh position={isla.pos}>
        <cylinderGeometry args={[isla.radius, isla.radius, isla.height, 24]} />
        <meshStandardMaterial color={COLOR.isla} />
      </mesh>
      <mesh position={kiosco.pos}>
        <boxGeometry args={kiosco.size} />
        <meshStandardMaterial color={COLOR.kiosco} />
      </mesh>

      {/* Toma de agua: pocas piezas, no vale la pena instanciar */}
      <mesh position={waterParts.base.pos}>
        <boxGeometry args={waterParts.base.size} />
        <meshStandardMaterial color={COLOR.waterBase} />
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
        <meshStandardMaterial color={COLOR.waterPipe} />
      </mesh>
      <mesh position={waterParts.valve.pos}>
        <boxGeometry args={waterParts.valve.size} />
        <meshStandardMaterial color={COLOR.waterValve} />
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
    const cuboides: Box[] = [
      groundSlab,
      ...sidewalks,
      ...buildings,
      ...locales.map((l) => ({ pos: l.pos, size: l.size })),
      ...hitos.map((h) => ({ pos: h.pos, size: h.size })),
      { pos: taller.pos, size: taller.size },
      ...topes,
      kiosco,
      waterParts.base,
      waterParts.valve,
    ]

    const body = world.createRigidBody(rapier.RigidBodyDesc.fixed())
    for (const b of cuboides) {
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

    // La isla de la glorieta y el tubo de la toma, que son cilindros.
    world.createCollider(
      rapier.ColliderDesc.cylinder(isla.height / 2, isla.radius).setTranslation(
        ...isla.pos,
      ),
      body,
    )
    world.createCollider(
      rapier.ColliderDesc.cylinder(
        waterParts.pipe.height / 2,
        waterParts.pipe.radius,
      ).setTranslation(...waterParts.pipe.pos),
      body,
    )

    return () => {
      world.removeRigidBody(body)
    }
  }, [rapier, world])

  return null
}
