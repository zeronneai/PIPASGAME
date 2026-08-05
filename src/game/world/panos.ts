import { Malla, type P3 } from './malla'

/*
 * EL PAÑO: una superficie vertical de fachada, y la rejilla que la compone.
 *
 * Existe por el bug que hundió la primera versión del Paso 2. Antes, cada
 * detalle —ventana, marco, rótulo, cortina— se dibujaba como un quad ENCIMA
 * del muro, separado 5 cm. En el iPhone eso vibraba: dos superficies casi
 * coplanares con un buffer de profundidad sin resolución para separarlas.
 *
 * Aquí el detalle no va encima de la pared: ES la pared. El paño se corta en
 * una rejilla y cada celda lleva su color, así que un marco de ventana es un
 * renglón de celdas pintadas, no una calcomanía. Superficies coplanares: cero,
 * por construcción, no por ajustar un número hasta que dejó de verse.
 *
 * Lo que sí necesita relieve —cornisa, pretil, marquesina, banda de rótulo—
 * se emite como VOLUMEN que sale de la pared. Sobresalir no es ser coplanar.
 */

/**
 * Una superficie vertical alineada a los ejes.
 *
 * `a` y `b` son los extremos sobre el eje de la cara en coordenadas de MUNDO
 * (z si la normal va en x, x si va en z). En coordenadas de mundo y no
 * relativas al centro porque los paños se fusionan entre cajas distintas, y
 * comparar extremos absolutos es lo que hace trivial unir dos que se tocan.
 */
export type Pano = {
  /** Normal horizontal: uno de (±1,0) o (0,±1). */
  dx: number
  dz: number
  /** Coordenada del plano: x si dx ≠ 0, z si dz ≠ 0. */
  plano: number
  a: number
  b: number
  alto: number
}

export const anchoPano = (p: Pano) => p.b - p.a

/** Punto del paño a coordenadas de mundo. `t` sobre el eje de la cara, `y`
 *  de altura y `fuera` de separación de la pared hacia afuera. */
function pt(p: Pano, t: number, y: number, fuera: number): P3 {
  return p.dx !== 0
    ? [p.plano + p.dx * fuera, y, t]
    : [t, y, p.plano + p.dz * fuera]
}

/**
 * Un rectángulo sobre el paño, con el orden de vértices que deja la normal
 * mirando hacia afuera.
 *
 * El sentido de recorrido cambia con la normal y por eso está tabulado aquí
 * una sola vez: al revés, la cara queda de espaldas a la luz y se ve negra —
 * el error más caro de depurar a ojo, porque parece un problema de
 * iluminación y es de orden de vértices.
 */
export function panel(
  m: Malla,
  p: Pano,
  t0: number,
  t1: number,
  y0: number,
  y1: number,
  color: string | [string, string, string, string],
  fuera = 0,
) {
  // Para +X y -Z el eje de la cara corre al revés que la coordenada.
  const invertido = p.dx > 0 || p.dz < 0
  const [u0, u1] = invertido ? [t1, t0] : [t0, t1]
  m.quad(
    pt(p, u0, y0, fuera),
    pt(p, u1, y0, fuera),
    pt(p, u1, y1, fuera),
    pt(p, u0, y1, fuera),
    color,
  )
}

/**
 * Una caja apoyada en el paño, de `f0` a `f1` sobre la normal. Con `f0`
 * negativo la caja se mete en la pared (una ventana rehundida); con `f1`
 * positivo sobresale (una cornisa).
 *
 * Va por `Malla.caja`, que ya resuelve el orden de vértices de las seis caras,
 * en vez de armar el volumen a mano cara por cara.
 */
export function caja(
  m: Malla,
  p: Pano,
  t0: number,
  t1: number,
  y0: number,
  y1: number,
  f0: number,
  f1: number,
  color: string,
) {
  const cf = (f0 + f1) / 2
  const gf = Math.abs(f1 - f0)
  const ct = (t0 + t1) / 2
  const gt = Math.abs(t1 - t0)
  const cy = (y0 + y1) / 2
  const gy = Math.abs(y1 - y0)
  if (p.dx !== 0) {
    m.caja([p.plano + p.dx * cf, cy, ct], [gf, gy, gt], color)
  } else {
    m.caja([ct, cy, p.plano + p.dz * cf], [gt, gy, gf], color)
  }
}

/**
 * El paño como rejilla. `ts` y `ys` son los cortes (ordenados, incluyendo los
 * dos extremos) y `color` decide qué lleva cada celda; `null` deja el hueco,
 * que es como se abre una ventana sin superponer nada.
 *
 * Las celdas contiguas de una misma fila con el mismo color se emiten como UN
 * solo quad. Sin eso, un paño con tres ventanas saldría en cincuenta
 * rectángulos de los que cuarenta son la misma pared lisa: la rejilla es para
 * poder describir la fachada, no para pagarla en triángulos.
 */
export function rejilla(
  m: Malla,
  p: Pano,
  ts: number[],
  ys: number[],
  color: (i: number, j: number) => string | [string, string, string, string] | null,
) {
  for (let j = 0; j < ys.length - 1; j++) {
    let i = 0
    while (i < ts.length - 1) {
      const c = color(i, j)
      if (c === null) {
        i++
        continue
      }
      // Solo se fusionan colores planos: un degradado tiene un valor por
      // esquina y unir dos celdas cambiaría la pendiente.
      let fin = i + 1
      if (typeof c === 'string') {
        while (fin < ts.length - 1 && color(fin, j) === c) fin++
      }
      panel(m, p, ts[i], ts[fin], ys[j], ys[j + 1], c)
      i = fin
    }
  }
}

/**
 * Une los paños que comparten normal y plano y se tocan de punta.
 *
 * Es lo que arregla el aspecto de código de barras. El fusionador de lotes
 * (`raster.ts`) parte un predio en cinco rectángulos de media —y sobre una
 * curva rasterizada, hasta en cuarenta y una astillas de 62 cm—, así que la
 * pared corrida de una casa llegaba aquí hecha pedazos y cada pedazo se
 * pintaba como una casa aparte. Reuniéndolos primero, la fachada se compone
 * una sola vez sobre el frente REAL del predio.
 *
 * La tolerancia cubre la junta de `TRASLAPE` (6 cm por lado) con la que las
 * cajas del layout se solapan para sellar: sin ella, dos rectángulos vecinos
 * del mismo lote se leerían como separados por 12 cm y no se unirían nunca.
 */
export function fusionarPanos(panos: Pano[], tolerancia = 0.2): Pano[] {
  const grupos = new Map<string, Pano[]>()
  for (const p of panos) {
    // El plano se redondea a centímetros: dos cajas del mismo lote pueden
    // diferir en un epsilon de coma flotante y eso no debe separarlas.
    const k = `${p.dx},${p.dz},${p.plano.toFixed(2)}`
    const g = grupos.get(k)
    if (g) g.push(p)
    else grupos.set(k, [p])
  }

  const fuera: Pano[] = []
  for (const g of grupos.values()) {
    g.sort((x, y) => x.a - y.a)
    let actual = { ...g[0] }
    for (let i = 1; i < g.length; i++) {
      const s = g[i]
      if (s.a <= actual.b + tolerancia) {
        actual.b = Math.max(actual.b, s.b)
        actual.alto = Math.max(actual.alto, s.alto)
      } else {
        fuera.push(actual)
        actual = { ...s }
      }
    }
    fuera.push(actual)
  }
  return fuera
}
