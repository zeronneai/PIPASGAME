/*
 * Rejilla de ocupación: la herramienta con la que se arma la colonia.
 *
 * La idea de fondo del trazo nuevo es que las calles se PINTAN y todo lo que
 * no quedó pintado es sólido. Así «ninguna manzana queda hueca» deja de ser
 * algo que hay que cuidar a mano y pasa a ser una consecuencia del pipeline:
 * no existe el concepto de terreno vacío, solo calle o volumen.
 *
 * Todo aquí es función pura sobre arreglos tipados: ni three, ni React, ni
 * nada del juego. Los tests lo usan tal cual.
 */

/** Celda cuadrada de la rejilla, en metros. */
export const CELDA = 0.5

export type Rejilla = {
  /** Celdas por lado. */
  n: number
  /** Metros por celda. */
  celda: number
  /** Coordenada de mundo de la orilla (la de menor x y menor z). */
  min: number
  /** 0 = sólido, 1 = pintado (calle). Una celda, un byte. */
  data: Uint8Array
}

export type Punto = readonly [number, number]

/** Rectángulo en celdas, tal como sale de `fusionarRects`. */
export type RectCeldas = { i: number; j: number; w: number; h: number; etiqueta: number }

export function crearRejilla(lado: number, celda = CELDA): Rejilla {
  const n = Math.round(lado / celda)
  return { n, celda, min: -lado / 2, data: new Uint8Array(n * n) }
}

/** Centro de la celda i, en metros. */
export function aMundo(g: Rejilla, i: number) {
  return g.min + (i + 0.5) * g.celda
}

/** Celda que contiene la coordenada x (puede caer fuera de la rejilla). */
export function aCelda(g: Rejilla, x: number) {
  return Math.floor((x - g.min) / g.celda)
}

export function dentro(g: Rejilla, i: number, j: number) {
  return i >= 0 && j >= 0 && i < g.n && j < g.n
}

/** Valor en coordenadas de mundo; fuera de la rejilla cuenta como sólido. */
export function valorEn(g: Rejilla, x: number, z: number) {
  const i = aCelda(g, x)
  const j = aCelda(g, z)
  return dentro(g, i, j) ? g.data[j * g.n + i] : 0
}

/**
 * Recorre solo las celdas de una caja de mundo. Pintar es O(área del trazo),
 * no O(mapa): con ~30 elementos la construcción entera queda en milisegundos.
 */
function porCaja(
  g: Rejilla,
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  fn: (i: number, j: number, x: number, z: number) => void,
) {
  const i0 = Math.max(0, aCelda(g, x0))
  const j0 = Math.max(0, aCelda(g, z0))
  const i1 = Math.min(g.n - 1, aCelda(g, x1))
  const j1 = Math.min(g.n - 1, aCelda(g, z1))
  for (let j = j0; j <= j1; j++) {
    const z = aMundo(g, j)
    for (let i = i0; i <= i1; i++) fn(i, j, aMundo(g, i), z)
  }
}

/** Distancia al cuadrado de un punto al segmento a→b. */
function distSegSq(px: number, pz: number, a: Punto, b: Punto) {
  const dx = b[0] - a[0]
  const dz = b[1] - a[1]
  const largo = dx * dx + dz * dz
  let t = largo === 0 ? 0 : ((px - a[0]) * dx + (pz - a[1]) * dz) / largo
  t = t < 0 ? 0 : t > 1 ? 1 : t
  const cx = a[0] + t * dx - px
  const cz = a[1] + t * dz - pz
  return cx * cx + cz * cz
}

/** Calle recta de cualquier ángulo, con las puntas redondeadas. */
export function pintarSegmento(
  g: Rejilla,
  a: Punto,
  b: Punto,
  ancho: number,
  v = 1,
) {
  const r = ancho / 2
  const rr = r * r
  porCaja(
    g,
    Math.min(a[0], b[0]) - r,
    Math.min(a[1], b[1]) - r,
    Math.max(a[0], b[0]) + r,
    Math.max(a[1], b[1]) + r,
    (i, j, x, z) => {
      if (distSegSq(x, z, a, b) <= rr) g.data[j * g.n + i] = v
    },
  )
}

