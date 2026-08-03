import type { PerfilCliente } from './systems/clients'

/*
 * TODOS los números de la economía viven aquí, separados de tuning.ts
 * (sección 7 del doc de Fase 1): tuning es cómo se SIENTE el juego,
 * balance es cuánto CUESTA y cuánto PAGA. Igual que tuning, el panel de
 * leva escribe sobre este objeto en vivo y el juego lo lee al momento
 * de calcular, así que se puede rebalancear sin recargar.
 *
 * Dinero en pesos (MXN), agua en litros, tiempos de ventana en minutos
 * REALES: la jornada dura 10-15 min reales, así que una ventana de 5 min
 * es un tercio del día del jugador.
 */

export type PerfilBalance = {
  /** Lo que paga el cliente por litro entregado. */
  sellPricePerLiter: number
  /** Propina sobre el pago base si llegas a tiempo, como fracción. */
  tipPct: number
  /** Minutos desde que aceptas hasta que la entrega cuenta como tarde. */
  windowMinutes: number
  /**
   * Hasta cuántas ventanas tolera antes de pasar de «tarde» a «muy tarde»,
   * como multiplicador. Paciente 2.0 = te perdona una ventana entera más;
   * exigente 1.15 = casi nada. Es la personalidad del cliente en un número.
   */
  lateFactor: number
  /** Fracción del pago base si llegas tarde (la propina ya se perdió). */
  latePayFactor: number
  /** Fracción del pago base si llegas muy tarde. En el exigente no aplica:
   *  cancela el pedido y no paga nada. */
  veryLatePayFactor: number
  /** Rango de litros que pide (lo usa la generación de pedidos del Paso 3). */
  litros: { min: number; max: number }
  /** Cambio de reputación por entrega, según puntualidad. */
  rep: { onTime: number; late: number; veryLate: number }
}

