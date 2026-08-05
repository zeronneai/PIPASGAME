import { PALETA, colorFachada } from '../render/paleta'
import {
  ANGOSTURAS,
  BARDA_ALTURA,
  CALLEJONES,
  buildingLote,
  buildings,
  esLibre,
  locales,
  type Box,
} from './layout'
import type { Punto } from './raster'
import { Malla, dado, mezclar, tinte } from './malla'
import { anchoPano, caja, fusionarPanos, panel, rejilla, type Pano } from './panos'
import { GLORIETA } from './traza'

/*
 * LAS FACHADAS DE LA COLONIA (Fase 3, Paso 2, segunda pasada).
 *
 * Todo procedural, determinista por lote, sin un modelo ni una textura, y todo
 * en UNA malla fusionada con color por vértice.
 *
 * LAS DOS COSAS QUE ESTA VERSIÓN ARREGLA, porque son la razón de que exista:
 *
 * 1. EL PARPADEO. Antes el detalle se dibujaba encima del muro, separado 5 cm.
 *    Ahora el detalle ES el muro: el paño se corta en rejilla y cada celda
 *    lleva su color (`panos.ts`). Cero superficies coplanares por
 *    construcción. Lo que necesita relieve —cornisa, pretil, marquesina—
 *    sobresale como volumen, que es otra cosa.
 *
 * 2. EL CÓDIGO DE BARRAS. El fusionador de lotes parte un predio en cinco
 *    rectángulos de media, y antes cada uno se pintaba con su propio color:
 *    una casa salía a rayas. Ahora se agrupa por ETIQUETA DE LOTE
 *    (`buildingLote`), se fusionan sus caras en paños corridos y se compone
 *    UNA fachada sobre el frente real. Un predio, un color.
 *
 * LO QUE ESTE ENFOQUE NO ARREGLA, y hay que decirlo: sobre una frontera curva
 * los escalones caen en planos distintos y no se pueden fusionar. Esas
 * astillas se emiten como muro liso del color del lote —sin ventana, sin
 * portón— para que una manzana curva se lea como una barda continua en vez de
 * como veinte casitas rayadas. La arquitectura completa se compone solo sobre
 * paños que de verdad miden un frente de casa.
 */

/** Frente mínimo para que un paño merezca fachada completa. Debajo de esto no
 *  cabe una ventana con su marco sin que se vea de maqueta. */
const FRENTE_MINIMO = 4

/**
 * Cuánto sobresalen los volúmenes de la pared, y —lo que importa más— cuánto
 * se hunden por detrás.
 *
 * La regla que sustituye al `RELIEVE` de 5 cm que causó el parpadeo: **nada
 * vive en la franja de ±8 cm alrededor del plano del muro**. Lo que sale, sale
 * 10 cm o más; lo que se mete, se mete 12 cm o más. Esa franja es donde el
 * buffer de profundidad no alcanza a separar dos caras a la distancia a la
 * que se ve una fachada, y por eso está prohibida — con un test que lo cobra
 * (`fachadas.test.ts`), no con un número ajustado hasta que dejó de verse.
 *
 * Las caras traseras se hunden 12 cm aunque queden ocultas dentro del muro:
 * apoyarlas a 2 cm funcionaba solo mientras el back-face culling las tapara,
 * y depender de eso es depender de un accidente.
 */
const VUELO_CORNISA = 0.1
const FONDO = -0.12

/* --------------------------------------------------- caras a la calle */

/**
 * Las cuatro caras verticales de una caja, como paños en coordenadas de
 * mundo. Los extremos van absolutos para poder fusionar caras de cajas
 * distintas comparando números sueltos.
 */
function panosDe(b: Box): Pano[] {
  const [x, , z] = b.pos
  const [sx, alto, sz] = b.size
  return [
    { dx: 1, dz: 0, plano: x + sx / 2, a: z - sz / 2, b: z + sz / 2, alto },
    { dx: -1, dz: 0, plano: x - sx / 2, a: z - sz / 2, b: z + sz / 2, alto },
    { dx: 0, dz: 1, plano: z + sz / 2, a: x - sx / 2, b: x + sx / 2, alto },
    { dx: 0, dz: -1, plano: z - sz / 2, a: x - sx / 2, b: x + sx / 2, alto },
  ]
}

/**
 * Si un paño da a la calle. Se tantea metro y medio hacia afuera desde su
 * centro: si ahí hay pavimento, esa cara la ve el jugador y merece fachada.
 * Las que dan a otro lote son medianeras y se quedan lisas — que es lo que son
 * en la realidad y además donde se ahorra la mitad de los triángulos.
 */
