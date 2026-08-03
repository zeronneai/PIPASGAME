/*
 * Valores de ajuste centralizados (sección 8 del doc). El panel de leva
 * (solo en desarrollo) escribe aquí en vivo con onChange; el código del
 * juego los lee de este objeto cada frame, así que los cambios se sienten
 * al instante sin re-renders ni recargas.
 */
/**
 * Paso fijo de la física (60 Hz aunque el render vaya a 30, sección 2).
 *
 * Vive fuera de `tuning` porque no se ajusta en vivo: lo consumen tanto
 * `<Physics timeStep>` como `updateVehicle(dt)`, y tienen que ser el mismo
 * número. Ojo: dentro de un callback de `useBeforePhysicsStep` NO sirve leer
 * `world.timestep`, porque r3f-rapier lo asigna después de los callbacks.
 */
export const PHYSICS_STEP = 1 / 60

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
    fovDrive: 78,
    /**
     * Segundos que tarda la cámara en pasar del personaje a la pipa. Manda
     * sobre todo el cambio a la vez: pivote, distancia, altura y FOV.
     */
    modeTransition: 0.5,
    // Manejando la cámara se abre y se levanta: la pipa es larga y hay que
    // ver a dónde va, no la caja del tanque.
    driveDistance: 11,
    driveHeight: 2.6,
    /** Qué tan rápido se recentra detrás de la pipa al soltar el arrastre. */
    driveRecenter: 1.6,
    /** Segundos sin tocar la pantalla antes de empezar a recentrar. */
    driveRecenterDelay: 1,
  },
  interaction: {
    /** Radio de la zona de detección en la puerta de la pipa, en metros. */
    boardRadius: 3.5,
    /** Por debajo de esta velocidad (m/s) se puede bajar. */
    exitSpeed: 0.4,
    /**
     * Cada cuánto corre el escaneo de proximidad, en segundos. No cada frame:
     * la sección del Paso 9 pide throttle y esto ya lo deja listo.
     */
    scanInterval: 0.1,
  },
  slosh: {
    /**
     * Metros que se desplaza el agua por cada m/s² de aceleración, con el
     * tanque a la mitad. Es la perilla de «súbele hasta que se note».
     */
    response: 0.075,
    /**
     * Qué tan rápido regresa el agua al centro. Bajo = responde tarde, que es
     * justo lo que pide el documento.
     */
    stiffness: 6,
    /**
     * Tiene que quedarse POR DEBAJO de 2·√rigidez (con rigidez 6, debajo de
     * 4.9) o el sistema deja de sobrepasar y el chapoteo desaparece: el agua
     * llegaría tarde pero ya no se seguiría moviendo.
     */
    damping: 1.2,
    /**
     * Tope del desplazamiento, en metros. Es una RED DE SEGURIDAD, no una
     * perilla de tuning: si se alcanza en una maniobra normal, el agua satura
     * y los niveles 0.25, 0.5 y 0.75 empiezan a sentirse iguales, que es
     * justo lo contrario de la regla de diseño. Medido en el banco: con 0.8
     * se topaba y el gradiente hacia 0.5 caía de 1.35× a 1.16×.
     */
    maxOffset: 1,
  },
  vehicle: {
    /*
     * La masa varía con el nivel del tanque: tara más agua. Llena da las 12 t
     * de la sección 6, vacía la mitad, así que vacía acelera y frena mejor.
     * Ojo: los números de frenado medidos en el Paso 6 eran con 12 t fijas.
     */
    /** Masa en vacío, kg. */
    tareMass: 6000,
    /** Masa del agua con el tanque lleno, kg. */
    waterMass: 6000,
    /** Caja principal del chasis, en metros. */
    chassis: { width: 2.4, height: 1.6, length: 7.5 },
    /**
     * Centro de masa por debajo del centro geométrico. Una pipa es alta y con
     * el COM al centro se voltea en la primera vuelta cerrada. El Paso 7
     * mueve este punto en vivo con el chapoteo.
     */
    comY: -0.7,
    wheel: {
      radius: 0.55,
      width: 0.3,
      /** Separación lateral desde el eje del chasis. */
      halfTrack: 1.05,
      /** Posición del eje delantero y trasero sobre el eje Z (frente = +Z). */
      frontZ: 2.6,
      rearZ: -2.4,
      /** Altura del punto de anclaje respecto al centro del cuerpo. */
      connectionY: -0.1,
    },
    suspension: {
      restLength: 0.45,
      stiffness: 32,
      compression: 1.2,
      relaxation: 2.4,
      /** Tiene que superar con holgura las ~3 t que carga cada rueda. */
      maxForce: 120000,
      maxTravel: 0.3,
    },
    /*
     * OJO CON LAS UNIDADES, es el error más fácil de cometer aquí:
     * `setWheelEngineForce` recibe NEWTONS, pero `setWheelBrake` recibe un
     * IMPULSO por paso de física. Por eso los dos números no son comparables
     * aunque los dos "frenen o empujen". Medido en el banco headless:
     *   desaceleración ≈ (2 × brakeForce) / (masa / 60)
     * Con brakeForce a 8000 la pipa se detenía en 0.2 s, que es justo lo
     * contrario de lo que pide la sección 6.
     */
    /** Fuerza de motor por rueda motriz (las dos traseras), en newtons. */
    engineForce: 9000,
    /** Impulso de frenado por rueda; reparte más al frente, como un camión. */
    brakeForce: 350,
    brakeFrontBias: 0.6,
    /** Freno leve al soltar el acelerador: un camión no rueda libre. */
    engineBrake: 80,
    maxSpeed: 16, // m/s ≈ 58 km/h
    reverseSpeed: 6,
    frictionSlip: 2.6,
    sideFrictionStiffness: 1,
    linearDamping: 0.05,
    angularDamping: 0.6,
    steer: {
      maxDeg: 28, // tope del volante parado
      /** A velocidad máxima el tope se reduce a esta fracción. */
      speedFalloff: 0.35,
      /** Rad/s a los que el volante persigue la entrada. */
      speed: 1.6,
      /** Rad/s a los que regresa solo al centro. */
      returnSpeed: 2.6,
    },
  },
}
