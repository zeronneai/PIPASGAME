/*
 * LAS BANQUETAS, EN VECTORIAL. Antes se derivaban de la rejilla («celda de
 * calle a menos de 1.5 m del sólido») engrosada a bloques de 2 m con un
 * umbral del 25 % — eso producía planchas de 15 cm hasta a 5 m del muro, las
 * bahías pavimentadas hasta el eje de la calle, y el serrucho de 2 m que
 * hacía ver segmentadas las curvas. Todo eso se sentía como «choqué con algo
 * que no veo»: el bordillo no golpea la carrocería, levanta la rueda.
 *
 * Aquí las bandas se generan del TRAZO paramétrico: por cada calle, una banda
 * de 1.5 m pegada a cada borde del pavimento; las rectas son cajas largas y
 * los arcos CADENAS de cajas cortas con cuerda calculada para que el error
 * sagital no pase de 2.5 cm (la teselación del pedido — el arco exacto ES el
 * spline, muestreado). Los cruces se recortan con el mismo predicado
 * vectorial que pintó la rejilla y se ochavan con una pieza a 45°. Las cajas
 * son a la vez el visual (InstancedBoxes) y el collider (cuboides): la
 * igualdad física↔visible queda por construcción, sin trimesh.
 *
 * Este módulo es puro (sin three, sin React) y NO toca la rejilla: la lógica
 * del juego (holgura, floods, poseEnCalle) nunca supo de banquetas y sigue
 * sin saber.
 */

import {
  ANGOSTURAS,
  BAHIAS,
  BAHIA_ANCHO,
  BAHIA_FONDO,
  CALLEJONES,
  CALLES,
  GLORIETA,
  MAP_SIZE,
  centroBahia,
} from './traza'

// La misma forma que layout.Box, sin importar layout (layout nos importa).
type Caja = {
  pos: [number, number, number]
  size: [number, number, number]
  rotY?: number
}

/** Ancho de banqueta a cada lado de la calle. La fuente única: layout la
 *  re-exporta. */
export const BANQUETA = 1.5

const TRASLAPE = 0.06
/** De enterrada en el asfalto (−0.1) al nivel de banqueta (0.15). */
const Y0 = -0.1
const ALTO = 0.25
/** El chaflán remata 1 mm abajo: sus puntas traslapan las bandas y dos tapas
 *  coplanares harían z-fighting. */
const ALTO_CHAFLAN = 0.244
/** pintarArco alarga las puntas este margen; el pavimento vectorial también. */
const MARGEN_ARCO = 6
/** Paso de muestreo del eje de banda en rectas. */
const PASO = 0.25
/** Error sagital máximo de las cadenas de arco, en metros. */
const SAGITA = 0.025
const BORDE = MAP_SIZE / 2

// ---------------------------------------------------------- el pavimento

const d2Seg = (
  px: number,
  pz: number,
  a: readonly [number, number],
  b: readonly [number, number],
) => {
  const dx = b[0] - a[0]
  const dz = b[1] - a[1]
  const largo = dx * dx + dz * dz
  let t = largo === 0 ? 0 : ((px - a[0]) * dx + (pz - a[1]) * dz) / largo
  t = t < 0 ? 0 : t > 1 ? 1 : t
  const cx = a[0] + t * dx - px
  const cz = a[1] + t * dz - pz
  return cx * cx + cz * cz
}

type Elemento = (x: number, z: number) => boolean

/** El pavimento de cada elemento del trazo, en vectorial EXACTO: los mismos
 *  predicados con los que raster.ts pintó la rejilla (la rejilla solo los
 *  muestrea en centros de celda). */
