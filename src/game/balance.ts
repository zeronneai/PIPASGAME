import type { PerfilCliente } from './systems/clients'
/* Solo el TIPO, y a propósito: `garage.ts` importa este archivo, así que un
 * import de valor sería un ciclo. Un `import type` se borra al compilar y
 * deja los factores de las mejoras bien tipados aquí, que es donde se
 * escriben. */
import type { Categoria, Factores } from './systems/garage'
import type { Pieza as PiezaEstilo } from './systems/estilo'

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

/**
 * Lo que rinde y lo que cuesta cada nivel de mejora (Fase 2, sección 4).
 *
 * Va como constante tipada y no en línea dentro de `balance` para que el tipo
 * sea el MISMO para las seis categorías: en línea, TypeScript infiere una
 * forma distinta por categoría y entonces nada puede recorrerlas en un bucle
 * —ni el panel de leva, ni los tests, ni el propio garage—.
 */
export type MejoraBalance = {
  /** Precio de cada nivel, en orden. */
  precios: number[]
  /** Factores de cada nivel. Cada uno es el TOTAL de ese nivel. */
  niveles: Factores[]
}

const MEJORAS_GARAGE: Record<Categoria, MejoraBalance> = {
  tanque: {
    precios: [3_500, 8_000, 17_000],
    niveles: [
      { capacidad: 1.1, tara: 1.05 },
      { capacidad: 1.22, tara: 1.11 },
      { capacidad: 1.35, tara: 1.18 },
    ],
  },
  motor: {
    precios: [2_500, 6_000, 13_000],
    niveles: [
      { motor: 1.1, velocidad: 1.04, calor: 1.1 },
      { motor: 1.22, velocidad: 1.08, calor: 1.2 },
      { motor: 1.35, velocidad: 1.12, calor: 1.32 },
    ],
  },
  bomba: {
    precios: [4_000, 9_000, 18_000],
    niveles: [
      { carga: 1.15, descarga: 1.15 },
      { carga: 1.32, descarga: 1.32 },
      { carga: 1.5, descarga: 1.5 },
    ],
  },
  suspension: {
    precios: [1_800, 4_500, 9_000],
    niveles: [
      { suspension: 1.08, vuelco: 1.06, tara: 1.03 },
      { suspension: 1.16, vuelco: 1.12, tara: 1.06 },
      { suspension: 1.25, vuelco: 1.2, tara: 1.1 },
    ],
  },
  llantas: {
    precios: [4_200, 9_500, 19_000],
    niveles: [
      { agarre: 1.08, freno: 1.06 },
      { agarre: 1.17, freno: 1.12 },
      { agarre: 1.27, freno: 1.2 },
    ],
  },
  enfriamiento: {
    precios: [4_500, 10_000, 20_000],
    niveles: [
      { enfria: 1.15, calor: 0.92 },
      { enfria: 1.32, calor: 0.85 },
      { enfria: 1.5, calor: 0.78 },
    ],
  },
}

/**
 * El estilo (Fase 2, sección 5). Todo BARATO comparado con las mejoras — la
 * idea es que puedas verte bien desde temprano, no que sea el premio final.
 * Hay un test que no deja que nada de aquí rebase la mejora más barata.
 *
 * Pintura, rótulo y calca cobran CADA aplicada (quitar es gratis); las piezas
 * se compran una vez por pipa. El catálogo (colores, motivos, qué es cada
 * pieza) vive en `systems/estilo.ts`.
 */
const ESTILO_GARAGE: {
  pintura: { cabina: number; tanque: number }
  rotulo: number
  calca: number
  piezas: Record<PiezaEstilo, number>
} = {
  pintura: { cabina: 350, tanque: 550 },
  rotulo: 250,
  calca: 400,
  piezas: {
    defensa: 900,
    espejos: 700,
    escapes: 850,
    rines: 1_200,
    claxon: 500,
    luces: 650,
    cortinas: 300,
  },
}

