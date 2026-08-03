import { useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { useRapier, type RapierRigidBody } from '@react-three/rapier'
import type { Ray } from '@dimforge/rapier3d-compat'
import { Vector3, type PerspectiveCamera } from 'three'
import { tuning } from '../tuning'
import { consumeLook } from '../../state/inputStore'
import { useGameStore } from '../../state/gameStore'

const DEG = Math.PI / 180

// Temporales a nivel de módulo para no crear objetos cada frame
const _look = { x: 0, y: 0 }
const _wanted = new Vector3()
const _dir = new Vector3()

/**
 * Cámara en tercera persona (Paso 4).
 *
 * Orbita alrededor de un pivote que sigue al cuerpo objetivo con suavizado
 * exponencial por delta time (no un factor fijo, o la suavidad cambiaría con
 * el framerate). El arrastre de la mitad derecha llega por el inputStore.
 * Un raycast desde el pivote hacia la cámara la acerca cuando hay una pared
 * en medio: acercarse es inmediato, alejarse es suave.
 */
export function ThirdPersonCamera({
  targetBody,
}: {
  /** Cuerpo al que sigue; se excluye del raycast para no chocar consigo mismo. */
  targetBody: RefObject<RapierRigidBody | null>
}) {
  const { rapier, world } = useRapier()
  const yaw = useRef(0)
  const pitch = useRef(tuning.camera.startPitch * DEG)
  const pivot = useRef(new Vector3())
  const distance = useRef(tuning.camera.distance)
  const placed = useRef(false)
  // En un ref, no en useMemo: se reusa cada frame mutándole origen y dirección
  const rayRef = useRef<Ray | null>(null)

  useFrame((state, delta) => {
    const cam = state.camera as PerspectiveCamera
    const dt = Math.min(delta, 1 / 30)
    const c = tuning.camera
    const { pos } = useGameStore.getState().player

    // Orbitar con el arrastre acumulado desde el frame anterior.
    // Arrastrar a la derecha gira la vista a la derecha; hacia abajo mira
    // hacia abajo (sin invertir, que es lo esperado en móvil).
    consumeLook(_look)
    yaw.current -= _look.x * c.sensitivity
    pitch.current = Math.max(
      c.minPitch * DEG,
      Math.min(c.maxPitch * DEG, pitch.current + _look.y * c.sensitivity),
    )

    // Pivote: la cabeza del jugador, seguida con suavizado
    _wanted.set(pos.x, pos.y + c.height, pos.z)
    if (placed.current) {
      pivot.current.lerp(_wanted, 1 - Math.exp(-c.followLerp * dt))
    } else {
      pivot.current.copy(_wanted)
      placed.current = true
    }

    // Dirección del pivote hacia la cámara (esférica, ya normalizada)
    const cosPitch = Math.cos(pitch.current)
    _dir.set(
      cosPitch * Math.sin(yaw.current),
      Math.sin(pitch.current),
      cosPitch * Math.cos(yaw.current),
    )

    // Colisión: ¿hay algo entre el jugador y donde quiere estar la cámara?
    let wanted = c.distance
    const ray = (rayRef.current ??= new rapier.Ray(
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 0 },
    ))
    ray.origin = pivot.current
    ray.dir = _dir
    const hit = world.castRay(
      ray,
      c.distance + c.collisionRadius,
      true,
      undefined,
      undefined,
      undefined,
      targetBody.current ?? undefined,
    )
    if (hit) {
      wanted = Math.max(c.minDistance, hit.timeOfImpact - c.collisionRadius)
    }
    // Acercarse tiene que ser inmediato o la pared se ve por dentro; alejarse
    // suave, para que salir de un callejón no dé un tirón hacia atrás.
    distance.current =
      wanted < distance.current
        ? wanted
        : distance.current +
          (wanted - distance.current) * (1 - Math.exp(-c.returnLerp * dt))

    cam.position.copy(pivot.current).addScaledVector(_dir, distance.current)
    cam.lookAt(pivot.current)

    // FOV: 70 a pie, 78 manejando (el modo llega en el Paso 8)
    const targetFov =
      useGameStore.getState().mode === 'DRIVING' ? c.fovDrive : c.fovFoot
    if (Math.abs(cam.fov - targetFov) > 0.01) {
      cam.fov += (targetFov - cam.fov) * (1 - Math.exp(-c.fovLerp * dt))
      cam.updateProjectionMatrix()
    }
  })

  return null
}
