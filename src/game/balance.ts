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
    /** Minijuego de la manguera sin derramar (Paso 5). */
    minijuegoLimpio: 1,
    derrame: -2,
    /** Cancelar un pedido aceptado, venga de donde venga. */
    cancelacion: -8,
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