function daALaCalle(p: Pano): boolean {
  const t = (p.a + p.b) / 2
  const cx = p.dx !== 0 ? p.plano : t
  const cz = p.dx !== 0 ? t : p.plano
  return esLibre(cx + p.dx * 1.5, cz + p.dz * 1.5)
}

/* ----------------------------------------------------------- el predio */

/** Lo que hace distinto a un predio de su vecino. Sale de la ETIQUETA del
 *  lote, así que todas las cajas de un mismo predio comparten hasta el último
 *  detalle: un predio se ve como una casa, no como cinco pegadas. */
type Predio = {
  muro: string
  zocalo: number
  colorZocalo: string
  humedad: number
  cornisa: boolean
  colorCornisa: string
  /** Alto del pretil de azotea. Es lo que más distingue dos casas del mismo
   *  color vistas desde la calle, porque cambia la silueta. */
  pretil: number
  marco: string
  porton: boolean
  tinaco: boolean
  colorTinaco: string
}

/** Colores de marcos y herrería. Contrastan con la fachada a propósito: es lo
 *  que hace que una ventana se LEA como ventana de lejos. */
const CONTRASTES = [PALETA.anil, PALETA.terracota, PALETA.cal, PALETA.limon, PALETA.ocre]

const TINACOS = ['#2b2b30', '#2b2b30', '#33333a', PALETA.terracota, PALETA.ocre]

/**
 * El hash de la etiqueta, no la etiqueta: las de lotes vecinos se diferencian
 * en 1, y usarlas directo haría que la cuadra recorriera la tira de colores en
 * orden — que es otro patrón, más discreto pero patrón.
 */
function predioDe(lote: number, alto: number): Predio {
  const h = Math.abs(Math.imul(lote, 2654435761)) % 100003
  const muro = tinte(colorFachada(h), 0.9 + dado(h, 1) * 0.2)
  const esBarda = alto <= BARDA_ALTURA + 0.01

  return {
    muro,
    zocalo: 0.55 + dado(h, 4) * 0.75,
    colorZocalo:
      dado(h, 3) < 0.72
        ? tinte(PALETA.cal, 0.92 + dado(h, 5) * 0.16)
        : tinte(muro, 0.66),
    humedad: Math.pow(dado(h, 2), 1.7),
    // La barda de un patio no lleva cornisa: no hay casa que rematar.
    cornisa: !esBarda && dado(h, 6) < 0.75,
    colorCornisa: dado(h, 7) < 0.5 ? tinte(muro, 1.18) : tinte(PALETA.cal, 0.96),
    pretil: esBarda ? 0 : 0.25 + dado(h, 10) * 0.75,
    marco: CONTRASTES[h % CONTRASTES.length],
    porton: !esBarda && dado(h, 8) < 0.4,
    tinaco: !esBarda && dado(h, 9) < 0.62,
    colorTinaco: TINACOS[(h * 7) % TINACOS.length],
  }
}

/* ------------------------------------------------------------ fachadas */

/** Muro liso del color del predio: lo que llevan las medianeras y las
 *  astillas de las manzanas curvas. */
function muroLiso(m: Malla, p: Pano, pr: Predio, oscurecer = false) {
  const c = oscurecer ? tinte(pr.muro, 0.9) : pr.muro
  const zocalo = Math.min(pr.zocalo, p.alto * 0.4)
  panel(m, p, p.a, p.b, 0, zocalo, pr.colorZocalo)
  panel(m, p, p.a, p.b, zocalo, p.alto, c)
}

/**
 * Una fachada de verdad, compuesta contra el ancho REAL del frente.
 *
 * La rejilla se arma como cortes (`ts`, `ys`) y se pinta celda por celda. El
 * marco de la ventana son celdas pintadas del color de contraste; el vidrio es
 * una caja REHUNDIDA, que es de donde sale la sombra del hueco. Nada se
 * superpone a nada, así que no hay z-fighting posible.
 */