/**
 * Calle CURVA. Se pinta por distancia al centro, así que es un arco de
 * verdad: no un abanico de cajas rotadas con sus juntas y su escalonado.
 *
 * Ángulos en radianes, medidos como `atan2(z, x)`: 0 es hacia el este (+x) y
 * crece hacia el sur (+z), que es como se ve el mapa desde arriba.
 *
 * `margen` alarga el arco unos metros por cada punta. No es cosmético: la
 * punta de un arco es un corte RADIAL, así que un arco que termina justo en
 * la orilla de la calle con la que enlaza deja una cuña sólida y el enlace
 * queda como una garganta de metro y medio. Con margen, el arco se mete en la
 * otra calle y el cruce abre completo.
 */
export function pintarArco(
  g: Rejilla,
  c: Punto,
  radio: number,
  a0: number,
  a1: number,
  ancho: number,
  v = 1,
  margen = 6,
) {
  const r = ancho / 2
  const rInt = radio - r
  const rExt = radio + r
  const da = margen / radio
  const desde = Math.min(a0, a1) - da
  const hasta = Math.max(a0, a1) + da
  porCaja(
    g,
    c[0] - rExt,
    c[1] - rExt,
    c[0] + rExt,
    c[1] + rExt,
    (i, j, x, z) => {
      const dx = x - c[0]
      const dz = z - c[1]
      const d = Math.hypot(dx, dz)
      if (d < rInt || d > rExt) return
      // Normalizado al rango [desde, desde + 2π): así funciona igual si el
      // arco cruza el eje de los 0 radianes.
      let a = Math.atan2(dz, dx)
      const vueltas = Math.floor((a - desde) / (Math.PI * 2))
      a -= vueltas * Math.PI * 2
      if (a > hasta) return
      g.data[j * g.n + i] = v
    },
  )
}

/** Disco lleno (la isla de la glorieta se pinta al revés: se deja sin pintar). */
export function pintarDisco(g: Rejilla, c: Punto, radio: number, v = 1) {
  const rr = radio * radio
  porCaja(g, c[0] - radio, c[1] - radio, c[0] + radio, c[1] + radio, (i, j, x, z) => {
    const dx = x - c[0]
    const dz = z - c[1]
    if (dx * dx + dz * dz <= rr) g.data[j * g.n + i] = v
  })
}

/** Anillo (la calzada de la glorieta: se rodea la isla, como debe ser). */
export function pintarAnillo(
  g: Rejilla,
  c: Punto,
  rInt: number,
  rExt: number,
  v = 1,
) {
  const a = rInt * rInt
  const b = rExt * rExt
  porCaja(g, c[0] - rExt, c[1] - rExt, c[0] + rExt, c[1] + rExt, (i, j, x, z) => {
    const dx = x - c[0]
    const dz = z - c[1]
    const d = dx * dx + dz * dz
    if (d >= a && d <= b) g.data[j * g.n + i] = v
  })
}

/** Rectángulo, con giro opcional sobre Y (bahías, predios, plazoletas). */
export function pintarRect(
  g: Rejilla,
  c: Punto,
  sx: number,
  sz: number,
  rotY = 0,
  v = 1,
) {
  const cos = Math.cos(-rotY)
  const sin = Math.sin(-rotY)
  const alcance = Math.hypot(sx, sz) / 2
  porCaja(g, c[0] - alcance, c[1] - alcance, c[0] + alcance, c[1] + alcance, (i, j, x, z) => {
    const dx = x - c[0]
    const dz = z - c[1]
    // Al marco local del rectángulo: rotY gira sobre Y, que en el plano XZ
    // es un giro de −rotY.
    const lx = dx * cos - dz * sin
    const lz = dx * sin + dz * cos
    if (Math.abs(lx) <= sx / 2 && Math.abs(lz) <= sz / 2) g.data[j * g.n + i] = v
  })
}

/**
 * Distancia (en metros) de cada celda a la fuente más cercana, por chamfer de
 * dos pasadas con pesos 1 y √2. Es una aproximación de la euclidiana con
 * error < 4 %, y cuesta O(celdas) — la exacta no vale lo que cuesta aquí.
 *
 * De esta sola primitiva salen tres cosas: las banquetas (dilatar el sólido),
 * la erosión por ancho de cuerpo (¿cabe la pipa?) y la prueba de que no hay
 * campo abierto por donde cortar.
 */