function elementos(): Elemento[] {
  const es: Elemento[] = []
  for (const c of CALLES) {
    if (c.forma === 'recta') {
      const r2 = (c.ancho / 2) ** 2
      es.push((x, z) => d2Seg(x, z, c.a, c.b) <= r2)
    } else {
      const da = MARGEN_ARCO / c.r
      const desde = c.a0 - da
      const hasta = c.a1 + da
      const rIn = c.r - c.ancho / 2
      const rEx = c.r + c.ancho / 2
      es.push((x, z) => {
        const d = Math.hypot(x - c.c[0], z - c.c[1])
        if (d < rIn || d > rEx) return false
        let ang = Math.atan2(z - c.c[1], x - c.c[0])
        while (ang < desde) ang += Math.PI * 2
        return ang <= hasta
      })
    }
  }
  // La glorieta: la calzada anular completa.
  es.push((x, z) => {
    const d = Math.hypot(x - GLORIETA.c[0], z - GLORIETA.c[1])
    return d >= GLORIETA.rIsla && d <= GLORIETA.rExt
  })
  for (const c of [...CALLEJONES, ...ANGOSTURAS]) {
    const r2 = (c.ancho / 2) ** 2
    es.push((x, z) => d2Seg(x, z, c.a, c.b) <= r2)
  }
  for (const b of BAHIAS) {
    const c = centroBahia(b)
    const sx = (b.dir[0] !== 0 ? BAHIA_FONDO : BAHIA_ANCHO) / 2
    const sz = (b.dir[0] !== 0 ? BAHIA_ANCHO : BAHIA_FONDO) / 2
    es.push((x, z) => Math.abs(x - c[0]) <= sx && Math.abs(z - c[1]) <= sz)
  }
  return es
}

export type Banquetas = {
  bandas: Caja[]
  chaflanes: Caja[]
  /** Plataforma completa de cada bahía, del borde del pavimento al fondo. */
  plataformas: {
    id: string
    caja: Caja
    /** Coordenada del eje de la calle anfitriona y en qué eje se mide. */
    ejeCalle: number
    normal: 'x' | 'z'
    anchoCalle: number
  }[]
  /** Las esquinas convexas detectadas (una por chaflán), para el test. */
  esquinas: [number, number][]
}

