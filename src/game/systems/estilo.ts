/*
 * EL ESTILO: cómo se ve tu pipa. Catálogo y lógica puros, hermanos de
 * garage.ts y con su misma división de trabajo: aquí vive QUÉ se puede poner
 * (colores, calcas, piezas) y en balance.garage.estilo vive cuánto CUESTA.
 *
 * LA REGLA DE ORO (sección 1 del documento de Fase 2): el estilo tiene CERO
 * efecto en el juego. No toca computeStats, no toca la física, no toca la
 * aceptación. En cuanto lo cosmético diera ventaja, el jugador dejaría de
 * elegir lo que le gusta y elegiría lo óptimo. Hay un test que lo cobra.
 *
 * El estilo es POR PIPA, como las mejoras: la grandota recién comprada sale
 * gris del lote y la pintas tú. Pintura, rótulo y calca cobran cada aplicada
 * (quitar es gratis); cromo y detalles se compran una vez por pipa y de ahí
 * en adelante se ponen y quitan gratis.
 */

import { balance, type Balance } from '../balance'
import { PIPA_MATERIALS } from '../vehicle/pipaParts'
import type { PipaConfig } from './garage'

export type ColorId =
  | 'gris-flota'
  | 'aluminio'
  | 'blanco'
  | 'negro'
  | 'rojo'
  | 'azul'
  | 'verde'
  | 'amarillo'
  | 'guinda'
  | 'naranja'

export type CalcaId = 'gota' | 'llamas' | 'rayas' | 'olas' | 'estrellas'

export type PiezaCromo = 'defensa' | 'espejos' | 'escapes' | 'rines'
export type Detalle = 'claxon' | 'luces' | 'cortinas'
export type Pieza = PiezaCromo | Detalle

export type Estilo = {
  /** Color de la cabina y del tanque, POR SEPARADO (sección 5). */
  pintura: { cabina: ColorId; tanque: ColorId }
  /** El texto del rotulista, escrito por el jugador. '' = sin rótulo. */
  rotulo: string
  /** Motivo pintado en las placas del tanque, debajo del rótulo. */
  calca: CalcaId | null
  /** Llave presente = pieza comprada; el valor dice si está puesta. */
  cromo: Partial<Record<PiezaCromo, boolean>>
  detalles: Partial<Record<Detalle, boolean>>
}

/**
 * La paleta. Los dos primeros son los grises de fábrica con nombre puesto —
 * sus hex reproducen PIPA_MATERIALS EXACTOS, así una pipa vieja (sin estilo
 * guardado) se ve idéntica a como se veía antes del Paso 5. Hay un test.
 */
export const COLORES: Record<ColorId, { nombre: string; hex: string }> = {
  'gris-flota': { nombre: 'Gris flota', hex: PIPA_MATERIALS.cabina },
  aluminio: { nombre: 'Aluminio', hex: PIPA_MATERIALS.tanque },
  blanco: { nombre: 'Blanco', hex: '#e8eaed' },
  negro: { nombre: 'Negro', hex: '#2a2c31' },
  rojo: { nombre: 'Rojo', hex: '#c23b2e' },
  azul: { nombre: 'Azul', hex: '#2e6fc2' },
  verde: { nombre: 'Verde', hex: '#2e8c56' },
  amarillo: { nombre: 'Amarillo', hex: '#e0b52e' },
  guinda: { nombre: 'Guinda', hex: '#7a2f3f' },
  naranja: { nombre: 'Naranja', hex: '#d9742a' },
}

export const COLOR_IDS = Object.keys(COLORES) as ColorId[]

export const CALCAS: Record<CalcaId, { nombre: string }> = {
  gota: { nombre: 'La gota' },
  llamas: { nombre: 'Llamas' },
  rayas: { nombre: 'Rayas' },
  olas: { nombre: 'Olas' },
  estrellas: { nombre: 'Estrellas' },
}

export const CALCA_IDS = Object.keys(CALCAS) as CalcaId[]

/** Textos de UI de cromo y detalles, en el idioma del jugador. */
export const PIEZAS: Record<Pieza, { nombre: string; de: string }> = {
  defensa: { nombre: 'Defensa cromada', de: 'El frente y la cola, espejeando' },
  espejos: { nombre: 'Espejos', de: 'Un par de orejas cromadas en la cabina' },
  escapes: { nombre: 'Escapes', de: 'Dos chimeneas de acero tras la cabina' },
  rines: { nombre: 'Rines cromados', de: 'Las cuatro, presumiendo' },
  claxon: { nombre: 'Claxon de trompetas', de: 'Dos cornetas de latón al techo' },
  luces: { nombre: 'Luces de colores', de: 'Tres puntos encendidos sobre la cabina' },
  cortinas: { nombre: 'Cortinas', de: 'El fleco guinda sobre el parabrisas' },
}

export const PIEZAS_CROMO: PiezaCromo[] = ['defensa', 'espejos', 'escapes', 'rines']
export const DETALLES: Detalle[] = ['claxon', 'luces', 'cortinas']

const esCromo = (p: Pieza): p is PiezaCromo =>
  (PIEZAS_CROMO as Pieza[]).includes(p)

/**
 * Referencia COMPARTIDA y congelada: `estiloDe` la devuelve para toda pipa
 * sin estilo guardado, así los componentes suscritos ven siempre la misma
 * identidad y no se re-renderizan de gratis.
 */
