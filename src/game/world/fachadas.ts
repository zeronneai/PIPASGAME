import { PALETA, colorFachada } from '../render/paleta'
import { ANGOSTURAS, BARDA_ALTURA, CALLEJONES, buildings, esLibre, locales, type Box } from './layout'
import type { Punto } from './raster'
import { Malla, dado, mezclar, tinte, type P3 } from './malla'

/*
 * LAS FACHADAS DE LA COLONIA (Fase 3, Paso 2).
 *
 * Los lotes dejan de ser cajas. Todo esto es procedural y determinista por
 * índice de layout: sin un solo modelo externo, sin una sola textura, y la
 * misma colonia en cada carga —que es lo que la vuelve un LUGAR, con esquinas
 * que uno reconoce, en vez de un patrón nuevo cada vez que se recarga—.
 *
 * TODO SALE EN UNA SOLA GEOMETRÍA, con color por vértice. Son 1059 lotes
 * contra un tope de 100 draw calls: una malla por lote es imposible, e
 * instanciar amarraría a que todos sean idénticos salvo el color, que es justo
 * lo que este paso viene a romper. Fusionar da las dos cosas — un draw call y
 * variación por vértice— y es exactamente lo que pide la sección 1 del
 * documento para el grueso de la colonia.
 *
 * DE DÓNDE SALE LA VARIACIÓN. El color plano por predio no alcanza: dos casas
 * del mismo color se veían la misma casa. Encima del color va lo que de verdad
 * distingue una fachada de otra en la calle:
 *
 *   - La banda de cal de abajo, con altura distinta en cada predio. Es lo
 *     primero que se ve al caminar y lo que más varía en la realidad.
 *   - La mancha de humedad, que baja desde la azotea. Va en el VÉRTICE de
 *     arriba del muro y no cuesta un solo triángulo.
 *   - El reborde y el remate, que rompen el plano de arriba.
 *   - Los marcos de ventana en color contrastante, y cuántas ventanas hay.
 *   - El tinaco de la azotea, que además es la seña de identidad del juego.
 *
 * Nada de esto pide una textura: todo cabe en la geometría y en el color.
 */

/** Cuánto se despega de la pared lo que va pintado encima (marcos, rótulos).
 *  Suficiente para que no pelee con el muro en el z-buffer. */
const RELIEVE = 0.05

/** Una cara vertical de una caja, con su rumbo y su eje horizontal. */
type Cara = {
  /** Normal horizontal hacia afuera. */
  dx: number
  dz: number
  /** Centro de la cara, a nivel de suelo. */
  cx: number
  cz: number
  /** Ancho de la cara. */
  ancho: number
  /** Eje horizontal de la cara, orientado para que el quad quede de frente. */
  ux: number
  uz: number
}

/**
 * Las cuatro caras de una caja. El eje `u` de cada una va en el sentido que
 * deja la normal apuntando hacia afuera; con el sentido cambiado la cara
 * queda de espaldas a la luz y se ve negra.
 */
function caras(b: Box): Cara[] {
  const [x, , z] = b.pos
  const [sx, , sz] = b.size
  return [
    { dx: 1, dz: 0, cx: x + sx / 2, cz: z, ancho: sz, ux: 0, uz: -1 },
    { dx: -1, dz: 0, cx: x - sx / 2, cz: z, ancho: sz, ux: 0, uz: 1 },
    { dx: 0, dz: 1, cx: x, cz: z + sz / 2, ancho: sx, ux: 1, uz: 0 },
    { dx: 0, dz: -1, cx: x, cz: z - sz / 2, ancho: sx, ux: -1, uz: 0 },
  ]
}

/**
 * Si una cara da a la calle. Se tantea metro y medio hacia afuera: si ahí hay
 * pavimento, esa cara la ve el jugador y merece fachada. Las que dan a otro
 * lote son medianeras y se quedan lisas, que es lo que son en la realidad y
 * además es donde se ahorran los triángulos.
 */
function daALaCalle(c: Cara): boolean {
  return esLibre(c.cx + c.dx * 1.5, c.cz + c.dz * 1.5)
}

/** Un punto sobre la cara: `t` a lo largo (en metros desde el centro), `y` de
 *  altura y `fuera` de separación de la pared. */
function pt(c: Cara, t: number, y: number, fuera = 0): P3 {
  return [
    c.cx + c.ux * t + c.dx * fuera,
    y,
    c.cz + c.uz * t + c.dz * fuera,
  ]
}

