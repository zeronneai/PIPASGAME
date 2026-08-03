import { useLayoutEffect, useMemo, useRef } from 'react'
import {
  CuboidCollider,
  CylinderCollider,
  RigidBody,
} from '@react-three/rapier'
import { Color, Matrix4, Quaternion, Vector3, type InstancedMesh } from 'three'
import {
  buildings,
  locales,
  roadTiles,
  sidewalks,
  topes,
  waterParts,
  type Box,
} from './layout'

// Temporales de módulo: solo se usan en el llenado inicial, pero no hay razón
// para asignar 400 objetos.
const _m = new Matrix4()
const _pos = new Vector3()
const _scale = new Vector3()
const _quat = new Quaternion()
const _color = new Color()

const COLOR = {
  road: '#6e6e73',
  sidewalk: '#8d8d93',
  tope: '#b9a44e',
  waterBase: '#6a6a70',
  waterPipe: '#4d8fbf',
  waterValve: '#37d0a7',
}

/**
 * Un draw call por conjunto: una geometría de cubo unitario, escalada por
 * instancia. Es la razón por la que toda la colonia cabe en ~10 draw calls.
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
  // Gris más claro entre más alto el edificio: sin esto la manzana es una
  // masa plana imposible de leer al caminar.
  const buildingColors = useMemo(
    () =>
      buildings.map((b) =>
        _color.setHSL(0, 0, 0.46 + ((b.size[1] - 5) / 17) * 0.2).getStyle(),
      ),
    [],
  )
  const localeColors = useMemo(() => locales.map((l) => l.color), [])
  const localeBoxes = useMemo<Box[]>(
    () => locales.map((l) => ({ pos: l.pos, size: l.size })),
    [],
  )

  return (
    <>
      <InstancedBoxes boxes={roadTiles} color={COLOR.road} />
      <InstancedBoxes boxes={sidewalks} color={COLOR.sidewalk} />
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
      <InstancedBoxes boxes={topes} color={COLOR.tope} />

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

      <WorldColliders />
    </>
  )
}

/**
 * Todo el mundo estático cuelga de un solo RigidBody fijo: son ~400 formas
 * primitivas, ni un trimesh. Rapier los mete al broad phase estático una vez
 * y no vuelve a tocarlos.
 */
function WorldColliders() {
  const cuboids = useMemo<Box[]>(
    () => [
      ...roadTiles,
      ...sidewalks,
      ...buildings,
      ...locales.map((l) => ({ pos: l.pos, size: l.size })),
      ...topes,
      waterParts.base,
      waterParts.valve,
    ],
    [],
  )

  return (
    <RigidBody type="fixed" colliders={false}>
      {cuboids.map((b, i) => (
        <CuboidCollider
          key={i}
          args={[b.size[0] / 2, b.size[1] / 2, b.size[2] / 2]}
          position={b.pos}
        />
      ))}
      <CylinderCollider
        args={[waterParts.pipe.height / 2, waterParts.pipe.radius]}
        position={waterParts.pipe.pos}
      />
    </RigidBody>
  )
}
