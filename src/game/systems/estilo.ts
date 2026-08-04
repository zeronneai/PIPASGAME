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
 * Lo APLICADO es POR PIPA (la grandota recién comprada sale gris del lote),
 * pero lo COMPRADO es DEL JUGADOR: el inventario. Un color, calca o pieza se
 * paga UNA vez y queda tuyo para siempre — aplicarlo en cualquier pipa, hoy
 * o mañana, es gratis. La única labor que se paga por evento es el rótulo:
 * cada cambio de texto es una visita al rotulista.
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
  /** true = la pieza está PUESTA en esta pipa. La POSESIÓN ya no vive aquí:
   *  vive en el InventarioEstilo del jugador. */
  cromo: Partial<Record<PiezaCromo, boolean>>
  detalles: Partial<Record<Detalle, boolean>>
}

/**
 * Lo que el jugador YA COMPRÓ, global y para siempre. Vive aparte del
 * estilo de cada pipa: pintar la grandota del rojo que pagaste en la
 * heredada no cuesta nada.
 */
export type InventarioEstilo = {
  colores: ColorId[]
  calcas: CalcaId[]
  piezas: Pieza[]
}

export const inventarioInicial = (): InventarioEstilo => ({
  colores: [],
  calcas: [],
  piezas: [],
})

/** Los grises del lote no se compran: con esos sale toda pipa. */
export const COLORES_DE_FABRICA: ColorId[] = ['gris-flota', 'aluminio']

export const tieneColor = (inv: InventarioEstilo, id: ColorId) =>
  COLORES_DE_FABRICA.includes(id) || inv.colores.includes(id)

export const tieneCalca = (inv: InventarioEstilo, id: CalcaId) =>
  inv.calcas.includes(id)

export const tienePieza = (inv: InventarioEstilo, id: Pieza) =>
  inv.piezas.includes(id)

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

export type MotivoNoEstilo = 'SIN_DINERO' | 'SIN_CAMBIO'

export type CompraEstilo =
  | {
      ok: true
      pipa: PipaConfig
      /** El inventario tras la compra (la misma referencia si no hubo alta). */
      inv: InventarioEstilo
      costo: number
      aviso: string
    }
  | { ok: false; motivo: MotivoNoEstilo; costo: number | null }

/**
 * Precio de un cambio CONTRA el inventario: lo tuyo es gratis (Aplicar), lo
 * nuevo cuesta (Comprar). Quitar (rótulo vacío, calca null) siempre es
 * gratis. La UI pinta sus botones con esto.
 */
export function precioCambio(
  cambio: CambioEstilo,
  inv: InventarioEstilo,
  b: Balance = balance,
): number {
  const e = b.garage.estilo
  switch (cambio.tipo) {
    case 'pintura':
      return tieneColor(inv, cambio.color) ? 0 : e.pintura[cambio.parte]
    case 'rotulo':
      return sanitizarRotulo(cambio.texto) === '' ? 0 : e.rotulo
    case 'calca':
      return cambio.calca === null || tieneCalca(inv, cambio.calca) ? 0 : e.calca
    case 'pieza':
      return tienePieza(inv, cambio.pieza) ? 0 : e.piezas[cambio.pieza]
  }
}

/**
 * Aplica un cambio de estilo, si alcanza. Pura como `comprarMejora`: recibe
 * pipa, inventario y cartera; devuelve pipa e inventario nuevos y el costo, y
 * el store aplica todo en un solo set(). Comprar da de alta en el inventario;
 * aplicar lo que ya es tuyo sale en cero.
 */
