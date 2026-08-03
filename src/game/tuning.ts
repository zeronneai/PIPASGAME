/*
 * Valores de ajuste centralizados (sección 8 del doc). El panel de leva
 * (solo en desarrollo) escribe aquí en vivo con onChange; el código del
 * juego los lee de este objeto cada frame, así que los cambios se sienten
 * al instante sin re-renders ni recargas.
 */
export const tuning = {
  player: {
    walkSpeed: 4, // m/s
    runSpeed: 7, // m/s
    accel: 12, // qué tan rápido alcanza la velocidad objetivo
    decel: 16, // qué tan rápido frena al soltar
    turnSpeed: 12, // rotación del modelo hacia la dirección de movimiento
    gravity: 25, // m/s²
    runThreshold: 0.95, // magnitud del joystick a partir de la cual corre
    staminaDrain: 0.22, // resistencia gastada por segundo corriendo
    staminaRegen: 0.3, // resistencia recuperada por segundo
    staminaRecover: 0.3, // nivel mínimo para volver a correr tras agotarse
  },
  camera: {
    distance: 6, // metros detrás del jugador cuando no hay pared
    height: 1.5, // altura del pivote sobre los pies (la cabeza)
    followLerp: 10, // qué tan pegada sigue al jugador
    sensitivity: 0.005, // radianes de giro por píxel de arrastre
    startPitch: 12, // grados sobre el horizonte al empezar
    minPitch: -12, // grados; mirando desde abajo
    maxPitch: 62, // grados; mirando desde arriba
    minDistance: 1.2, // qué tanto puede acercarse contra una pared
    collisionRadius: 0.35, // colchón para no pegar el plano cercano al muro
    returnLerp: 4, // qué tan rápido se aleja al despejarse
    fovFoot: 70,
    fovDrive: 78, // se usa desde el Paso 8
    fovLerp: 6,
  },
}