/** Un rectángulo pegado a una cara, con esquinas en (t0,y0)–(t1,y1). */
function panel(
  m: Malla,
  c: Cara,
  t0: number,
  t1: number,
  y0: number,
  y1: number,
  color: string | [string, string, string, string],
  fuera = 0,
) {
  m.quad(pt(c, t0, y0, fuera), pt(c, t1, y0, fuera), pt(c, t1, y1, fuera), pt(c, t0, y1, fuera), color)
}

/* ------------------------------------------------------------ el predio */

/** Lo que hace distinto a un predio de su vecino del mismo color. */
type Predio = {
  muro: string
  /** Alto de la banda de cal de abajo. */
  zocalo: number
  colorZocalo: string
  /** 0 a 1: qué tan manchada de humedad está la parte alta. */
  humedad: number
  /** Franja de remate arriba del muro. */
  remate: number
  colorRemate: string
  /** Color de los marcos de ventana. Contrasta con el muro a propósito. */
  marco: string
  /** Cuántas ventanas caben por metro de fachada. */
  ventanas: boolean
  porton: boolean
  tinaco: boolean
  colorTinaco: string
}

/** Los colores en que se pintan marcos y herrería. Siempre contrastan con la
 *  fachada: es lo que hace que una ventana se LEA como ventana de lejos. */
const CONTRASTES = [PALETA.anil, PALETA.terracota, PALETA.cal, PALETA.limon, PALETA.ocre]

/** El tinaco: negro el de siempre, y alguno ocre o terracota de los nuevos. */
const TINACOS = ['#2b2b30', '#2b2b30', '#33333a', PALETA.terracota, PALETA.ocre]

function predioDe(i: number, alto: number, huella: number): Predio {
  const base = colorFachada(i)
  // Dos casas del mismo color de la tira no son el mismo color exacto: el sol
  // y los años no pegan igual en toda la cuadra.
  const muro = tinte(base, 0.88 + dado(i, 1) * 0.24)
  const humedad = Math.pow(dado(i, 2), 1.7)
  const conCal = dado(i, 3) < 0.72

  return {
    muro,
    zocalo: 0.5 + dado(i, 4) * 0.7,
    // Casi siempre cal; en el resto, el mismo muro más oscuro (el zoclo de
    // cemento que se ve en media colonia).
    colorZocalo: conCal
      ? tinte(PALETA.cal, 0.92 + dado(i, 5) * 0.16)
      : tinte(muro, 0.68),
    humedad,
    remate: 0.18 + dado(i, 6) * 0.22,
    colorRemate: dado(i, 7) < 0.5 ? tinte(muro, 1.14) : tinte(PALETA.cal, 0.95),
    marco: CONTRASTES[(i * 7) % CONTRASTES.length],
    // Las ventanas piden pared: en una barda de patio no hay.
    ventanas: alto > BARDA_ALTURA + 0.3,
    porton: dado(i, 8) < 0.35,
    /*
     * El tinaco es la seña de identidad del juego —es literalmente a lo que
     * el jugador le lleva agua—, así que la azotea de la colonia tiene que
     * estar poblada: uno de cada dos predios con techo que aguante. Un mapa
     * con cuatro tinacos contados no cuenta de qué va esto.
     */
    tinaco: alto > BARDA_ALTURA + 0.3 && huella > 11 && dado(i, 9) < 0.62,
    colorTinaco: TINACOS[(i * 11) % TINACOS.length],
  }
}

/**
 * Una fachada a la calle: banda de cal abajo, muro con su humedad, franja de
 * remate arriba, y encima las ventanas y el portón.
 *
 * La humedad va como color de los DOS vértices de arriba del muro. El
 * degradado lo interpola la tarjeta gratis, así que una mancha que baja desde
 * la azotea —que es como se manchan de verdad— cuesta exactamente cero
 * triángulos más que un muro plano.
 */