export const balance = {
  tank: {
    /** Litros. La pipa mediana estándar en México (sección 2.1). */
    capacity: 10_000,
  },
  pozo: {
    /** Precio de COMPRA por litro. Aquí está el margen del jugador. */
    pricePerLiter: 0.05,
    /** Velocidad de carga. 170 L/s ≈ un minuto para llenar de cero. */
    litersPerSecond: 170,
  },
  /*
   * Los tres arquetipos de la sección 2.3. La regla del trade-off: el que
   * mejor paga es el que más te puede quemar. Paciente pide poco y perdona;
   * exigente pide mucho, paga mejor por litro, y cancela si te tardas.
   */
  perfiles: {
    paciente: {
      sellPricePerLiter: 0.1,
      tipPct: 0.1,
      windowMinutes: 8,
      lateFactor: 2.0,
      latePayFactor: 0.9,
      veryLatePayFactor: 0.4,
      litros: { min: 500, max: 1500 },
      rep: { onTime: 2, late: 0, veryLate: -3 },
    },
    normal: {
      sellPricePerLiter: 0.13,
      tipPct: 0.08,
      windowMinutes: 5,
      lateFactor: 1.5,
      latePayFactor: 0.75,
      veryLatePayFactor: 0.3,
      litros: { min: 1500, max: 3500 },
      rep: { onTime: 3, late: -2, veryLate: -4 },
    },
    exigente: {
      sellPricePerLiter: 0.18,
      tipPct: 0.15,
      windowMinutes: 3,
      lateFactor: 1.15,
      latePayFactor: 0.6,
      // No se usa: muy tarde el exigente cancela (economy.ts paga 0).
      veryLatePayFactor: 0,
      litros: { min: 4000, max: 6000 },
      rep: { onTime: 5, late: -4, veryLate: -8 },
    },
  } satisfies Record<PerfilCliente, PerfilBalance>,
  reputacion: {
    /** Con la que arranca cada colonia. */
    start: 50,
    min: 0,
    max: 100,
    /** Nivel que desbloquea el radio de despacho (el hito de la fase). */
    radioUnlock: 70,
    /**
     * La conexión de la reputación con los PAGOS (Paso 6): la propina escala
     * con la reputación de la colonia, de tipFactorMin (rep 0) a tipFactorMax
     * (rep máxima). Solo la propina: el precio pactado se respeta, pero al
     * pipero de confianza le dan más y al desconocido casi nada. Y como la
     * propina solo existe a tiempo, la conexión premia justo lo que debe.
     */
    tipFactorMin: 0.5,
    tipFactorMax: 1.5,
    /** Minijuego de la manguera sin derramar (Paso 5). */
    minijuegoLimpio: 1,
    derrame: -2,
    /** Cancelar un pedido aceptado, venga de donde venga. */
    cancelacion: -8,
  },
  /*
   * El minijuego de la manguera (sección 2.6): conectar, controlar la
   * presión, no derramar. Máximo diez segundos, porque se repite cientos de
   * veces. La banda buena de presión se pasea (seno determinista) para pedir
   * microcorrecciones; sobre la banda se derrama, debajo apenas fluye.
   */
  entrega: {
    /** Duración máxima del minijuego en segundos. El tope de diseño. */
    maxSeconds: 10,
    /** Litros por segundo con la presión en la banda. 900 L/s surte el
     *  pedido más grande (6000 L) en ~6.7 s, que deja aire para conectar. */
    flowInZone: 900,
    /** Flujo con la presión por debajo de la banda: pierdes tiempo. */
    flowLow: 200,
    /** Derrame en L/s con la presión por encima de la banda. */
    spillRate: 350,
    /** Derrame fijo por fallar el timing de conexión. */
    badConnectSpill: 120,
    /** Segundos que tarda el marcador de conexión en ir y volver. */
    connectPeriod: 1.6,
    /** Ancho de la zona buena de conexión, en fracción de la barra. */
    connectZoneSize: 0.24,
    /** Velocidad de la presión (fracción de la barra por segundo). */
    pressureRise: 1.4,
    pressureFall: 1.8,
    /** Banda buena de presión: ancho, centro y vaivén (amplitud y rad/s). */
    zoneSize: 0.26,
    zoneCenterBase: 0.6,
    zoneAmp: 0.16,
    zoneSpeed: 0.9,
    /** Derrame tolerado (fracción del pedido) para contar como limpio. */
    cleanFraction: 0.02,
    /** Bono sobre el pago por entrega limpia («hacerlo bien da un bono»). */
    cleanBonusPct: 0.12,
  },
  pedidos: {
    /**
     * Fracción FINAL de la ventana en la que el reloj del pedido entra en
     * alerta (0.25 = el último cuarto). Es el «apúrate» antes del castigo.
     */
    warnFraction: 0.25,
  },
  /*
   * El radio de despacho (sección 2.8): con la reputación llegan pedidos
   * solos. La prioridad 0..1 es tu lugar en la lista del despacho: rechazar
   * la baja, aceptar la recupera, y baja prioridad = llamadas más espaciadas.
   */
  radio: {
    /** Pagan mejor que a pie: ya no gastaste tiempo caminando. */
    payFactor: 1.25,
    /** Intervalo entre llamadas en segundos reales, con prioridad 1. La
     *  prioridad divide: con 0.5 tardan el doble. */
    intervaloMin: 25,
    intervaloMax: 55,
    /** La primera llamada tras el desbloqueo llega casi de inmediato: el
     *  «se siente como recompensa» es que el radio suene YA. */
    primeraLlamada: 5,
    /** Segundos reales para contestar antes de que la llamada se pierda
     *  (y perderla también baja prioridad: dejaste colgado al despacho). */
    timeoutLlamada: 10,
    /** Piso de la prioridad: nunca te borran del todo de la lista. */
    prioridadMin: 0.25,
    bajaPorRechazo: 0.15,
    recuperaPorAceptar: 0.3,
  },
  jornada: {
    /** Duración del día de juego en minutos reales (sección 2.9: 10 a 15). */
    minutosReales: 12,
    /** El día de juego corre de las 7 am a las 7 pm: los minutos reales se
     *  reparten linealmente entre estas dos horas. */
    startHour: 7,
    endHour: 19,
  },
  /*
   * El sistema de aceptación (sección 2.4). Probabilidad ponderada, nada de
   * azar puro: una base que sale de la reputación (el factor de mayor peso)
   * multiplicada por hora, historial y si ya tiene agua. Los multiplicadores
   * neutros valen 1; castigar es bajar de 1.
   */
  aceptacion: {
    /** Probabilidad base con reputación 0 y con reputación 100. */
    repChanceMin: 0.08,
    repChanceMax: 0.85,
    /** Multiplicador fuera del horario del negocio. */
    offHoursFactor: 0.2,
    /** Multiplicador según historial: de «siempre me quedas mal» (todo muy
     *  tarde o cancelado) a «nunca me has fallado» (todo a tiempo). */
    historyMin: 0.25,
    historyMax: 1.4,
    /** «Si le surtiste ayer, no necesita hoy» — y hoy, menos todavía. */
    servedTodayFactor: 0.05,
    servedYesterdayFactor: 0.45,
    /** Enfriamiento tras un «no», en minutos reales del reloj de la jornada. */
    cooldownMinutes: 2.5,
    /** La probabilidad final nunca sale de este rango: siempre hay una
     *  esperanza y nunca una garantía. */
    chanceMin: 0.03,
    chanceMax: 0.95,
    /** Los pedidos se piden en litros «redondos». */
    litersStep: 100,
  },
  /** Con cuánto dinero empieza una partida nueva. Alcanza para ~medio tanque:
   *  la primera decisión del juego ya es cuánta agua cargar. */
  dineroInicial: 300,
}

export type Balance = typeof balance
