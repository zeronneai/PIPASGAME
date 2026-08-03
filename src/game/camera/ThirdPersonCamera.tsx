import { useCallback, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { useRapier, type RapierRigidBody } from '@react-three/rapier'
import type { Ray } from '@dimforge/rapier3d-compat'
import { Quaternion, Vector3, type PerspectiveCamera } from 'three'
import { tuning } from '../tuning'
import { consumeLook } from '../../state/inputStore'
import { useGameStore } from '../../state/gameStore'

const DEG = Math.PI / 180
const TAU = Math.PI * 2

// Temporales a nivel de módulo para no crear objetos cada frame
const _look = { x: 0, y: 0 }
const _wanted = new Vector3()
const _dir = new Vector3()
const _forward = new Vector3()
const _quat = new Quaternion()

/** Diferencia de ángulos por el camino corto, en [-π, π]. */
function angleDiff(target: number, current: number) {
  return (((target - current + Math.PI) % TAU) + TAU) % TAU - Math.PI
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
/** Arranca y termina suave; una rampa lineal se nota como un tirón. */
const suavizar = (t: number) => t * t * (3 - 2 * t)

/**
 * Cámara en tercera persona (Paso 4), ahora con dos objetivos (Paso 6).
 *
 * Orbita alrededor de un pivote que sigue al cuerpo activo según el modo, con
 * suavizado exponencial por delta time (no un factor fijo, o la suavidad
 * cambiaría con el framerate). El arrastre de la mitad derecha llega por el
 * inputStore. Un raycast desde el pivote hacia la cámara la acerca cuando hay
 * una pared en medio: acercarse es inmediato, alejarse es suave.
 *
 * Manejando se abre, se levanta y se recentra sola detrás de la pipa cuando
 * dejas de arrastrar (sección 4).
 */
export function ThirdPersonCamera({
  playerBody,
  vehicleBody,
}: {
  /** Cuerpos a excluir del raycast, para no chocar contra el propio objetivo. */
  playerBody: RefObject<RapierRigidBody | null>
  vehicleBody: RefObject<RapierRigidBody | null>
}) {
  const { rapier, world } = useRapier()
  const yaw = useRef(0)
  const pitch = useRef(tuning.camera.startPitch * DEG)
  const pivot = useRef(new Vector3())
  const distance = useRef(tuning.camera.distance)
  const placed = useRef(false)
  const idleTime = useRef(0)
  /** 0 = a pie, 1 = manejando. Cruza de un extremo al otro en modeTransition. */
  const modeBlend = useRef(0)
  // En un ref, no en useMemo: se reusa cada frame mutándole origen y dirección
  const rayRef = useRef<Ray | null>(null)

  /*
   * Durante la transición la cámara vuela entre el personaje y la pipa, y los
   * dos están a un par de metros: sin excluir a los dos, el raycast choca con
   * la pipa a media transición y la cámara pega un jalón. castRay solo acepta
   * un cuerpo excluido, así que se filtran ambos con un predicado.
   */
  const noSonElObjetivo = useCallback(
    (collider: { parent: () => RapierRigidBody | null }) => {
      const parent = collider.parent()
      return parent !== playerBody.current && parent !== vehicleBody.current
    },
    [playerBody, vehicleBody],
  )

  useFrame((state, delta) => {
    const cam = state.camera as PerspectiveCamera
    const dt = Math.min(delta, 1 / 30)
    const c = tuning.camera
    const driving = useGameStore.getState().mode === 'DRIVING'
    const target = driving ? vehicleBody.current : playerBody.current

    // Transición de medio segundo: un solo factor manda sobre el pivote, la
    // distancia, la altura y el FOV, así los cuatro llegan juntos.
    const paso = dt / Math.max(0.01, c.modeTransition)
    const destino = driving ? 1 : 0
    modeBlend.current +=
      Math.sign(destino - modeBlend.current) *
      Math.min(paso, Math.abs(destino - modeBlend.current))
    const e = suavizar(modeBlend.current)

    // Orbitar con el arrastre acumulado desde el frame anterior.
    // Arrastrar a la derecha gira la vista a la derecha; hacia abajo mira
    // hacia abajo (sin invertir, que es lo esperado en móvil).
    consumeLook(_look)
    if (_look.x !== 0 || _look.y !== 0) {
      idleTime.current = 0
      yaw.current -= _look.x * c.sensitivity
      pitch.current = Math.max(
        c.minPitch * DEG,
        Math.min(c.maxPitch * DEG, pitch.current + _look.y * c.sensitivity),
      )
    } else {
      idleTime.current += dt
    }

    // Manejando, la cámara regresa sola detrás de la pipa tras un momento sin
    // tocarla. A pie no: ahí mandas tú y recentrar marearía.
    if (driving && target && idleTime.current > c.driveRecenterDelay) {
      const r = target.rotation()
      _forward.set(0, 0, 1).applyQuaternion(_quat.set(r.x, r.y, r.z, r.w))
      // La cámara va detrás, o sea en la dirección contraria al frente.
      const behind = Math.atan2(-_forward.x, -_forward.z)
      yaw.current +=
        angleDiff(behind, yaw.current) * (1 - Math.exp(-c.driveRecenter * dt))
    }

    // Pivote: se mezcla del personaje a la pipa según la transición, leyendo
    // del store para que funcione aunque el cuerpo del personaje esté
    // deshabilitado mientras manejas.
    const height = lerp(c.height, c.driveHeight, e)
    const { player, vehicle } = useGameStore.getState()
    _wanted.set(
      lerp(player.pos.x, vehicle.pos.x, e),
      lerp(player.pos.y, vehicle.pos.y, e) + height,
      lerp(player.pos.z, vehicle.pos.z, e),
    )
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

    // Colisión: ¿hay algo entre el objetivo y donde quiere estar la cámara?
    const maxDistance = lerp(c.distance, c.driveDistance, e)
    let wanted = maxDistance
    const ray = (rayRef.current ??= new rapier.Ray(
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 0 },
    ))
    ray.origin = pivot.current
    ray.dir = _dir
    const hit = world.castRay(
      ray,
      maxDistance + c.collisionRadius,
      true,
      undefined,
      undefined,
      undefined,
      undefined,
      noSonElObjetivo,
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

    // FOV: 70 a pie, 78 manejando, con la misma rampa que todo lo demás
    const targetFov = lerp(c.fovFoot, c.fovDrive, e)
    if (Math.abs(cam.fov - targetFov) > 0.01) {
      cam.fov = targetFov
      cam.updateProjectionMatrix()
    }
  })

  return null
}