function fachada(m: Malla, p: Pano, pr: Predio, semilla: number) {
  const ancho = anchoPano(p)
  const alto = p.alto
  const zocalo = Math.min(pr.zocalo, alto * 0.4)
  const yTope = pr.cornisa ? alto - 0.22 : alto

  const n = Math.max(1, Math.min(3, Math.floor(ancho / 3.6)))
  const paso = ancho / n
  const anchoV = Math.min(1.3, paso * 0.4)
  const yv0 = zocalo + 0.5
  const yv1 = Math.min(yTope - 0.35, yv0 + 1.3)
  const hayVentanas = yv1 > yv0 + 0.5

  // El portón va en un vano y las ventanas en los demás: una casa tiene una
  // entrada, no tres.
  const vanoPorton = pr.porton && ancho >= 5 ? Math.floor(dado(semilla, 12) * n) : -1
  const anchoP = Math.min(2.4, paso * 0.7)
  const yp1 = Math.min(yTope - 0.5, 2.35)

  const ts: number[] = [p.a]
  const huecos: { i0: number; tipo: 'ventana' | 'porton' }[] = []
  for (let k = 0; k < n; k++) {
    const c = p.a + paso * (k + 0.5)
    if (k === vanoPorton) {
      ts.push(c - anchoP / 2 - 0.14, c - anchoP / 2, c + anchoP / 2, c + anchoP / 2 + 0.14)
      huecos.push({ i0: ts.length - 3, tipo: 'porton' })
    } else if (hayVentanas) {
      ts.push(c - anchoV / 2 - 0.14, c - anchoV / 2, c + anchoV / 2, c + anchoV / 2 + 0.14)
      huecos.push({ i0: ts.length - 3, tipo: 'ventana' })
    }
  }
  ts.push(p.b)

  const ys = [0, zocalo]
  if (hayVentanas) ys.push(yv0 - 0.14, yv0, yv1, yv1 + 0.14)
  if (vanoPorton >= 0) ys.push(yp1, yp1 + 0.14)
  ys.push(yTope)
  if (pr.cornisa) ys.push(alto)
  const ysOrd = [...new Set(ys)]
    .sort((x, y) => x - y)
    .filter((v) => v >= -0.001 && v <= alto + 0.001)

  // El agua escurre desde arriba: verdinegro, nunca negro puro.
  const manchado = mezclar(pr.muro, '#4a5245', pr.humedad * 0.55)

  rejilla(m, p, ts, ysOrd, (i, j) => {
    const y0 = ysOrd[j]
    const y1 = ysOrd[j + 1]
    if (y1 <= zocalo + 0.001) return pr.colorZocalo

    const h = huecos.find((q) => i >= q.i0 - 1 && i <= q.i0 + 1)
    if (h) {
      const dentro = i === h.i0
      if (h.tipo === 'ventana' && hayVentanas && y0 >= yv0 - 0.15 && y1 <= yv1 + 0.15) {
        // El hueco se deja vacío: ahí va la caja rehundida del vidrio.
        return dentro && y0 >= yv0 - 0.001 && y1 <= yv1 + 0.001 ? null : pr.marco
      }
      if (h.tipo === 'porton' && y1 <= yp1 + 0.15) {
        return dentro && y1 <= yp1 + 0.001 ? null : pr.marco
      }
    }

    // El muro, con la humedad bajando desde arriba. El degradado va en el
    // vértice y lo interpola la tarjeta: cero triángulos de más.
    const c0 = mezclar(pr.muro, manchado, (y0 / alto) ** 2)
    const c1 = mezclar(pr.muro, manchado, (y1 / alto) ** 2)
    return [c0, c0, c1, c1] as [string, string, string, string]
  })

  /* Los volúmenes: vidrio y portón rehundidos, cornisa y pretil saliendo. */
  for (const h of huecos) {
    const t0 = ts[h.i0]
    const t1 = ts[h.i0 + 1]
    if (h.tipo === 'ventana' && hayVentanas) {
      // El vidrio 12 cm adentro, con fondo: mirando de lado se ve el derrame
      // del hueco y no un agujero plano.
      caja(m, p, t0, t1, yv0, yv1, -0.32, FONDO, PALETA.vidrio)
    } else if (h.tipo === 'porton') {
      caja(m, p, t0, t1, 0, yp1, -0.26, -0.09, tinte(pr.marco, 0.78))
    }
  }

  if (pr.cornisa) {
    caja(m, p, p.a, p.b, yTope, alto, FONDO, VUELO_CORNISA, pr.colorCornisa)
  }
  if (pr.pretil > 0.01) {
    // El pretil sube por encima del techo y por eso cambia la SILUETA, que es
    // lo que de verdad distingue dos casas del mismo color desde la calle.
    caja(m, p, p.a, p.b, alto, alto + pr.pretil, FONDO, 0.06, tinte(pr.muro, 1.08))
  }
}