export const ESTILO_DE_FABRICA: Estilo = Object.freeze({
  pintura: Object.freeze({ cabina: 'gris-flota', tanque: 'aluminio' }),
  rotulo: '',
  calca: null,
  cromo: Object.freeze({}),
  detalles: Object.freeze({}),
}) as Estilo

/** El estilo de una pipa, con la de fábrica como piso. */
export function estiloDe(cfg: PipaConfig): Estilo {
  return cfg.estilo ?? ESTILO_DE_FABRICA
}

export const ROTULO_MAX = 24

/**
 * Limpia el texto del rotulista: sin caracteres de control, sin espacios
 * dobles, y recortado. Se aplica al comprar Y al cargar un guardado — un save
 * editado a mano no puede meterle un libro al CanvasTexture.
 */
export function sanitizarRotulo(texto: string): string {
  return texto
    .replace(/[\p{Cc}\p{Cf}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, ROTULO_MAX)
}

/** Lo que el jugador pide en la pestaña de Estilo, una cosa a la vez. */
export type CambioEstilo =
  | { tipo: 'pintura'; parte: 'cabina' | 'tanque'; color: ColorId }
  | { tipo: 'rotulo'; texto: string }
  | { tipo: 'calca'; calca: CalcaId | null }
  | { tipo: 'pieza'; pieza: Pieza }

export type MotivoNoEstilo = 'SIN_DINERO' | 'YA_LA_TIENES' | 'SIN_CAMBIO'

export type CompraEstilo =
  | { ok: true; pipa: PipaConfig; costo: number; aviso: string }
  | { ok: false; motivo: MotivoNoEstilo; costo: number | null }

/** Precio de un cambio. Quitar (rótulo vacío, calca null) siempre es gratis. */
export function precioCambio(cambio: CambioEstilo, b: Balance = balance): number {
  const e = b.garage.estilo
  switch (cambio.tipo) {
    case 'pintura':
      return e.pintura[cambio.parte]
    case 'rotulo':
      return sanitizarRotulo(cambio.texto) === '' ? 0 : e.rotulo
    case 'calca':
      return cambio.calca === null ? 0 : e.calca
    case 'pieza':
      return e.piezas[cambio.pieza]
  }
}

/**
 * Aplica un cambio de estilo, si alcanza. Pura como `comprarMejora`: recibe la
 * pipa y la cartera, devuelve la pipa nueva y el costo, y el store aplica el
 * resultado en un solo set().
 */
export function aplicarCambio(
  pipa: PipaConfig,
  cambio: CambioEstilo,
  dinero: number,
  b: Balance = balance,
): CompraEstilo {
  const actual = estiloDe(pipa)
  const costo = precioCambio(cambio, b)
  const cobra = (estilo: Estilo, aviso: string): CompraEstilo =>
    dinero < costo
      ? { ok: false, motivo: 'SIN_DINERO', costo }
      : { ok: true, costo, aviso, pipa: { ...pipa, estilo } }

  switch (cambio.tipo) {
    case 'pintura': {
      if (actual.pintura[cambio.parte] === cambio.color)
        return { ok: false, motivo: 'SIN_CAMBIO', costo: null }
      return cobra(
        { ...actual, pintura: { ...actual.pintura, [cambio.parte]: cambio.color } },
        `${cambio.parte === 'cabina' ? 'Cabina' : 'Tanque'} en ${COLORES[cambio.color].nombre.toLowerCase()}`,
      )
    }
    case 'rotulo': {
      const texto = sanitizarRotulo(cambio.texto)
      if (texto === actual.rotulo)
        return { ok: false, motivo: 'SIN_CAMBIO', costo: null }
      return cobra(
        { ...actual, rotulo: texto },
        texto === '' ? 'Rótulo borrado' : `«${texto}»`,
      )
    }
    case 'calca': {
      if (cambio.calca === actual.calca)
        return { ok: false, motivo: 'SIN_CAMBIO', costo: null }
      return cobra(
        { ...actual, calca: cambio.calca },
        cambio.calca === null ? 'Calcas fuera' : CALCAS[cambio.calca].nombre,
      )
    }
    case 'pieza': {
      const bolsa = esCromo(cambio.pieza) ? actual.cromo : actual.detalles
      if (cambio.pieza in bolsa)
        return { ok: false, motivo: 'YA_LA_TIENES', costo: null }
      const estilo = esCromo(cambio.pieza)
        ? { ...actual, cromo: { ...actual.cromo, [cambio.pieza]: true } }
        : { ...actual, detalles: { ...actual.detalles, [cambio.pieza]: true } }
      return cobra(estilo, PIEZAS[cambio.pieza].nombre)
    }
  }
}

/**
 * Pone o quita una pieza YA COMPRADA. Gratis: lo que se paga es la pieza, no
 * el gusto de quitarla un rato. Devuelve null si no es tuya.
 */
export function alternarPieza(pipa: PipaConfig, pieza: Pieza): PipaConfig | null {
  const actual = estiloDe(pipa)
  const bolsa = esCromo(pieza) ? actual.cromo : actual.detalles
  if (!(pieza in bolsa)) return null
  const estilo = esCromo(pieza)
    ? { ...actual, cromo: { ...actual.cromo, [pieza]: !actual.cromo[pieza] } }
    : { ...actual, detalles: { ...actual.detalles, [pieza]: !actual.detalles[pieza] } }
  return { ...pipa, estilo }
}
