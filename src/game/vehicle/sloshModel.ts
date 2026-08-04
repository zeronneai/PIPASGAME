import { tuning } from '../tuning'
import type { VehicleStats } from '../systems/garage'

/*
 * El chapoteo del agua, como función pura.
 *
 * Igual que driveModel.ts: sin React ni Rapier encima, para que el banco de
 * pruebas headless mida ESTA función y no una copia. Aquí es más importante
 * todavía, porque la regla de diseño del documento («media pipa debe ser más
 * difícil de manejar que llena o vacía») no se puede verificar a ojo.
 */

/** Posición del agua dentro del tanque y qué tan rápido se mueve. */
export type SloshState = {
  /** Desplazamiento lateral, en metros. Positivo hacia +X (izquierda). */
  x: number
  /** Desplazamiento longitudinal, en metros. Positivo hacia el frente (+Z). */
  z: number
  vx: number
  vz: number
}

export function createSloshState(): SloshState {
  return { x: 0, z: 0, vx: 0, vz: 0 }
}

/**
 * Cuánto chapotea el agua según el nivel del tanque.
 *
 * Vale exactamente 0 en vacío y en lleno, y exactamente 1 a la mitad, porque
 * la sección 6 lo pide así: «el efecto es máximo cerca de 0.5 y mínimo en 0.0
 * y 1.0». Es una CURVA DE DISEÑO escogida para cumplir esa regla al pie de la
 * letra, no una derivación de mecánica de fluidos. No la «corrijas» con una
 * fórmula más realista sin volver a medir la regla en el banco.
 */
export function sloshEnvelope(fillLevel: number): number {
  const f = Math.min(1, Math.max(0, fillLevel))
  return 4 * f * (1 - f)
}

/**
 * Avanza un paso del chapoteo. MUTA `state`, que es estable y se reusa.
 *
 * El agua es un oscilador de segundo orden amortiguado, que es exactamente lo
 * que produce las dos cualidades que pide el documento:
 *
 *   - rigidez baja  → el agua tarda en llegar: «responde tarde»
 *   - amortiguación por debajo de 2·√rigidez → subamortiguado: sobrepasa y
 *     sigue meciéndose después de que soltaste el freno, o sea «se sigue
 *     moviendo cuando ya frenaste»
 *
 * Si alguien sube la amortiguación por encima de ese umbral, el chapoteo
 * desaparece aunque los demás números se vean bien.
 */
export function stepSlosh(
  state: SloshState,
  /** Aceleración lateral del vehículo en su propio marco, m/s². */
  accelX: number,
  /** Aceleración longitudinal del vehículo en su propio marco, m/s². */
  accelZ: number,
  fillLevel: number,
  dt: number,
): SloshState {
  const t = tuning.slosh
  const envelope = sloshEnvelope(fillLevel)

  // El agua se apila del lado contrario a la aceleración: si aceleras hacia
  // adelante, se va hacia atrás.
  const targetX = -accelX * t.response * envelope
  const targetZ = -accelZ * t.response * envelope

  state.vx += (t.stiffness * (targetX - state.x) - t.damping * state.vx) * dt
  state.vz += (t.stiffness * (targetZ - state.z) - t.damping * state.vz) * dt
  state.x += state.vx * dt
  state.z += state.vz * dt

  // Tope para que el centro de masa no se salga del tanque
  const max = t.maxOffset
  if (state.x > max) {
    state.x = max
    if (state.vx > 0) state.vx = 0
  } else if (state.x < -max) {
    state.x = -max
    if (state.vx < 0) state.vx = 0
  }
  if (state.z > max) {
    state.z = max
    if (state.vz > 0) state.vz = 0
  } else if (state.z < -max) {
    state.z = -max
    if (state.vz < 0) state.vz = 0
  }

  return state
}

/**
 * Aceleración de la pipa en su propio marco, en m/s².
 *
 * La parte delicada del chapoteo es de dónde sale este número. Derivar la
 * velocidad del mundo llega sucio: la suspensión rebota y esa basura se
 * metería directo al agua, que se sentiría como vibración en vez de peso.
 *
 *   - longitudinal: derivada de currentVehicleSpeed(), que ya viene suave
 *   - lateral: velocidad · velocidadAngularY, la aceleración centrípeta real
 *     de la curva, que sale limpia sin derivar nada
 */
export function localAccel(
  speed: number,
  prevSpeed: number,
  angvelY: number,
  dt: number,
) {
  return { x: speed * angvelY, z: (speed - prevSpeed) / dt }
}

/** Masa total según el nivel: tara más el agua que trae. La tara y el agua
 *  son de la pipa equipada, que las calcula el garage. */
export function totalMass(fillLevel: number, v: VehicleStats): number {
  return v.tareMass + v.waterMass * Math.min(1, Math.max(0, fillLevel))
}