export const balance = {
  tank: {
    /**
     * Litros de la pipa de REFERENCIA (la mediana estándar en México,
     * sección 2.1). Ya no es «la» capacidad: desde la Fase 2 cada modelo sale
     * de aquí por factor (`garage.ts`), así que mover este número mueve las
     * tres pipas de forma coherente en vez de descuadrarlas entre sí.
     */
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
     * Nivel que GANA la segunda (Fase 2, Paso 6): el primer hito, unas 3-5
     * entregas buenas arriba del arranque. A diferencia del radio (que se
     * pierde si la colonia te retira el saludo), la segunda es un LOGRO:
     * cruzarlo una vez la deja tuya para siempre.
     */
    segundaUnlock: 60,
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
  /** Clientes efímeros: casas y obras que aparecen y desaparecen sobre los
   *  spots del layout, para que el mundo no se sienta un circuito. */
  efimeros: {
    /** Cuántos pueden estar activos a la vez. */
    maxActivos: 5,
    /** Con cuántos amanece la colonia: el día NO empieza en seco — hay
     *  trabajo visible desde el primer minuto (arreglo de la entrada al
     *  ciclo: antes el mapa arrancaba vacío y 4 de 6 locales cerrados). */
    siembraInicial: 2,
    /** Segundos reales entre intentos de aparición (se sortea en el rango). */
    spawnMin: 10,
    spawnMax: 25,
    /** Minutos reales que se queda uno antes de irse. */
    vidaMin: 2.5,
    vidaMax: 5,
  },
  /** Rescate por caída fuera del mapa: fundido a negro y reaparición en el
   *  borde más cercano. Sin cobro — el castigo es puro tiempo perdido (el
   *  reloj de la jornada y los de los pedidos siguen corriendo). */
  rescate: {
    /** Duración total del fundido (oscurecer + aclarar), en segundos. */
    pausaSegundos: 2.5,
    /**
     * Enderezar una VOLCADURA. El castigo es tiempo y agua, no dinero —
     * igual que la caída. El fundido es más largo que el de caída porque el
     * error fue más grande, y el derrame es una fracción de los litros que
     * traías, interpolada entre min y max según lo brusco del golpe (la
     * velocidad a la que ibas cuando empezó a irse de lado, contra el tope
     * de tu pipa). Los umbrales de detección viven en tuning.vuelco.
     */
    volcadura: {
      pausaSegundos: 4,
      /** Fracción derramada volcando a velocidad tope. */
      derrameMax: 0.35,
      /** Fracción derramada aunque haya sido de ladito y despacio: el agua
       *  de arriba siempre se sale por la escotilla. */
      derrameMin: 0.1,
    },
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
    /** Probabilidad base con reputación 0 y con reputación 100. Con la
     *  reputación inicial (50) la base queda en 0.575: tocar puertas tiene
     *  que funcionar más veces de las que falla, o la entrada al ciclo se
     *  siente una tómbola. */
    repChanceMin: 0.25,
    repChanceMax: 0.9,
    /** Multiplicador fuera del horario del negocio. */
    offHoursFactor: 0.2,
    /** Multiplicador según historial: de «siempre me quedas mal» (todo muy
     *  tarde o cancelado) a «nunca me has fallado» (todo a tiempo). */
    historyMin: 0.25,
    historyMax: 1.4,
    /** «Si le surtiste ayer, no necesita hoy» — y hoy, menos todavía. */
    servedTodayFactor: 0.05,
    servedYesterdayFactor: 0.45,
    /** Enfriamiento tras un «no», en minutos reales del reloj de la jornada
     *  (1 min real = 1 hora de juego). */
    cooldownMinutes: 1,
    /** Enfriamiento cuando el que dijo que no fuiste TÚ (rechazar la oferta):
     *  más corto — explorar ofertas no castiga como un desplante. */
    cooldownPropioMinutes: 0.5,
    /** Piedad contra rachas: cada «no» seguido del cliente suma esto a la
     *  probabilidad del siguiente toque (con tope), y aceptar la resetea.
     *  Acota el peor caso de mala suerte a 3–4 puertas. */
    piedadPorRechazo: 0.12,
    piedadMax: 0.36,
    /** La probabilidad final nunca sale de este rango: siempre hay una
     *  esperanza y nunca una garantía. */
    chanceMin: 0.03,
    chanceMax: 0.95,
    /** Los pedidos se piden en litros «redondos». */
    litersStep: 100,
  },
  /**
   * Con cuánto dinero empieza una partida nueva.
   *
   * Tiene que alcanzar para ~MEDIO tanque de la pipa con la que amaneces (la
   * heredada, 5,000 L a 0.05 el litro), no para llenarlo: si alcanza para
   * llenar, la primera decisión del juego —¿cargo completo o guardo para
   * gasolina y llego más lejos?— deja de existir. Con la mediana este número
   * era 300; al arrancar en la heredada, 300 llenaba el tanque con sobra.
   */
  dineroInicial: 125,

  /*
   * EL GARAGE (Fase 2). Aquí va SOLO el dinero: qué hace cada modelo y cada
   * mejora vive en `systems/garage.ts`, que es catálogo y no economía.
   *
   * Estos precios son de arranque y el Paso 7 los va a mover muchísimo: la
   * meta del documento es que la primera mejora se sienta alcanzable en dos o
   * tres jornadas, y la segunda pipa en diez o quince.
   */
  garage: {
    /** Precio de cada modelo en el lote. La heredada no se compra: con esa
     *  empiezas, y por eso vale 0. */
    modelos: {
      heredada: 0,
      mediana: 45_000,
      grandota: 140_000,
    },
    /**
     * Las seis categorías de mejora: qué rinde cada nivel y qué cuesta.
     *
     * Los factores son MULTIPLICADORES sobre la pipa de referencia, y cada
     * nivel es el total de ese nivel, no un incremento sobre el anterior: así
     * el catálogo se lee como «con esto la pipa queda así» sin multiplicar
     * tres números de cabeza.
     *
     * LA REGLA (sección 4): casi toda mejora tiene que traer un costo. Si
     * todas son puro sí, no hay decisión, solo hay orden de compra. Las que no
     * cobran nada en la física —bomba, enfriamiento y por ahora llantas— se
     * pagan caras, y hay un test que no deja abaratarlas por debajo de las que
     * sí pesan.
     *
     * Qué significa cada eje está en `systems/garage.ts`, que es quien los
     * aplica; aquí solo viven los números, que son los que se mueven.
     */
    mejoras: MEJORAS_GARAGE,
    /** Los precios del estilo. Cosmético puro: barato, y con test que lo
     *  mantiene por debajo de la mejora más barata. */
    estilo: ESTILO_GARAGE,
  },
}

export type Balance = typeof balance
