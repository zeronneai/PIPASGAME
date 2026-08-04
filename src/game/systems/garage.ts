/*
 * EL GARAGE: qué es cada pipa y cuánto rinde con lo que le pusiste.
 *
 * Funciones puras, sin React, sin Rapier y sin el store — igual que
 * `economy.ts`, y por la misma razón: los tests las miden solas y el juego las
 * llama con los objetos vivos, así que leva sigue ajustando en vivo.
 *
 * LA IDEA DE FONDO: modelos y mejoras NO son números absolutos, son FACTORES
 * sobre la pipa de referencia (`tuning.vehicle` y `balance.tank.capacity`).
 * Eso sostiene dos cosas a la vez:
 *
 *   1. Los sliders de leva conservan su significado. Mueves la referencia y se
 *      mueven las tres pipas de forma coherente, en vez de tener que re-tunear
 *      cada modelo a mano.
 *   2. La mediana de fábrica reproduce `tuning.vehicle` EXACTAMENTE, porque
 *      todos sus factores son 1. Es la prueba de que el refactor de la Fase 2
 *      no movió la física, y está escrita como test.
 *
 * Los precios NO viven aquí: viven en `balance.garage`, que es donde va el
 * dinero (tuning es cómo se SIENTE, balance es cuánto CUESTA).
 */

import { balance, type Balance } from '../balance'
import { tuning } from '../tuning'

/** La forma que consume la física. Se deriva del objeto de tuning a propósito:
 *  si alguien le agrega un campo, `computeStats` deja de compilar hasta que
 *  se decida de qué modelo o mejora depende. */
export type VehicleStats = typeof tuning.vehicle

export type ModeloId = 'heredada' | 'mediana' | 'grandota'

export type Categoria =
  'tanque' | 'motor' | 'bomba' | 'suspension' | 'llantas' | 'enfriamiento'

/** 0 = de fábrica. Tres niveles comprables (sección 4 del documento). */
export type Nivel = 0 | 1 | 2 | 3
export const NIVEL_MAX = 3

/**
 * Los ejes sobre los que se puede empujar una pipa. Modelos y mejoras hablan
 * este mismo vocabulario, que es lo que permite recorrer el catálogo en los
 * tests en vez de escribir a mano lo que hace cada cosa.
 */
export type Eje =
  | 'capacidad'
  | 'tara'
  | 'motor'
  | 'velocidad'
  | 'freno'
  | 'volante'
  | 'agarre'
  | 'escala'
  | 'calor'
  | 'enfria'
  | 'suspension'
  | 'vuelco'
  | 'carga'
  | 'descarga'

/** Factores multiplicativos. Lo que no viene es 1. */
export type Factores = Partial<Record<Eje, number>>

/**
 * Ejes en los que subir es PEOR. Con esto el catálogo se puede auditar solo:
 * una mejora que no empuja ninguno de estos es «puro sí», y el documento pide
 * que esas se paguen caras (sección 4).
 */
export const EJES_DE_COSTO: Eje[] = ['tara', 'calor']

export type Modelo = {
  id: ModeloId
  nombre: string
  /** Una línea para el taller: para qué sirve, no qué números trae. */
  perfil: string
  factores: Factores
}

/**
 * Los tres modelos base (sección 3).
 *
 * NINGUNO GANA EN TODO, y eso no es un detalle: si la grandota fuera superior
 * en todo, los otros dos dejan de existir y la progresión se acaba. Hay un
 * test que recorre los pares y lo verifica.
 *
 * La mediana es la referencia: todos sus factores son 1.
 */
export const MODELOS: Record<ModeloId, Modelo> = {
  heredada: {
    id: 'heredada',
    nombre: 'La heredada',
    perfil: 'Chica y ágil. Cabe donde las otras no, pero carga la mitad.',
    factores: {
      capacidad: 0.5,
      tara: 0.75,
      motor: 0.8,
      freno: 0.85,
      volante: 1.15,
      agarre: 1.05,
      escala: 0.9,
    },
  },
  mediana: {
    id: 'mediana',
    nombre: 'La mediana',
    perfil: 'La de siempre. Buena en todo, excelente en nada.',
    factores: {},
  },
  grandota: {
    id: 'grandota',
    nombre: 'La grandota',
    perfil: 'El doble de agua. Torpe, pesada y no entra a todos lados.',
    factores: {
      capacidad: 2,
      tara: 1.55,
      motor: 1.35,
      velocidad: 0.85,
      freno: 1.4,
      volante: 0.8,
      agarre: 0.9,
      escala: 1.2,
    },
  },
}

export type Mejora = {
  id: Categoria
  nombre: string
  /** Qué gana el jugador, en su idioma. */
  sube: string
  /** Qué le cuesta. Vacío = la mejora es limpia y por eso es cara. */
  cuesta: string
  /** Un juego de factores por nivel: [nivel 1, nivel 2, nivel 3]. */
  niveles: [Factores, Factores, Factores]
}