/** El tinaco de la azotea. Uno POR PREDIO, no por caja: una casa tiene un
 *  tinaco, no cinco pegados uno junto al otro. */
function tinacoEnAzotea(m: Malla, mayor: Box, pr: Predio, semilla: number) {
  const [x, , z] = mayor.pos
  const [sx, alto, sz] = mayor.size
  const ox = (dado(semilla, 13) - 0.5) * Math.max(0, sx - 2.4)
  const oz = (dado(semilla, 14) - 0.5) * Math.max(0, sz - 2.4)
  const r = 0.6 + dado(semilla, 15) * 0.22
  const h = 1.05 + dado(semilla, 16) * 0.35
  m.caja([x + ox, alto + 0.13, z + oz], [r * 2.2, 0.26, r * 2.2], tinte(PALETA.concreto, 0.9))
  m.prisma([x + ox, alto + 0.26 + h / 2, z + oz], r, r, h, 8, pr.colorTinaco, tinte(pr.colorTinaco, 1.3))
  m.prisma([x + ox, alto + 0.26 + h + 0.06, z + oz], r * 0.42, r * 0.42, 0.12, 6, tinte(pr.colorTinaco, 1.6))
}

/* ---------------------------------------------------------- los locales */

/*
 * QUE UN LOCAL SE VEA LOCAL DESDE MEDIA CUADRA (Parte B del paso).
 *
 * La primera versión falló porque todo era pintura: rótulo, cortina y
 * mostrador iban a 5 cm de la pared —o sea que parpadeaban— y el toldo medía
 * 3.6 m de un frente de 9. De lejos no había nada que ver.
 *
 * Ahora el local se distingue por VOLUMEN, que es lo que se lee en escorzo
 * viniendo por la banqueta:
 *   - una marquesina que vuela 1.6 m a todo el frente;
 *   - una banda de rótulo que sobresale 12 cm, en acento saturado;
 *   - la cortina metálica como nicho REHUNDIDO, no como franjas pintadas;
 *   - un mostrador ancho y bajo, de forma distinta a la ventana de casa;
 *   - y cosas afuera: rejas de refresco, cajas y un banco.
 * Y el local mide medio nivel más que el vecino de una planta, así que el
 * rótulo asoma por encima de la barda de junto.
 */
const ACENTOS_LOCAL = [PALETA.rosa, PALETA.ocre, PALETA.limon, PALETA.terracota, PALETA.anil]