export function aplicarCambio(
  pipa: PipaConfig,
  inv: InventarioEstilo,
  cambio: CambioEstilo,
  dinero: number,
  b: Balance = balance,
): CompraEstilo {
  const actual = estiloDe(pipa)
  const costo = precioCambio(cambio, inv, b)
  const cobra = (
    estilo: Estilo,
    aviso: string,
    invNuevo: InventarioEstilo = inv,
  ): CompraEstilo =>
    dinero < costo
      ? { ok: false, motivo: 'SIN_DINERO', costo }
      : { ok: true, costo, aviso, inv: invNuevo, pipa: { ...pipa, estilo } }

  switch (cambio.tipo) {
    case 'pintura': {
      if (actual.pintura[cambio.parte] === cambio.color)
        return { ok: false, motivo: 'SIN_CAMBIO', costo: null }
      return cobra(
        { ...actual, pintura: { ...actual.pintura, [cambio.parte]: cambio.color } },
        `${cambio.parte === 'cabina' ? 'Cabina' : 'Tanque'} en ${COLORES[cambio.color].nombre.toLowerCase()}`,
        tieneColor(inv, cambio.color)
          ? inv
          : { ...inv, colores: [...inv.colores, cambio.color] },
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
        cambio.calca === null || tieneCalca(inv, cambio.calca)
          ? inv
          : { ...inv, calcas: [...inv.calcas, cambio.calca] },
      )
    }
    case 'pieza': {
      // Comprarla la deja puesta; si ya es tuya, esto la pone (gratis).
      const puesta = esCromo(cambio.pieza)
        ? actual.cromo[cambio.pieza] === true
        : actual.detalles[cambio.pieza as Detalle] === true
      if (puesta && tienePieza(inv, cambio.pieza))
        return { ok: false, motivo: 'SIN_CAMBIO', costo: null }
      const estilo = esCromo(cambio.pieza)
        ? { ...actual, cromo: { ...actual.cromo, [cambio.pieza]: true } }
        : { ...actual, detalles: { ...actual.detalles, [cambio.pieza]: true } }
      return cobra(
        estilo,
        PIEZAS[cambio.pieza].nombre,
        tienePieza(inv, cambio.pieza)
          ? inv
          : { ...inv, piezas: [...inv.piezas, cambio.pieza] },
      )
    }
  }
}

/**
 * Pone o quita una pieza YA COMPRADA. Gratis: lo que se paga es la pieza, no
 * el gusto de quitarla un rato. Devuelve null si no está en el inventario.
 */
export function alternarPieza(
  pipa: PipaConfig,
  inv: InventarioEstilo,
  pieza: Pieza,
): PipaConfig | null {
  if (!tienePieza(inv, pieza)) return null
  const actual = estiloDe(pipa)
  const estilo = esCromo(pieza)
    ? { ...actual, cromo: { ...actual.cromo, [pieza]: actual.cromo[pieza] !== true } }
    : {
        ...actual,
        detalles: { ...actual.detalles, [pieza]: actual.detalles[pieza as Detalle] !== true },
      }
  return { ...pipa, estilo }
}

/**
 * Amnistía para guardados anteriores al inventario: lo que cualquier pipa
 * traía puesto (o comprado, en la semántica vieja de llave presente) se da
 * por pagado. Nadie pierde lo que ya era suyo.
 */
export function inventarioDesdeGarage(
  pipas: Partial<Record<string, PipaConfig>>,
): InventarioEstilo {
  const inv = inventarioInicial()
  for (const cfg of Object.values(pipas)) {
    const e = cfg?.estilo
    if (!e) continue
    for (const color of [e.pintura.cabina, e.pintura.tanque]) {
      if (!tieneColor(inv, color) && COLORES[color]) inv.colores.push(color)
    }
    if (e.calca && CALCAS[e.calca] && !inv.calcas.includes(e.calca))
      inv.calcas.push(e.calca)
    for (const pieza of [
      ...Object.keys(e.cromo ?? {}),
      ...Object.keys(e.detalles ?? {}),
    ] as Pieza[]) {
      if (PIEZAS[pieza] && !inv.piezas.includes(pieza)) inv.piezas.push(pieza)
    }
  }
  return inv
}