/**
 * Las seis categorías (sección 4). Regla de diseño: casi toda mejora trae un
 * costo. Si todas son puro sí, no hay decisión, solo hay orden de compra.
 *
 * Las que no cobran nada (bomba, enfriamiento) se compensan con precio alto en
 * `balance.garage`. Llantas por ahora también: su costo de diseño es el
 * desgaste, y ese sistema llega con el Paso 3.
 */
export const MEJORAS: Record<Categoria, Mejora> = {
  tanque: {
    id: 'tanque',
    nombre: 'Tanque',
    sube: 'Capacidad en litros',
    cuesta: 'Sube la tara: se vuelve más pesada',
    niveles: [
      { capacidad: 1.1, tara: 1.05 },
      { capacidad: 1.22, tara: 1.11 },
      { capacidad: 1.35, tara: 1.18 },
    ],
  },
  motor: {
    id: 'motor',
    nombre: 'Motor',
    sube: 'Aceleración y velocidad máxima',
    cuesta: 'Se calienta más rápido',
    niveles: [
      { motor: 1.1, velocidad: 1.04, calor: 1.1 },
      { motor: 1.22, velocidad: 1.08, calor: 1.2 },
      { motor: 1.35, velocidad: 1.12, calor: 1.32 },
    ],
  },
  bomba: {
    id: 'bomba',
    nombre: 'Bomba',
    sube: 'Velocidad de carga en el pozo y de descarga',
    cuesta: '',
    niveles: [
      { carga: 1.15, descarga: 1.15 },
      { carga: 1.32, descarga: 1.32 },
      { carga: 1.5, descarga: 1.5 },
    ],
  },
  suspension: {
    id: 'suspension',
    nombre: 'Suspensión',
    sube: 'Aguanta topes y baches, y se vuelca menos',
    cuesta: 'Sube la tara',
    niveles: [
      { suspension: 1.08, vuelco: 1.06, tara: 1.03 },
      { suspension: 1.16, vuelco: 1.12, tara: 1.06 },
      { suspension: 1.25, vuelco: 1.2, tara: 1.1 },
    ],
  },
  llantas: {
    id: 'llantas',
    nombre: 'Llantas',
    sube: 'Agarre en curva y frenado',
    cuesta: '',
    niveles: [
      { agarre: 1.08, freno: 1.06 },
      { agarre: 1.17, freno: 1.12 },
      { agarre: 1.27, freno: 1.2 },
    ],
  },
  enfriamiento: {
    id: 'enfriamiento',
    nombre: 'Enfriamiento',
    sube: 'Aguantas más la segunda antes de fundirla',
    cuesta: '',
    niveles: [
      { enfria: 1.15, calor: 0.92 },
      { enfria: 1.32, calor: 0.85 },
      { enfria: 1.5, calor: 0.78 },
    ],
  },
}

export const CATEGORIAS = Object.keys(MEJORAS) as Categoria[]

/** La configuración de UNA pipa. Las mejoras son por pipa, no globales: si
 *  compras la grandota, empieza sin nada (sección 4). */
export type PipaConfig = {
  modelo: ModeloId
  mejoras: Record<Categoria, Nivel>
}

/** Una pipa recién salida del lote: el modelo pelón. */
export function pipaDeFabrica(modelo: ModeloId): PipaConfig {
  return {
    modelo,
    mejoras: Object.fromEntries(CATEGORIAS.map((c) => [c, 0])) as Record<
      Categoria,
      Nivel
    >,
  }
}

export type PipaStats = {
  modelo: ModeloId
  /** Lo que le cabe de agua, en litros. */
  capacidadLitros: number
  /** Tamaño relativo a la pipa de referencia. Lo usa el visual para que lo
   *  que se ve mida lo mismo que lo que choca. */
  escala: number
  /** Misma forma que `tuning.vehicle`: los consumidores solo cambian de dónde
   *  lo sacan, no cómo lo usan. */
  fisica: VehicleStats
  /** Multiplicadores de la bomba. `carga` ya se usa en el pozo; `descarga`
   *  espera al Paso 3, cuando la manguera lea del garage. */
  bomba: { carga: number; descarga: number }
}

const nivelValido = (n: number): Nivel =>
  Math.max(0, Math.min(NIVEL_MAX, Math.floor(n || 0))) as Nivel

/**
 * Acumula los factores de un modelo y sus mejoras. Multiplicativo y en un solo
 * lugar: agregar un eje nuevo no obliga a tocar el cálculo de abajo.
 */
