import type { VehicleStats } from '../systems/garage'

/*
 * El tacto del manejo, como función pura.
 *
 * Está separado del hook a propósito: sin React ni Rapier encima, el banco de
 * pruebas headless puede medir el frenado, la aceleración y el radio de giro
 * ejecutando ESTA misma función, no una copia que se desincroniza al primer
 * ajuste.
 *
 * Desde la Fase 2 los números NO salen de `tuning`: entran por parámetro,
 * calculados por el garage a partir del modelo base y sus mejoras. Así el
 * mismo tacto sirve para las tres pipas, y el banco puede medir la que quiera
 * sin tocar un global.
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
  /** La segunda: se MANTIENE apretada, no es un toque. [0, 1]. */
  boost: number
}

/**
 * Estado del motor entre pasos. Se MUTA, igual que SloshState: es lo que
 * permite que computeDrive siga siendo una función pura medible por el banco.
 */
export type EngineState = {
  /** Temperatura, 0 a 1. */
  temp: number
  /** true al tocar el tope; se limpia al bajar de resumeTemp. */
  overheated: boolean
  /** Si la segunda está entrando de verdad este paso (para el HUD). */
  boostActive: boolean
}

export function createEngineState(): EngineState {
  return { temp: 0, overheated: false, boostActive: false }
}

export type DriveCommand = {
  /** Ángulo del volante en radianes, ya suavizado y topado. */
  steer: number
  /** Fuerza de motor por rueda motriz; negativa en reversa. */
  engine: number
  brakeFront: number
  brakeRear: number
}

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v))

export function computeDrive(
  /** Velocidad longitudinal en m/s; negativa en reversa. */
  speed: number,
  input: DriveInput,
  /** Ángulo del volante del paso anterior, en radianes. */
  prevSteer: number,
  dt: number,
  /** Estado del motor; se muta con la temperatura de este paso. */
  engine: EngineState,
  /** Las estadísticas de la pipa que se está manejando (garage.ts). */
  t: VehicleStats,
): DriveCommand {
  const steerIn = clamp(input.steer, -1, 1)
  const throttleIn = clamp(input.throttle, 0, 1)
  const brakeIn = clamp(input.brake, 0, 1)

  // --- Volante ---
  // El tope se cierra con la velocidad: a 58 km/h una pipa con el volante a
  // fondo se acuesta, y este es el freno más barato contra eso.
  const speedRatio = Math.min(1, Math.abs(speed) / t.maxSpeed)
  const maxSteer =
    t.steer.maxDeg * DEG * (1 - (1 - t.steer.speedFalloff) * speedRatio)
  /*
   * El signo se invierte aquí y no es un parche: el frente de la pipa mira a
   * +Z, así que su lado derecho es -X. Un ángulo de volante positivo sobre el
   * eje Y apunta las ruedas hacia +X, o sea hacia la IZQUIERDA de la pipa.
   * Sin esta inversión el botón derecho gira a la izquierda.
   */
  const target = -steerIn * maxSteer
  // Velocidad angular constante, no lerp: un volante se gira, no se
  // interpola, y con lerp los últimos grados nunca llegan.
  const rate = (steerIn === 0 ? t.steer.returnSpeed : t.steer.speed) * dt
  const diff = target - prevSteer
  const steer = clamp(
    prevSteer + (Math.abs(diff) <= rate ? diff : Math.sign(diff) * rate),
    -maxSteer,
    maxSteer,
  )

  // --- La segunda ---
  /*
   * Tres puertas, todas a la vez. Se mira el ángulo YA suavizado y no la
   * intención cruda, para que no entre en el instante en que sueltas el
   * volante saliendo de una curva, con las ruedas todavía torcidas.
   *
   * Se corta EN SECO al girar, no se desvanece: ahí está la tensión de la
   * mecánica, o eliges velocidad o eliges dar vuelta.
   */
  const b = t.boost
  const enRecta = Math.abs(steer) <= b.maxSteerDeg * DEG
  const boostActivo =
    input.boost > 0 && !engine.overheated && speed >= b.minSpeed && enRecta

  engine.temp = clamp(
    engine.temp + (boostActivo ? b.heatRate : -b.coolRate) * dt,
    0,
    1,
  )
  if (engine.temp >= 1) engine.overheated = true
  else if (engine.overheated && engine.temp <= b.resumeTemp) {
    engine.overheated = false
  }
  engine.boostActive = boostActivo

  // Multiplica newtons, no impulsos: empuja todo el tiempo que la traigas
  // apretada en vez de dar un golpe y soltarte.
  const fuerzaMotor =
    t.engineForce *
    (boostActivo ? b.forceMultiplier : 1) *
    (engine.overheated ? b.overheatPower : 1)
  const velocidadTope = t.maxSpeed + (boostActivo ? b.maxSpeedBonus : 0)

  // --- Motor y freno ---
  let motor = 0
  let brake = 0
  if (brakeIn > 0) {
    if (speed > 0.5) {
      brake = brakeIn * t.brakeForce
    } else if (speed > -t.reverseSpeed) {
      // Parado y con el freno apretado: reversa. Evita un botón más.
      motor = -brakeIn * fuerzaMotor
    }
  } else if (throttleIn > 0) {
    if (speed < -0.5) {
      brake = throttleIn * t.brakeForce // primero detener la reversa
    } else if (speed < velocidadTope) {
      motor = throttleIn * fuerzaMotor
    }
  } else {
    brake = t.engineBrake // un camión no rueda libre
  }

  return {
    steer,
    engine: motor,
    brakeFront: brake * t.brakeFrontBias,
    brakeRear: brake * (1 - t.brakeFrontBias),
  }
}
