import { tuning } from '../tuning'

/*
 * El tacto del manejo, como función pura.
 *
 * Está separado del hook a propósito: sin React ni Rapier encima, el banco de
 * pruebas headless puede medir el frenado, la aceleración y el radio de giro
 * ejecutando ESTA misma función, no una copia que se desincroniza al primer
 * ajuste. Solo depende de `tuning`.
 */

const DEG = Math.PI / 180

/** Entrada de manejo. La escribe la fuente de volante activa y el HUD. */
export type DriveInput = {
  /** Volante crudo, [-1, 1]. Negativo = izquierda. El suavizado NO va aquí. */
  steer: number
  /** Acelerador, [0, 1]. */
  throttle: number
  /** Freno, [0, 1]. */
  brake: number
}

export type DriveCommand = {
  /** Ángulo del volante en radianes, ya suavizado y topado. */
  steer: number
  /** Fuerza de motor por rueda motriz; negativa en reversa. */
  engine: number
  brakeFront: number
  brakeRear: number
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export function computeDrive(
  /** Velocidad longitudinal en m/s; negativa en reversa. */
  speed: number,
  input: DriveInput,
  /** Ángulo del volante del paso anterior, en radianes. */
  prevSteer: number,
  dt: number,
): DriveCommand {
  const t = tuning.vehicle
  const steerIn = clamp(input.steer, -1, 1)
  const throttleIn = clamp(input.throttle, 0, 1)
  const brakeIn = clamp(input.brake, 0, 1)

  // --- Volante ---
  // El tope se cierra con la velocidad: a 58 km/h una pipa con el volante a
  // fondo se acuesta, y este es el freno más barato contra eso.
  const speedRatio = Math.min(1, Math.abs(speed) / t.maxSpeed)
  const maxSteer =
    t.steer.maxDeg * DEG * (1 - (1 - t.steer.speedFalloff) * speedRatio)
  const target = steerIn * maxSteer
  // Velocidad angular constante, no lerp: un volante se gira, no se
  // interpola, y con lerp los últimos grados nunca llegan.
  const rate = (steerIn === 0 ? t.steer.returnSpeed : t.steer.speed) * dt
  const diff = target - prevSteer
  const steer = clamp(
    prevSteer + (Math.abs(diff) <= rate ? diff : Math.sign(diff) * rate),
    -maxSteer,
    maxSteer,
  )

  // --- Motor y freno ---
  let engine = 0
  let brake = 0
  if (brakeIn > 0) {
    if (speed > 0.5) {
      brake = brakeIn * t.brakeForce
    } else if (speed > -t.reverseSpeed) {
      // Parado y con el freno apretado: reversa. Evita un botón más.
      engine = -brakeIn * t.engineForce
    }
  } else if (throttleIn > 0) {
    if (speed < -0.5) {
      brake = throttleIn * t.brakeForce // primero detener la reversa
    } else if (speed < t.maxSpeed) {
      engine = throttleIn * t.engineForce
    }
  } else {
    brake = t.engineBrake // un camión no rueda libre
  }

  return {
    steer,
    engine,
    brakeFront: brake * t.brakeFrontBias,
    brakeRear: brake * (1 - t.brakeFrontBias),
  }
}