export function factoresDe(cfg: PipaConfig): Record<Eje, number> {
  const f = {} as Record<Eje, number>
  const aplicar = (src: Factores) => {
    for (const [eje, valor] of Object.entries(src)) {
      f[eje as Eje] = (f[eje as Eje] ?? 1) * valor
    }
  }
  aplicar((MODELOS[cfg.modelo] ?? MODELOS.mediana).factores)
  for (const cat of CATEGORIAS) {
    const nivel = nivelValido(cfg.mejoras?.[cat] ?? 0)
    // El nivel 2 NO acumula el 1: cada nivel es el factor TOTAL de ese nivel,
    // así el catálogo se lee como «con esto la pipa queda así» y no hay que
    // multiplicar tres números de cabeza para saber qué compras.
    if (nivel > 0) aplicar(MEJORAS[cat].niveles[nivel - 1])
  }
  return f
}

/**
 * Las estadísticas finales de una pipa. Es la única fuente de la que la física
 * saca sus números.
 *
 * `t` y `b` entran por parámetro con el objeto vivo por defecto: el juego las
 * llama sin ellos y leva se siente al instante; los tests pasan los suyos.
 */
export function computeStats(
  cfg: PipaConfig,
  t: VehicleStats = tuning.vehicle,
  b: Balance = balance,
): PipaStats {
  const f = factoresDe(cfg)
  const x = (eje: Eje) => f[eje] ?? 1

  const capacidad = x('capacidad')
  const escala = x('escala')

  return {
    modelo: MODELOS[cfg.modelo] ? cfg.modelo : 'mediana',
    capacidadLitros: b.tank.capacity * capacidad,
    escala,
    bomba: { carga: x('carga'), descarga: x('descarga') },
    fisica: {
      // El agua sigue a la capacidad: la grandota llena pesa lo que debe sin
      // teclear un número aparte.
      tareMass: t.tareMass * x('tara'),
      waterMass: t.waterMass * capacidad,
      chassis: {
        width: t.chassis.width * escala,
        height: t.chassis.height * escala,
        length: t.chassis.length * escala,
      },
      comY: t.comY * escala,
      wheel: {
        radius: t.wheel.radius * escala,
        width: t.wheel.width * escala,
        halfTrack: t.wheel.halfTrack * escala,
        frontZ: t.wheel.frontZ * escala,
        rearZ: t.wheel.rearZ * escala,
        connectionY: t.wheel.connectionY * escala,
      },
      suspension: {
        restLength: t.suspension.restLength * escala,
        stiffness: t.suspension.stiffness * x('suspension'),
        compression: t.suspension.compression,
        relaxation: t.suspension.relaxation,
        // Aguanta la masa que trae: una grandota con la fuerza de la mediana
        // se sienta hasta el tope y va raspando.
        maxForce: t.suspension.maxForce * x('tara'),
        maxTravel: t.suspension.maxTravel * x('suspension'),
      },
      engineForce: t.engineForce * x('motor'),
      brakeForce: t.brakeForce * x('freno'),
      brakeFrontBias: t.brakeFrontBias,
      engineBrake: t.engineBrake * x('motor'),
      maxSpeed: t.maxSpeed * x('velocidad'),
      reverseSpeed: t.reverseSpeed * x('velocidad'),
      boost: {
        minSpeed: t.boost.minSpeed,
        maxSteerDeg: t.boost.maxSteerDeg,
        forceMultiplier: t.boost.forceMultiplier,
        maxSpeedBonus: t.boost.maxSpeedBonus,
        heatRate: t.boost.heatRate * x('calor'),
        coolRate: t.boost.coolRate * x('enfria'),
        resumeTemp: t.boost.resumeTemp,
        overheatPower: t.boost.overheatPower,
      },
      frictionSlip: t.frictionSlip * x('agarre'),
      sideFrictionStiffness: t.sideFrictionStiffness * x('agarre'),
      linearDamping: t.linearDamping,
      angularDamping: t.angularDamping * x('vuelco'),
      steer: {
        maxDeg: t.steer.maxDeg * x('volante'),
        speedFalloff: t.steer.speedFalloff,
        speed: t.steer.speed * x('volante'),
        returnSpeed: t.steer.returnSpeed,
      },
    },
  }
}

/** Precio del SIGUIENTE nivel de una categoría, o null si ya está al tope. */
export function precioMejora(
  cat: Categoria,
  nivelActual: Nivel,
  b: Balance = balance,
): number | null {
  if (nivelActual >= NIVEL_MAX) return null
  return b.garage.mejoras[cat][nivelActual]
}

/** Precio de un modelo en el lote. La heredada no se compra: con esa empiezas. */
export function precioModelo(id: ModeloId, b: Balance = balance): number {
  return b.garage.modelos[id]
}

/** Si una mejora empuja algún eje en el que subir es peor. Las que no, tienen
 *  que ser de las caras — hay un test que lo cobra. */
export function tieneCostoFisico(cat: Categoria): boolean {
  return MEJORAS[cat].niveles.some((nivel) =>
    EJES_DE_COSTO.some((eje) => (nivel[eje] ?? 1) > 1),
  )
}