function frenteALaCalle(m: Malla, c: Cara, alto: number, p: Predio, i: number) {
  const zocalo = Math.min(p.zocalo, alto * 0.4)
  const remate = Math.min(p.remate, alto * 0.15)
  const yMuro0 = zocalo
  const yMuro1 = alto - remate
  const h = c.ancho / 2

  // El agua escurre desde arriba: verdinegro, nunca negro puro.
  const manchado = mezclar(p.muro, '#4a5245', p.humedad * 0.55)

  panel(m, c, -h, h, 0, zocalo, p.colorZocalo)
  panel(m, c, -h, h, yMuro0, yMuro1, [p.muro, p.muro, manchado, manchado])
  panel(m, c, -h, h, yMuro1, alto, p.colorRemate)

  if (!p.ventanas || c.ancho < 2.6) return

  /*
   * Las ventanas se reparten sobre el ancho real de la cara. Cuántas caben lo
   * decide la cara y no un número fijo: un frente de 4 m con tres ventanas se
   * ve de maqueta.
   */
  const n = Math.max(1, Math.min(3, Math.floor(c.ancho / 3.4)))
  const paso = c.ancho / n
  const ancho = Math.min(1.15, paso * 0.42)
  const yv0 = zocalo + 0.45
  const yv1 = Math.min(yMuro1 - 0.25, yv0 + 1.25)
  if (yv1 <= yv0 + 0.4) return

  for (let k = 0; k < n; k++) {
    const t = -h + paso * (k + 0.5)
    // Marco y vidrio: dos quads. El marco sobresale un pelo más que el vidrio
    // para que se lea el reveque alrededor del hueco.
    panel(m, c, t - ancho / 2, t + ancho / 2, yv0, yv1, p.marco, RELIEVE)
    panel(m, c, t - ancho / 2 + 0.13, t + ancho / 2 - 0.13, yv0 + 0.13, yv1 - 0.13, PALETA.vidrio, RELIEVE * 1.6)
  }

  // El portón: solo donde de verdad cabe uno, y no en todos los predios.
  if (p.porton && c.ancho >= 4.2) {
    const ap = 2.2
    const t = -h + c.ancho * (0.2 + dado(i, 12) * 0.6)
    const t0 = Math.max(-h + 0.2, t - ap / 2)
    const t1 = Math.min(h - 0.2, t0 + ap)
    panel(m, c, t0, t1, 0, Math.min(2.3, alto - remate - 0.2), tinte(p.marco, 0.8), RELIEVE)
  }
}

/** El tinaco de la azotea: el objeto más reconocible de una colonia y, en un
 *  juego de pipas de agua, el que más cuenta la historia. */
function tinacoEnAzotea(m: Malla, b: Box, p: Predio, i: number) {
  const [x, , z] = b.pos
  const [sx, alto, sz] = b.size
  // Descentrado y arrimado a una esquina, que es donde se ponen.
  const ox = (dado(i, 13) - 0.5) * Math.max(0, sx - 2.2)
  const oz = (dado(i, 14) - 0.5) * Math.max(0, sz - 2.2)
  const r = 0.55 + dado(i, 15) * 0.2
  const h = 1.0 + dado(i, 16) * 0.35
  // La base de block sobre la que se para: sin ella el tinaco flota.
  m.caja([x + ox, alto + 0.12, z + oz], [r * 2.1, 0.24, r * 2.1], tinte(PALETA.concreto, 0.9))
  m.cilindro([x + ox, alto + 0.24 + h / 2, z + oz], r, h, 8, p.colorTinaco, tinte(p.colorTinaco, 1.25))
}

/* ------------------------------------------------------------- locales */

/*
 * LOS SEIS LOCALES (Parte B del paso).
 *
 * El problema que resuelven: hasta ahora un local era una caja de color, y
 * desde la calle no se distinguía de una casa. El jugador no sabía a dónde ir
 * y acababa leyendo el minimapa en vez de leer la colonia.
 *
 * La solución es diegética, con el lenguaje de un negocio de barrio de
 * verdad: rótulo pintado ocupando el ancho del frente, cortina metálica,
 * toldo y ventana de mostrador. Cuatro señales que juntas se leen como
 * «aquí venden algo» desde media cuadra, sin un solo marcador flotante.
 */