function fachadaDeLocal(m: Malla, p: Pano, color: string, i: number) {
  const ancho = anchoPano(p)
  const alto = p.alto
  const muro = tinte(color, 0.97)
  const acento = ACENTOS_LOCAL[i % ACENTOS_LOCAL.length]

  const yMarq = 3.0
  const yRot0 = yMarq + 0.25
  const yRot1 = Math.min(alto - 0.35, yRot0 + 1.05)

  const anchoCort = Math.min(3.4, ancho * 0.34)
  const anchoMost = Math.min(3.2, ancho * 0.32)
  const tCort = p.a + ancho * 0.3
  const tMost = p.a + ancho * 0.68

  const ts = [
    p.a,
    tCort - anchoCort / 2,
    tCort + anchoCort / 2,
    tMost - anchoMost / 2,
    tMost + anchoMost / 2,
    p.b,
  ].sort((x, y) => x - y)

  const yMost0 = 1.0
  const yMost1 = 2.3
  const ys = [0, 0.35, yMost0, yMost1, 2.55, yRot0, yRot1, alto]
    .filter((v) => v <= alto + 0.001)
    .sort((x, y) => x - y)

  rejilla(m, p, ts, ys, (ci, j) => {
    const y0 = ys[j]
    const y1 = ys[j + 1]
    // El zócalo del local va oscuro: es el que se ensucia con la banqueta.
    if (y1 <= 0.35) return tinte(muro, 0.62)
    // La banda de rótulo se pinta también en la pared, para que el volumen que
    // sobresale no deje ver muro claro por los costados.
    if (y0 >= yRot0 - 0.001 && y1 <= yRot1 + 0.001) return acento
    if (ci === 1 && y1 <= 2.55) return null // hueco de la cortina
    if (ci === 3 && y0 >= yMost0 - 0.001 && y1 <= yMost1 + 0.001) return null // mostrador
    return muro
  })

  /* LA CORTINA METÁLICA, como nicho rehundido de verdad. */
  caja(m, p, ts[1], ts[2], 0, 2.55, -0.34, -0.14, '#7b8087')

  /* EL MOSTRADOR: hueco ancho y bajo, con su antepecho saliente. */
  caja(m, p, ts[3], ts[4], yMost0, yMost1, -0.36, -0.14, PALETA.vidrio)
  caja(m, p, ts[3] - 0.1, ts[4] + 0.1, yMost0 - 0.14, yMost0, FONDO, 0.16, tinte(PALETA.concreto, 1.05))

  /* LA BANDA DE RÓTULO: volumen a todo el frente, con filete claro. */
  caja(m, p, p.a + 0.12, p.b - 0.12, yRot0, yRot1, FONDO, 0.12, acento)
  caja(m, p, p.a + 0.3, p.b - 0.3, yRot0 + 0.17, yRot1 - 0.17, 0.12, 0.17, tinte(acento, 1.55))

  /*
   * LA MARQUESINA. Es la pieza que más trabaja: vuela 1.6 m a todo el frente,
   * así que se ve de canto viniendo por la banqueta, que es justo el ángulo en
   * el que un rótulo plano desaparece.
   */
  caja(m, p, p.a, p.b, yMarq, yMarq + 0.18, FONDO, 1.6, tinte(acento, 0.85))
  // El faldón colgado del borde: le da altura a la silueta desde lejos.
  caja(m, p, p.a, p.b, yMarq - 0.34, yMarq, 1.42, 1.6, tinte(PALETA.cal, 1.0))
  // Dos tirantes al muro, para que no se lea como una repisa flotando.
  for (const t of [p.a + 0.5, p.b - 0.5]) {
    caja(m, p, t - 0.06, t + 0.06, yMarq - 0.9, yMarq, 0.1, 1.4, PALETA.metal)
  }

  /* LO QUE HAY AFUERA: rejas de refresco apiladas, cajas y un banco. */
  const bx = (t: number, y0: number, y1: number, f0: number, f1: number, an: number, c: string) =>
    caja(m, p, t - an / 2, t + an / 2, y0, y1, f0, f1, c)

  const tRejas = p.a + ancho * 0.12
  for (let k = 0; k < 3; k++) {
    bx(tRejas, 0.02 + k * 0.3, 0.3 + k * 0.3, 0.35, 0.95, 0.55, k % 2 ? PALETA.rosa : PALETA.anil)
  }
  bx(tRejas + 0.75, 0.02, 0.42, 0.4, 1.0, 0.6, tinte(PALETA.ocre, 0.85))
  const tBanco = p.b - ancho * 0.16
  bx(tBanco, 0.44, 0.55, 0.5, 1.3, 1.5, tinte(PALETA.terracota, 0.9))
  bx(tBanco - 0.6, 0, 0.44, 0.6, 0.75, 0.12, PALETA.metal)
  bx(tBanco + 0.6, 0, 0.44, 0.6, 0.75, 0.12, PALETA.metal)
}

/* --------------------------------------------------------- la glorieta */

/*
 * Antes: una caja de 6×2.5×6 en terracota apoyada sobre un disco de 18 m en
 * verde limón, sin escalón, sin base y sin guarnición — de ahí lo de «una caja
 * roja flotando sobre el pasto». El canto vertical de 95 cm entre la banqueta
 * anular y la meseta quedaba desnudo, y eso es lo que hacía que la isla no
 * tocara el suelo.
 *
 * Ahora es una plaza: guarnición pintada en el canto, caminos radiales,
 * jardineras y un kiosco de verdad —base octagonal con escalones, ocho
 * columnas, techo en punta y remate—. El kiosco se ve A TRAVÉS, que es lo que
 * impide que vuelva a leerse como una masa. Todo entra a la misma malla.
 */
