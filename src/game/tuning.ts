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
    // Cámara provisional; el Paso 4 la reemplaza por la ThirdPersonCamera
    offsetY: 5,
    offsetZ: 8,
    followLerp: 5,
  },
}