export function distanciaA(
  fuente: Uint8Array,
  n: number,
  celda: number,
): Float32Array {
  const INF = 1e9
  const d = new Float32Array(n * n)
  for (let k = 0; k < d.length; k++) d[k] = fuente[k] ? 0 : INF
  const d1 = celda
  const d2 = celda * Math.SQRT2

  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const k = j * n + i
      let m = d[k]
      if (m === 0) continue
      if (j > 0) {
        if (i > 0) m = Math.min(m, d[k - n - 1] + d2)
        m = Math.min(m, d[k - n] + d1)
        if (i < n - 1) m = Math.min(m, d[k - n + 1] + d2)
      }
      if (i > 0) m = Math.min(m, d[k - 1] + d1)
      d[k] = m
    }
  }
  for (let j = n - 1; j >= 0; j--) {
    for (let i = n - 1; i >= 0; i--) {
      const k = j * n + i
      let m = d[k]
      if (m === 0) continue
      if (j < n - 1) {
        if (i < n - 1) m = Math.min(m, d[k + n + 1] + d2)
        m = Math.min(m, d[k + n] + d1)
        if (i > 0) m = Math.min(m, d[k + n - 1] + d2)
      }
      if (i < n - 1) m = Math.min(m, d[k + 1] + d1)
      d[k] = m
    }
  }
  return d
}

/** Inundación por 4-vecindad sobre las celdas pasables. */
export function floodFill(
  pasable: Uint8Array,
  n: number,
  semillas: number[],
): Uint8Array {
  const visto = new Uint8Array(n * n)
  const cola = new Int32Array(n * n)
  let cabeza = 0
  let cola_ = 0
  for (const s of semillas) {
    if (s < 0 || s >= visto.length || !pasable[s] || visto[s]) continue
    visto[s] = 1
    cola[cola_++] = s
  }
  const empujar = (k: number) => {
    if (!pasable[k] || visto[k]) return
    visto[k] = 1
    cola[cola_++] = k
  }
  while (cabeza < cola_) {
    const k = cola[cabeza++]
    const i = k % n
    const j = (k - i) / n
    if (i > 0) empujar(k - 1)
    if (i < n - 1) empujar(k + 1)
    if (j > 0) empujar(k - n)
    if (j < n - 1) empujar(k + n)
  }
  return visto
}

/**
 * Funde las celdas etiquetadas en rectángulos, greedy y determinista: crece a
 * lo ancho, luego a lo alto mientras la franja entera siga siendo de la misma
 * etiqueta. 0 = vacío.
 *
 * La etiqueta es lo que mantiene coherente el volumen: todas las celdas de un
 * mismo lote comparten etiqueta y por lo tanto altura, así que el borde
 * escalonado de una curva no sale serrucho — sale un edificio cuya planta
 * sigue la curva, que es lo que se quiere.
 */
export function fusionarRects(
  etiquetas: Uint8Array | Int32Array,
  n: number,
  maxCeldas: number,
): RectCeldas[] {
  const usado = new Uint8Array(n * n)
  const rects: RectCeldas[] = []
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const k = j * n + i
      const e = etiquetas[k]
      if (!e || usado[k]) continue
      let w = 1
      while (
        w < maxCeldas &&
        i + w < n &&
        etiquetas[k + w] === e &&
        !usado[k + w]
      )
        w++
      let h = 1
      crecer: while (h < maxCeldas && j + h < n) {
        const base = (j + h) * n + i
        for (let d = 0; d < w; d++) {
          if (etiquetas[base + d] !== e || usado[base + d]) break crecer
        }
        h++
      }
      for (let b = 0; b < h; b++) {
        const base = (j + b) * n + i
        for (let d = 0; d < w; d++) usado[base + d] = 1
      }
      rects.push({ i, j, w, h, etiqueta: e })
    }
  }
  return rects
}

/**
 * Muestrea una máscara fina en celdas `factor` veces más grandes. Se usa para
 * las banquetas: son 15 cm de altura, no sellan nada, y a resolución fina el
 * borde de una curva cuesta cientos de cajas que nadie va a distinguir.
 */
export function engrosar(
  mask: Uint8Array,
  n: number,
  factor: number,
  minimo: number,
): { mask: Uint8Array; n: number } {
  const m = Math.ceil(n / factor)
  const out = new Uint8Array(m * m)
  for (let j = 0; j < n; j++) {
    const jj = (j / factor) | 0
    for (let i = 0; i < n; i++) {
      if (mask[j * n + i]) out[jj * m + ((i / factor) | 0)]++
    }
  }
  for (let k = 0; k < out.length; k++) out[k] = out[k] >= minimo ? 1 : 0
  return { mask: out, n: m }
}