function glorieta(m: Malla): number {
  const [cx, cz] = GLORIETA.c
  const rIsla = GLORIETA.rIsla
  const yIsla = 1.2
  let piezas = 0

  // La meseta de la isla, con su pasto arriba.
  m.prisma([cx, yIsla / 2, cz], rIsla, rIsla, yIsla, 48, tinte(PALETA.concreto, 0.92), PALETA.limon)
  piezas++

  /*
   * LA GUARNICIÓN PINTADA. Franjas cal/ocre sobre el canto del camellón, que
   * es lo que llevan las guarniciones de verdad y lo que ata la isla al suelo:
   * sin esto el disco parece flotar.
   */
  const franjas = 32
  for (let i = 0; i < franjas; i++) {
    const a0 = (i / franjas) * Math.PI * 2
    const a1 = ((i + 1) / franjas) * Math.PI * 2
    const r = rIsla + 0.02
    const c = i % 2 === 0 ? tinte(PALETA.cal, 1.02) : PALETA.ocre
    m.quad(
      [cx + Math.cos(a0) * r, 0.15, cz + Math.sin(a0) * r],
      [cx + Math.cos(a1) * r, 0.15, cz + Math.sin(a1) * r],
      [cx + Math.cos(a1) * r, yIsla, cz + Math.sin(a1) * r],
      [cx + Math.cos(a0) * r, yIsla, cz + Math.sin(a0) * r],
      c,
    )
    piezas++
  }

  /* CAMINOS RADIALES, alineados con las salidas de la glorieta. */
  const concreto = tinte(PALETA.concreto, 1.06)
  for (const g of [0, 110, 180, 275]) {
    const a = (g * Math.PI) / 180
    const ux = Math.cos(a)
    const uz = Math.sin(a)
    const largo = rIsla - 3.1
    m.caja(
      [cx + ux * (3.1 + largo / 2), yIsla + 0.02, cz + uz * (3.1 + largo / 2)],
      [Math.abs(ux) > 0.7 ? largo : 1.6, 0.06, Math.abs(uz) > 0.7 ? largo : 1.6],
      concreto,
    )
    piezas++
  }

  /* JARDINERAS entre los caminos. */
  for (let k = 0; k < 4; k++) {
    const a = ((45 + k * 90) * Math.PI) / 180
    const r = rIsla - 2.6
    const jx = cx + Math.cos(a) * r
    const jz = cz + Math.sin(a) * r
    m.prisma([jx, yIsla + 0.22, jz], 1.5, 1.5, 0.44, 8, tinte(PALETA.concreto, 0.85))
    m.prisma([jx, yIsla + 0.5, jz], 1.25, 1.05, 0.34, 8, PALETA.limon, tinte(PALETA.limon, 1.15))
    piezas += 2
  }

  /* EL KIOSCO: dos escalones octagonales — la transición que le faltaba. */
  const yBase = yIsla
  const oct = Math.PI / 8
  m.prisma([cx, yBase + 0.11, cz], 4.1, 4.1, 0.22, 8, tinte(PALETA.concreto, 0.9), tinte(PALETA.concreto, 1.05), oct)
  m.prisma([cx, yBase + 0.33, cz], 3.5, 3.5, 0.22, 8, tinte(PALETA.concreto, 0.95), tinte(PALETA.cal, 0.95), oct)
  piezas += 2

  // Ocho columnas. Que se vea a través es lo que lo separa de una caja.
  const yCol = yBase + 0.44
  const altoCol = 2.5
  for (let k = 0; k < 8; k++) {
    const a = oct + (k / 8) * Math.PI * 2
    m.prisma(
      [cx + Math.cos(a) * 2.85, yCol + altoCol / 2, cz + Math.sin(a) * 2.85],
      0.16, 0.16, altoCol, 6, tinte(PALETA.cal, 0.98),
    )
    piezas++
  }
  // El barandal entre columnas, a media altura.
  m.prisma([cx, yCol + 0.5, cz], 2.98, 2.98, 0.5, 8, PALETA.anil, PALETA.anil, oct)
  piezas++

  // El techo: cornisa, faldón en punta y remate.
  const yTecho = yCol + altoCol
  m.prisma([cx, yTecho + 0.14, cz], 3.5, 3.5, 0.28, 8, tinte(PALETA.terracota, 0.8), tinte(PALETA.terracota, 0.9), oct)
  m.prisma([cx, yTecho + 1.03, cz], 3.35, 0, 1.5, 8, PALETA.terracota, PALETA.terracota, oct)
  m.prisma([cx, yTecho + 2.05, cz], 0.18, 0.05, 0.7, 6, PALETA.ocre)
  piezas += 3

  return piezas
}

/* --------------------------------------------------- accesos peatonales */

/*
 * QUE SE VEA DESDE LA CALLE POR DÓNDE NO ENTRA LA PIPA.
 *
 * Dos clases de estrechez, dos señas distintas porque significan cosas
 * distintas: el callejón de a pie lleva bolardos CRUZANDO la boca («aquí no
 * entra un vehículo»); la angostura los lleva a los COSTADOS («mide tu
 * ancho»), porque ahí sí se pasa —la heredada sobrada, la mediana apretada—.
 */