function fachadaDeLocal(m: Malla, c: Cara, alto: number, color: string, i: number) {
  const h = c.ancho / 2
  const muro = tinte(color, 0.95)
  const acento = CONTRASTES[(i * 5) % CONTRASTES.length]

  // Muro liso: en un local el protagonismo es del rótulo, no de la pared.
  panel(m, c, -h, h, 0, alto, muro)

  /*
   * EL RÓTULO: una banda que ocupa TODO el frente, alta y de color plano con
   * su filete. Sin texto —eso son texturas de canvas y es del Paso 3—, pero
   * la silueta de un rótulo de lonchería ya es reconocible sin leerlo.
   */
  const yr1 = Math.min(alto - 0.25, 3.5)
  const yr0 = yr1 - 0.95
  panel(m, c, -h + 0.15, h - 0.15, yr0, yr1, acento, RELIEVE)
  panel(m, c, -h + 0.32, h - 0.32, yr0 + 0.16, yr1 - 0.16, tinte(acento, 1.5), RELIEVE * 1.6)

  /*
   * LA CORTINA METÁLICA: franjas verticales alternadas. Es el detalle que más
   * barato dice «negocio», porque ninguna casa tiene una.
   */
  const anchoCortina = Math.min(3.6, c.ancho * 0.5)
  const tc = -anchoCortina / 2
  const franjas = 9
  const paso = anchoCortina / franjas
  for (let k = 0; k < franjas; k++) {
    const tono = k % 2 === 0 ? '#8b8f95' : '#6f747b'
    panel(m, c, tc + k * paso, tc + (k + 1) * paso, 0.05, 2.35, tono, RELIEVE)
  }

  /* LA VENTANA DE MOSTRADOR: ancha y baja, a la altura de despachar. */
  const tv = c.ancho > 7 ? tc - 1.9 : tc - 1.0
  if (tv - 0.8 > -h + 0.2) {
    panel(m, c, tv - 1.5, tv, 1.0, 2.25, acento, RELIEVE)
    panel(m, c, tv - 1.36, tv - 0.14, 1.14, 2.11, PALETA.vidrio, RELIEVE * 1.6)
  }

  /*
   * EL TOLDO: sobresale de la pared, y por eso es lo que se ve primero al
   * venir por la banqueta —los rótulos planos se pierden en escorzo, un toldo
   * no—. Va a rayas, como todos.
   */
  const yt = 2.55
  const vuelo = 1.1
  const rayas = 8
  const pasoR = anchoCortina / rayas
  for (let k = 0; k < rayas; k++) {
    const t0 = tc + k * pasoR
    const t1 = tc + (k + 1) * pasoR
    const tono = k % 2 === 0 ? PALETA.terracota : tinte(PALETA.cal, 1.02)
    // La lona, inclinada hacia afuera y hacia abajo.
    m.quad(pt(c, t0, yt, 0), pt(c, t1, yt, 0), pt(c, t1, yt - 0.45, vuelo), pt(c, t0, yt - 0.45, vuelo), tono)
    // El faldón del frente, que es lo que se ve de lejos.
    m.quad(
      pt(c, t0, yt - 0.45, vuelo),
      pt(c, t1, yt - 0.45, vuelo),
      pt(c, t1, yt - 0.72, vuelo),
      pt(c, t0, yt - 0.72, vuelo),
      tono,
    )
  }
}

/* ------------------------------------------------------- el constructor */

export type FachadasConstruidas = {
  malla: Malla
  stats: {
    lotes: number
    frentesALaCalle: number
    tinacos: number
    locales: number
    bolardos: number
    triangulos: number
    vertices: number
  }
}

/* -------------------------------------------------- accesos peatonales */

/*
 * QUE SE VEA DESDE LA CALLE POR DÓNDE NO ENTRA LA PIPA (Parte B del paso).
 *
 * La colonia ya tiene dos clases de estrechez, y hasta ahora ninguna se veía:
 * el jugador la descubría estrellándose. Cada una recibe su seña, y son
 * distintas a propósito porque significan cosas distintas:
 *
 *   - CALLEJÓN SOLO A PIE: bolardos CRUZANDO la boca. Leen como «aquí no
 *     entra un vehículo», que es exactamente lo que son. Van pintados de
 *     ocre y cal, como los postes de las calles de verdad.
 *   - ANGOSTURA: bolardos a los COSTADOS, marcando el cuello sin cerrarlo.
 *     Ahí sí se pasa —la heredada sobrada, la mediana apretada— y el poste
 *     dice «mide tu ancho», no «no pases».
 *
 * Van en la misma malla que las fachadas: son estáticos y de sobra caben, así
 * que cuestan cero draw calls en vez del que costaría instanciarlos aparte.
 */
function bolardo(m: Malla, x: number, z: number, i: number) {
  const alto = 0.95
  m.cilindro([x, alto / 2, z], 0.13, alto, 6, PALETA.concreto)
  // La franja pintada de arriba: es lo que lo hace visible de lejos y es lo
  // que tienen todos los postes de la calle.
  m.cilindro([x, alto - 0.16, z], 0.145, 0.3, 6, i % 2 === 0 ? PALETA.ocre : PALETA.anil)
}