export function generarBanquetas(): Banquetas {
  const es = elementos()
  const fuera = (x: number, z: number) =>
    Math.abs(x) > BORDE || Math.abs(z) > BORDE
  /** Sólido = fuera del mapa o pavimento de nadie. */
  const solido = (x: number, z: number) =>
    fuera(x, z) || !es.some((e) => e(x, z))
  const pavimentoDeOtro = (x: number, z: number, salvo: number) =>
    es.some((e, i) => i !== salvo && e(x, z))
  /** Las bandas del anillo perimetral se pegan al borde de la losa. */
  const clampBorde = (v: number) =>
    Math.max(-(BORDE - BANQUETA / 2), Math.min(BORDE - BANQUETA / 2, v))

  const bandas: Caja[] = []
  const chaflanes: Caja[] = []
  const esquinas: [number, number][] = []

  // ------------------------------------------------ bandas de las rectas

  const bandaRecta = (
    a: readonly [number, number],
    b: readonly [number, number],
    ancho: number,
    idx: number,
  ) => {
    const dx = b[0] - a[0]
    const dz = b[1] - a[1]
    const largo = Math.hypot(dx, dz)
    const ux = dx / largo
    const uz = dz / largo
    // Normal (perpendicular en el plano).
    const nx = -uz
    const nz = ux
    const dEje = ancho / 2 - BANQUETA / 2
    const dSondeo = ancho / 2 + 0.3

    for (const lado of [1, -1]) {
      const n = Math.max(1, Math.round(largo / PASO))
      let inicio = -1
      const cerrar = (fin: number) => {
        const t0 = (inicio * largo) / n
        const t1 = (fin * largo) / n
        if (t1 - t0 < 0.5) return
        const cx = a[0] + ux * ((t0 + t1) / 2) + nx * dEje * lado
        const cz = a[1] + uz * ((t0 + t1) / 2) + nz * dEje * lado
        bandas.push({
          pos: [clampBorde(cx), Y0 + ALTO / 2, clampBorde(cz)],
          size: [BANQUETA, ALTO, t1 - t0 + TRASLAPE * 2],
          rotY: Math.atan2(ux, uz),
        })
      }
      for (let k = 0; k <= n; k++) {
        const t = (k * largo) / n
        const px = a[0] + ux * t + nx * dEje * lado
        const pz = a[1] + uz * t + nz * dEje * lado
        const sx = a[0] + ux * t + nx * dSondeo * lado
        const sz = a[1] + uz * t + nz * dSondeo * lado
        const vale = !pavimentoDeOtro(px, pz, idx) && solido(sx, sz)
        if (vale && inicio < 0) inicio = k
        if ((!vale || k === n) && inicio >= 0) {
          cerrar(vale ? k : k - 1)
          inicio = -1
        }
      }
    }
  }

  // ----------------------------------------- cadenas de arco (y remates)

  /** Cadena de cajas cortas sobre un arco de radio `rl` (el eje de la banda).
   *  La cuerda sale del error sagital: c = √(8·r·s), acotada — a estos radios
   *  el quiebre entre eslabones queda en ~2-4° y no se lee. */
  const cadenaArco = (
    cx: number,
    cz: number,
    rl: number,
    a0: number,
    a1: number,
    rSondeo: number,
    idx: number,
  ) => {
    const cuerda = Math.min(2.5, Math.max(1.2, Math.sqrt(8 * rl * SAGITA)))
    const pasos = Math.max(1, Math.ceil((rl * (a1 - a0)) / cuerda))
    const dTheta = (a1 - a0) / pasos
    for (let k = 0; k < pasos; k++) {
      const ta = a0 + k * dTheta
      const tb = ta + dTheta
      const tm = (ta + tb) / 2
      let vale = true
      for (const t of [ta, tm, tb]) {
        const px = cx + rl * Math.cos(t)
        const pz = cz + rl * Math.sin(t)
        if (pavimentoDeOtro(px, pz, idx) || !solido(cx + rSondeo * Math.cos(t), cz + rSondeo * Math.sin(t))) {
          vale = false
          break
        }
      }
      if (!vale) continue
      const px = cx + rl * Math.cos(tm)
      const pz = cz + rl * Math.sin(tm)
      // Tangente del arco (θ creciente): (−sin, cos) en (x, z).
      bandas.push({
        pos: [px, Y0 + ALTO / 2, pz],
        size: [BANQUETA, ALTO, rl * dTheta + TRASLAPE * 2],
        rotY: Math.atan2(-Math.sin(tm), Math.cos(tm)),
      })
    }
  }

  CALLES.forEach((c, idx) => {
    if (c.forma === 'recta') {
      bandaRecta(c.a, c.b, c.ancho, idx)
      /*
       * Remate de fondo de saco: si más allá de la punta hay sólido, la tapa
       * redonda del pavimento lleva su media corona de banqueta (los
       * retornos y las calles que mueren contra una manzana).
       */
      const dx = c.b[0] - c.a[0]
      const dz = c.b[1] - c.a[1]
      const largo = Math.hypot(dx, dz)
      const ux = dx / largo
      const uz = dz / largo
      for (const [punta, sx, sz] of [
        [c.b, ux, uz],
        [c.a, -ux, -uz],
      ] as const) {
        // Las calles que mueren en el borde del mapa no llevan remate: su
        // «tapa» está fuera de la losa.
        if (
          Math.abs(punta[0]) > BORDE - 1 ||
          Math.abs(punta[1]) > BORDE - 1
        )
          continue
        const probe = (c.ancho / 2 + 0.3)
        if (!solido(punta[0] + sx * probe, punta[1] + sz * probe)) continue
        const aCentro = Math.atan2(sz, sx)
        cadenaArco(
          punta[0],
          punta[1],
          c.ancho / 2 - BANQUETA / 2,
          aCentro - Math.PI / 2,
          aCentro + Math.PI / 2,
          c.ancho / 2 + 0.3,
          idx,
        )
      }
    } else {
      const da = MARGEN_ARCO / c.r
      for (const lado of [1, -1]) {
        const rl = c.r + lado * (c.ancho / 2 - BANQUETA / 2)
        const rS = c.r + lado * (c.ancho / 2 + 0.3)
        cadenaArco(c.c[0], c.c[1], rl, c.a0 - da, c.a1 + da, rS, idx)
      }
    }
  })

  // La glorieta: la corona de la isla (círculo completo) y la exterior
  // (recortada sola por las cinco salidas, vía el pavimento de otro).
  const idxGlorieta = CALLES.length
  cadenaArco(
    GLORIETA.c[0],
    GLORIETA.c[1],
    GLORIETA.rIsla + BANQUETA / 2,
    0,
    Math.PI * 2,
    GLORIETA.rIsla - 0.3,
    idxGlorieta,
  )
  cadenaArco(
    GLORIETA.c[0],
    GLORIETA.c[1],
    GLORIETA.rExt - BANQUETA / 2,
    0,
    Math.PI * 2,
    GLORIETA.rExt + 0.3,
    idxGlorieta,
  )

  // ------------------------------------------------- chaflanes de cruce

  /*
   * En cada esquina CONVEXA de un cruce recta–recta ortogonal, el recorte de
   * las dos bandas deja una muesca cuadrada de 1.5×1.5. La pieza a 45° cubre
   * el triángulo pegado a la esquina sólida y deja el de adentro como
   * asfalto: el ochavo del pedido.
   */
  const rectas = CALLES.map((c, i) => ({ c, i })).filter(
    ({ c }) =>
      c.forma === 'recta' &&
      (Math.abs(c.a[0] - c.b[0]) < 0.01 || Math.abs(c.a[1] - c.b[1]) < 0.01),
  ) as { c: Extract<(typeof CALLES)[number], { forma: 'recta' }>; i: number }[]

  for (let p = 0; p < rectas.length; p++) {
    for (let q = p + 1; q < rectas.length; q++) {
      const A = rectas[p].c
      const B = rectas[q].c
      const aHoriz = Math.abs(A.a[1] - A.b[1]) < 0.01
      const bHoriz = Math.abs(B.a[1] - B.b[1]) < 0.01
      if (aHoriz === bHoriz) continue // paralelas
      const H = aHoriz ? A : B // varía x, z fijo
      const V = aHoriz ? B : A // varía z, x fijo
      const px = V.a[0]
      const pz = H.a[1]
      // ¿El cruce existe? Los ejes se tocan (con holgura para las T).
      const enH =
        px >= Math.min(H.a[0], H.b[0]) - V.ancho / 2 - 1 &&
        px <= Math.max(H.a[0], H.b[0]) + V.ancho / 2 + 1
      const enV =
        pz >= Math.min(V.a[1], V.b[1]) - H.ancho / 2 - 1 &&
        pz <= Math.max(V.a[1], V.b[1]) + H.ancho / 2 + 1
      if (!enH || !enV) continue

      // Contención propia de cada recta (con sus tapas), para verificar que
      // AMBAS calles llegan de verdad a la esquina: en una unión en T, el
      // lado ciego no tiene esquinas — solo el muro corrido de la pasante.
      const dentroH = (x: number, z: number) =>
        Math.abs(z - pz) <= H.ancho / 2 &&
        x >= Math.min(H.a[0], H.b[0]) - H.ancho / 2 &&
        x <= Math.max(H.a[0], H.b[0]) + H.ancho / 2
      const dentroV = (x: number, z: number) =>
        Math.abs(x - px) <= V.ancho / 2 &&
        z >= Math.min(V.a[1], V.b[1]) - V.ancho / 2 &&
        z <= Math.max(V.a[1], V.b[1]) + V.ancho / 2

      for (const sx of [1, -1]) {
        for (const sz of [1, -1]) {
          const ex = px + sx * (V.ancho / 2)
          const ez = pz + sz * (H.ancho / 2)
          if (Math.abs(ex) > BORDE - 0.5 || Math.abs(ez) > BORDE - 0.5) continue
          // Las dos calles tienen pavimento pasando la esquina (cruce real).
          if (!dentroH(ex + sx * 0.6, ez - sz * 0.2)) continue
          if (!dentroV(ex - sx * 0.2, ez + sz * 0.6)) continue
          // Convexa = más allá de la esquina hay sólido de verdad.
          if (!solido(ex + sx * 0.4, ez + sz * 0.4)) continue
          // Y la muesca es asfalto de cruce, no el pavimento de un tercero.
          const ix = ex - sx * 0.4
          const iz = ez - sz * 0.4
          if (solido(ix, iz)) continue
          esquinas.push([ex, ez])
          /*
           * La pieza: cubre el triángulo de la muesca pegado a la esquina.
           * Centro sobre la diagonal de la esquina y eje largo a lo largo del
           * corte a 45° (de K1 = E+1.5·uA a K2 = E+1.5·uB). Va un pelo
           * ENCOGIDA y arrimada a la esquina: con el traslape completo sus
           * puntas asomaban 8 cm al arroyo, que es justo lo que este módulo
           * vino a matar. Hacia el muro sí traslapa (sella la junta).
           */
          const ux = -sx
          const uz = -sz
          const arrimo = BANQUETA / 4 - TRASLAPE
          chaflanes.push({
            pos: [
              ex + arrimo * ux,
              Y0 + ALTO_CHAFLAN / 2,
              ez + arrimo * uz,
            ],
            size: [
              BANQUETA / Math.SQRT2 + TRASLAPE * 2,
              ALTO_CHAFLAN,
              BANQUETA * Math.SQRT2 - TRASLAPE * 2,
            ],
            rotY: Math.atan2(-ux, uz),
          })
        }
      }
    }
  }

  // ------------------------------------------------ plataformas de bahía

  const plataformas: Banquetas['plataformas'] = []
  for (const b of BAHIAS) {
    // La recta anfitriona: la más cercana al centro del rect de la bahía.
    const centro = centroBahia(b)
    let host: Extract<(typeof CALLES)[number], { forma: 'recta' }> | undefined
    let mejor = Infinity
    for (const c of CALLES) {
      if (c.forma !== 'recta') continue
      const d = d2Seg(centro[0], centro[1], c.a, c.b)
      if (d < mejor) {
        mejor = d
        host = c
      }
    }
    if (!host) continue // no debería pasar; el test cobra las 12
    /*
     * EL ARREGLO DEL BUG: la plataforma es la parte del rect de la bahía MÁS
     * ALLÁ del borde-menos-banqueta del pavimento (empalma con la banda de la
     * calle), nunca desde el eje. Antes cubría media calzada y frente a
     * cuatro spots no cabía ni la heredada.
     */
    const horizontalCalle = Math.abs(host.a[1] - host.b[1]) < 0.01
    const eje = horizontalCalle ? host.a[1] : host.a[0]
    const desde = host.ancho / 2 - BANQUETA
    const sx = (b.dir[0] !== 0 ? BAHIA_FONDO : BAHIA_ANCHO) / 2
    const sz = (b.dir[0] !== 0 ? BAHIA_ANCHO : BAHIA_FONDO) / 2
    const caja: Caja = { pos: [0, Y0 + ALTO / 2, 0], size: [0, ALTO, 0] }
    if (horizontalCalle) {
      const sgn = Math.sign(centro[1] - eje)
      const cerca = eje + sgn * desde
      const lejos = centro[1] + sgn * sz
      caja.pos = [centro[0], caja.pos[1], (cerca + lejos) / 2 + (sgn * TRASLAPE) / 2]
      caja.size = [sx * 2 + TRASLAPE * 2, ALTO, Math.abs(lejos - cerca) + TRASLAPE]
    } else {
      const sgn = Math.sign(centro[0] - eje)
      const cerca = eje + sgn * desde
      const lejos = centro[0] + sgn * sx
      caja.pos = [(cerca + lejos) / 2 + (sgn * TRASLAPE) / 2, caja.pos[1], centro[1]]
      caja.size = [Math.abs(lejos - cerca) + TRASLAPE, ALTO, sz * 2 + TRASLAPE * 2]
    }
    plataformas.push({
      id: b.id,
      ejeCalle: eje,
      normal: horizontalCalle ? 'z' : 'x',
      anchoCalle: host.ancho,
      caja,
    })
  }

  return { bandas, chaflanes, plataformas, esquinas }
}