function bolardo(m: Malla, x: number, z: number, i: number) {
  const alto = 0.95
  m.prisma([x, alto / 2, z], 0.13, 0.13, alto, 6, PALETA.concreto)
  m.prisma([x, alto - 0.16, z], 0.145, 0.145, 0.3, 6, i % 2 === 0 ? PALETA.ocre : PALETA.anil)
}

function accesos(mallas: Malla[], cuadrante: (x: number, z: number) => number): number {
  let n = 0
  const poner = (x: number, z: number, i: number) =>
    bolardo(mallas[cuadrante(x, z)], x, z, i)
  const marcarBoca = (a: Punto, b: Punto, ancho: number, cruzando: boolean) => {
    const dx = b[0] - a[0]
    const dz = b[1] - a[1]
    const len = Math.hypot(dx, dz) || 1
    const ux = dx / len
    const uz = dz / len
    const px = -uz
    const pz = ux
    for (const [ex, ez, signo] of [
      [a[0], a[1], 1],
      [b[0], b[1], -1],
    ] as const) {
      const bx = ex + ux * signo * 0.8
      const bz = ez + uz * signo * 0.8
      if (cruzando) {
        for (let k = -1; k <= 1; k++) {
          poner(bx + px * k * (ancho / 3), bz + pz * k * (ancho / 3), n++)
        }
      } else {
        poner(bx + px * (ancho / 2 + 0.35), bz + pz * (ancho / 2 + 0.35), n++)
        poner(bx - px * (ancho / 2 + 0.35), bz - pz * (ancho / 2 + 0.35), n++)
      }
    }
  }
  for (const c of CALLEJONES) if (c.soloAPie) marcarBoca(c.a, c.b, c.ancho, true)
  for (const a of ANGOSTURAS) marcarBoca(a.a, a.b, a.ancho, false)
  return n
}

/* -------------------------------------------------------- el constructor */

/*
 * LA COLONIA SE PARTE EN CUATRO CUADRANTES.
 *
 * Una malla fusionada es un draw call, pero también es un objeto que el
 * frustum no puede descartar nunca: sus 62,000 triángulos se envían completos
 * cada cuadro, incluidos los de la manzana que tienes a la espalda. Con el
 * detalle que agregó esta pasada, eso dejó de ser gratis.
 *
 * Cuatro cuadrantes cuestan tres draw calls más —de 13 a 16 sobre un tope de
 * 100— y a cambio, parado en cualquier calle, el frustum tira uno o dos. Es
 * el mejor cambio de moneda disponible: sobra muchísimo presupuesto de draw
 * calls y no sobra tanto de triángulos.
 *
 * Cada pieza va ENTERA al cuadrante de su centro, aunque cruce la frontera.
 * Partirla de verdad exigiría cortar triángulos, y el error que introduce es
 * que un predio de borde se dibuje cuando no hacía falta: nada comparado con
 * la complejidad de un recorte real.
 */
export const CUADRANTES = 4

function cuadranteDe(x: number, z: number): number {
  return (x < 0 ? 0 : 1) + (z < 0 ? 0 : 2)
}

export type FachadasConstruidas = {
  /** Una malla por cuadrante. */
  mallas: Malla[]
  stats: {
    lotes: number
    predios: number
    /** Paños con fachada completa (frente ≥ FRENTE_MINIMO). */
    fachadas: number
    /** Mediana del frente de esos paños, en metros. */
    frenteMediano: number
    tinacos: number
    locales: number
    bolardos: number
    glorieta: number
    triangulos: number
    vertices: number
  }
}

/** La azotea de una caja: una sola cara, porque la de abajo nunca se ve. */
function azotea(m: Malla, b: Box, color: string) {
  const [x, , z] = b.pos
  const [sx, alto, sz] = b.size
  m.quad(
    [x - sx / 2, alto, z + sz / 2],
    [x + sx / 2, alto, z + sz / 2],
    [x + sx / 2, alto, z - sz / 2],
    [x - sx / 2, alto, z - sz / 2],
    color,
  )
}

/**
 * Construye la colonia entera en una sola malla.
 *
 * Se llama una vez, al montar la escena. No corre a nivel de módulo a
 * propósito: es el trabajo más pesado del arranque del mundo y no tiene por
 * qué pasar antes de que exista una partida.
 *
 * Todo el mundo se desplanta en y = 0 (los lotes salen con `pos.y = alto/2`),
 * así que las alturas son directamente las del mundo.
 */