function accesos(m: Malla): number {
  let n = 0
  const marcarBoca = (a: Punto, b: Punto, ancho: number, cruzando: boolean) => {
    // El rumbo del callejón y su perpendicular.
    const dx = b[0] - a[0]
    const dz = b[1] - a[1]
    const len = Math.hypot(dx, dz) || 1
    const ux = dx / len
    const uz = dz / len
    const px = -uz
    const pz = ux

    // Las dos bocas: un poco adentro del extremo, para que el poste quede en
    // la entrada y no flotando en la bocacalle.
    for (const [ex, ez, signo] of [
      [a[0], a[1], 1],
      [b[0], b[1], -1],
    ] as const) {
      const bx = ex + ux * signo * 0.8
      const bz = ez + uz * signo * 0.8
      if (cruzando) {
        // Tres postes repartidos en el ancho: cierran el paso a un vehículo y
        // dejan pasar a una persona.
        for (let k = -1; k <= 1; k++) {
          bolardo(m, bx + px * k * (ancho / 3), bz + pz * k * (ancho / 3), n++)
        }
      } else {
        // Uno de cada lado, justo en el filo del cuello.
        bolardo(m, bx + px * (ancho / 2 + 0.35), bz + pz * (ancho / 2 + 0.35), n++)
        bolardo(m, bx - px * (ancho / 2 + 0.35), bz - pz * (ancho / 2 + 0.35), n++)
      }
    }
  }

  for (const c of CALLEJONES) {
    if (c.soloAPie) marcarBoca(c.a, c.b, c.ancho, true)
  }
  for (const a of ANGOSTURAS) {
    marcarBoca(a.a, a.b, a.ancho, false)
  }
  return n
}

/** La azotea: plana y de un tono más claro, que es la cara que más luz
 *  recibe. Una sola cara, porque la de abajo nunca se ve. */
function azotea(m: Malla, b: Box) {
  const [x, , z] = b.pos
  const [sx, alto, sz] = b.size
  const y = alto // todo el mundo se desplanta en y = 0
  m.quad(
    [x - sx / 2, y, z + sz / 2],
    [x + sx / 2, y, z + sz / 2],
    [x + sx / 2, y, z - sz / 2],
    [x - sx / 2, y, z - sz / 2],
    tinte(PALETA.concreto, 0.82),
  )
}

/**
 * Construye la colonia entera —lotes y locales— en una sola malla.
 *
 * Se llama una vez, al montar la escena. No corre a nivel de módulo a
 * propósito: es el trabajo más pesado del arranque del mundo y no tiene por
 * qué pasar antes de que exista una partida.
 *
 * Todo el mundo se desplanta en y = 0 (los lotes salen con `pos.y = alto/2`),
 * así que las alturas de los emisores son directamente las del mundo y no hay
 * que arrastrar un desplante por toda la construcción.
 */
export function construirFachadas(): FachadasConstruidas {
  const m = new Malla()
  let frentes = 0
  let tinacos = 0

  for (let i = 0; i < buildings.length; i++) {
    const b = buildings[i]
    const alto = b.size[1]
    const p = predioDe(i, alto, b.size[0] * b.size[2])

    for (const c of caras(b)) {
      if (daALaCalle(c)) {
        frentes++
        frenteALaCalle(m, c, alto, p, i)
      } else {
        // Medianera: un quad y ya. Nadie la ve, y son la mitad de las caras —
        // ahí está la mitad del presupuesto de triángulos de la colonia.
        const h = c.ancho / 2
        panel(m, c, -h, h, 0, alto, tinte(p.muro, 0.9))
      }
    }

    azotea(m, b)

    if (p.tinaco) {
      tinacoEnAzotea(m, b, p, i)
      tinacos++
    }
  }

  // Los locales, con su propio lenguaje.
  for (let i = 0; i < locales.length; i++) {
    const l = locales[i]
    const caja: Box = { pos: l.pos, size: l.size }
    const alto = l.size[1]
    const cs = caras(caja)

    /*
     * La cara que da a la puerta es la que el jugador ve al llegar, y es la
     * única que se viste: rotular las cuatro haría que el local se leyera
     * como negocio también desde el callejón de atrás, que es donde no hay
     * nada. Se elige por proyección de la puerta sobre cada normal.
     */
    let mejor = 0
    let mejorD = -Infinity
    for (let k = 0; k < cs.length; k++) {
      const d = (l.door[0] - l.pos[0]) * cs[k].dx + (l.door[2] - l.pos[2]) * cs[k].dz
      if (d > mejorD) {
        mejorD = d
        mejor = k
      }
    }

    for (let k = 0; k < cs.length; k++) {
      if (k === mejor) fachadaDeLocal(m, cs[k], alto, l.color, i)
      else {
        const h = cs[k].ancho / 2
        panel(m, cs[k], -h, h, 0, alto, tinte(l.color, 0.9))
      }
    }
    azotea(m, caja)
  }

  const bolardos = accesos(m)

  return {
    malla: m,
    stats: {
      lotes: buildings.length,
      frentesALaCalle: frentes,
      tinacos,
      locales: locales.length,
      bolardos,
      triangulos: m.triangulos,
      vertices: m.vertices,
    },
  }
}