export function construirFachadas(): FachadasConstruidas {
  const mallas = Array.from({ length: CUADRANTES }, () => new Malla())

  /* --- Agrupar las cajas por PREDIO. Aquí muere el código de barras. --- */
  const porLote = new Map<number, number[]>()
  for (let i = 0; i < buildings.length; i++) {
    const lote = buildingLote[i] ?? -i
    const g = porLote.get(lote)
    if (g) g.push(i)
    else porLote.set(lote, [i])
  }

  const frentes: number[] = []
  let tinacos = 0
  const techo = tinte(PALETA.concreto, 0.82)

  for (const [lote, idxs] of porLote) {
    const alto = buildings[idxs[0]].size[1]
    const pr = predioDe(lote, alto)
    // El predio entero va al cuadrante de su primera caja: sus rectángulos
    // caben en un mosaico de 14 m, así que nunca se reparte de verdad.
    const m = mallas[cuadranteDe(buildings[idxs[0]].pos[0], buildings[idxs[0]].pos[2])]

    const aLaCalle: Pano[] = []
    const medianeras: Pano[] = []
    for (const i of idxs) {
      const b = buildings[i]
      for (const p of panosDe(b)) {
        if (daALaCalle(p)) aLaCalle.push(p)
        else medianeras.push(p)
      }
      azotea(m, b, techo)
    }

    // Fusionar las caras de la calle en paños corridos: un predio partido en
    // cinco rectángulos vuelve a ser una pared de casa.
    for (const p of fusionarPanos(aLaCalle)) {
      const ancho = anchoPano(p)
      if (ancho >= FRENTE_MINIMO) {
        frentes.push(ancho)
        fachada(m, p, pr, lote)
      } else {
        muroLiso(m, p, pr)
      }
    }
    for (const p of fusionarPanos(medianeras)) muroLiso(m, p, pr, true)

    // Un tinaco POR PREDIO, sobre su caja más grande.
    if (pr.tinaco) {
      let mayor = buildings[idxs[0]]
      for (const i of idxs) {
        const b = buildings[i]
        if (b.size[0] * b.size[2] > mayor.size[0] * mayor.size[2]) mayor = b
      }
      if (mayor.size[0] * mayor.size[2] > 6) {
        tinacoEnAzotea(m, mayor, pr, lote)
        tinacos++
      }
    }
  }

  /* --- Los locales --- */
  for (let i = 0; i < locales.length; i++) {
    const l = locales[i]
    const m = mallas[cuadranteDe(l.pos[0], l.pos[2])]
    const cajaLocal: Box = { pos: l.pos, size: l.size }
    const dirX = l.door[0] - l.pos[0]
    const dirZ = l.door[2] - l.pos[2]

    for (const p of panosDe(cajaLocal)) {
      /*
       * Se visten TODAS las caras que miran hacia la puerta, no solo la de
       * mayor producto punto. El local 6 tiene rumbo diagonal (√½, −√½), lo
       * que produce un empate entre dos caras y antes elegía una arbitraria:
       * media fachada quedaba de espaldas a la curva por la que se llega. Un
       * local de esquina con rótulo en dos caras además se lee mejor.
       */
      if (dirX * p.dx + dirZ * p.dz > 0.1) fachadaDeLocal(m, p, l.color, i)
      else panel(m, p, p.a, p.b, 0, p.alto, tinte(l.color, 0.88))
      // Pretil: el local remata por arriba, que es parte de lo que lo separa
      // de una casa de una planta.
      caja(m, p, p.a, p.b, p.alto, p.alto + 0.5, FONDO, 0.08, tinte(l.color, 0.75))
    }
    azotea(m, cajaLocal, tinte(PALETA.concreto, 0.86))
  }

  // Los bolardos se reparten por su posición; la glorieta vive entera en el
  // cuadrante de su centro.
  const bolardos = accesos(mallas, cuadranteDe)
  const piezasGlorieta = glorieta(mallas[cuadranteDe(GLORIETA.c[0], GLORIETA.c[1])])

  frentes.sort((a, b) => a - b)
  return {
    mallas,
    stats: {
      lotes: buildings.length,
      predios: porLote.size,
      fachadas: frentes.length,
      frenteMediano: frentes.length ? frentes[Math.floor(frentes.length / 2)] : 0,
      tinacos,
      locales: locales.length,
      bolardos,
      glorieta: piezasGlorieta,
      triangulos: mallas.reduce((t, x) => t + x.triangulos, 0),
      vertices: mallas.reduce((t, x) => t + x.vertices, 0),
    },
  }
}
