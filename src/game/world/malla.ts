import { BufferAttribute, BufferGeometry, Color } from 'three'

/*
 * UN CONSTRUCTOR DE MALLAS, para geometría procedural fusionada.
 *
 * La razón de que exista es el presupuesto de draw calls. La colonia tiene
 * 1059 lotes; darle a cada uno su malla serían 1059 draw calls contra un tope
 * de 100. Instanciar resuelve el conteo pero amarra a que todas las copias
 * sean idénticas salvo el color, y eso es justo lo que el Paso 2 viene a
 * romper: se pide que dos casas del mismo color no se vean iguales.
 *
 * La salida es una sola BufferGeometry con COLOR POR VÉRTICE, que es lo que
 * la sección 1 del documento pide para el grueso de la colonia: cero memoria
 * de textura, cero draw calls extra, y toda la variación que quepa en los
 * vértices —la banda de cal, la mancha de humedad, el marco de la ventana—
 * sin una sola imagen.
 *
 * Los colores entran como hex y se guardan en LINEAL: three espera eso cuando
 * la salida es sRGB, y `Color` ya hace la conversión al construirse. Meter el
 * hex crudo daría una colonia lavada.
 */

/** Un punto en el espacio del mundo. */
export type P3 = readonly [number, number, number]

const _c = new Color()

export class Malla {
  private pos: number[] = []
  private nor: number[] = []
  private col: number[] = []
  private idx: number[] = []

  get triangulos() {
    return this.idx.length / 3
  }
  get vertices() {
    return this.pos.length / 3
  }

  /**
   * Un cuadrilátero, en orden antihorario visto desde fuera. La normal se
   * calcula de las tres primeras esquinas, así que el orden importa: al revés
   * la cara queda de espaldas a la luz y se ve negra.
   *
   * `colores` acepta uno (cara plana) o cuatro (uno por esquina, que es como
   * se hacen los degradados de humedad sin gastar un solo triángulo más).
   */
  quad(a: P3, b: P3, c: P3, d: P3, colores: string | [string, string, string, string]) {
    const base = this.vertices

    // Normal por producto cruz de (b-a) × (c-a). Plana: cada quad trae la
    // suya, que es lo que le da a Lambert el corte duro entre caras.
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2]
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2]
    let nx = uy * vz - uz * vy
    let ny = uz * vx - ux * vz
    let nz = ux * vy - uy * vx
    const len = Math.hypot(nx, ny, nz) || 1
    nx /= len; ny /= len; nz /= len

    const esquinas = [a, b, c, d]
    const cols = typeof colores === 'string' ? [colores, colores, colores, colores] : colores
    for (let i = 0; i < 4; i++) {
      this.pos.push(esquinas[i][0], esquinas[i][1], esquinas[i][2])
      this.nor.push(nx, ny, nz)
      _c.set(cols[i])
      this.col.push(_c.r, _c.g, _c.b)
    }
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3)
  }

  /**
   * Una caja centrada en `pos`. Sin la cara de abajo: nunca se ve y es un
   * sexto de los triángulos de toda la colonia.
   */
  caja(pos: P3, size: P3, color: string, conTapa = true) {
    const [x, y, z] = pos
    const hx = size[0] / 2, hy = size[1] / 2, hz = size[2] / 2
    const x0 = x - hx, x1 = x + hx
    const y0 = y - hy, y1 = y + hy
    const z0 = z - hz, z1 = z + hz

    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], color) // +Z
    this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], color) // -Z
    this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], color) // +X
    this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], color) // -X
    if (conTapa) this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], color)
  }

  /** Un triángulo suelto. Lo pide la tapa de los cilindros, que en abanico es
   *  la mitad de triángulos que resolverla con quads. */
  tri(a: P3, b: P3, c: P3, color: string) {
    const base = this.vertices
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2]
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2]
    let nx = uy * vz - uz * vy
    let ny = uz * vx - ux * vz
    let nz = ux * vy - uy * vx
    const len = Math.hypot(nx, ny, nz) || 1
    nx /= len; ny /= len; nz /= len
    _c.set(color)
    for (const p of [a, b, c]) {
      this.pos.push(p[0], p[1], p[2])
      this.nor.push(nx, ny, nz)
      this.col.push(_c.r, _c.g, _c.b)
    }
    this.idx.push(base, base + 1, base + 2)
  }

  /**
   * Un prisma vertical de `segs` lados: tinacos, tambos y cubetas. Pocos
   * lados a propósito — a 8 se lee redondo y cuesta la tercera parte que a 24.
   * Sin tapa de abajo: se apoya en algo y nunca se ve.
   */
  cilindro(pos: P3, radio: number, alto: number, segs: number, color: string, tapaColor = color) {
    const [x, y, z] = pos
    const y0 = y - alto / 2
    const y1 = y + alto / 2
    const centro: P3 = [x, y1, z]
    for (let i = 0; i < segs; i++) {
      const a0 = (i / segs) * Math.PI * 2
      const a1 = ((i + 1) / segs) * Math.PI * 2
      const x0 = x + Math.cos(a0) * radio, z0 = z + Math.sin(a0) * radio
      const x1 = x + Math.cos(a1) * radio, z1 = z + Math.sin(a1) * radio
      this.quad([x0, y0, z0], [x1, y0, z1], [x1, y1, z1], [x0, y1, z0], color)
      this.tri(centro, [x0, y1, z0], [x1, y1, z1], tapaColor)
    }
  }

  /** La geometría lista para three. Se llama una vez. */
  geometria(): BufferGeometry {
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(new Float32Array(this.pos), 3))
    g.setAttribute('normal', new BufferAttribute(new Float32Array(this.nor), 3))
    g.setAttribute('color', new BufferAttribute(new Float32Array(this.col), 3))
    g.setIndex(this.idx)
    g.computeBoundingSphere()
    return g
  }
}

/** PRNG determinista (mulberry32), el mismo de `layout.ts`: misma semilla,
 *  misma colonia en cada carga. */
export function dado(a: number, b: number) {
  let s = (a * 73856093) ^ (b * 19349663)
  s = (s + 0x6d2b79f5) | 0
  let t = Math.imul(s ^ (s >>> 15), 1 | s)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

/** Aclara u oscurece un hex. Para la variación fina: dos casas del mismo
 *  color de la tira no tienen por qué ser el mismo color exacto. */
export function tinte(hex: string, factor: number): string {
  _c.set(hex)
  // En espacio lineal, escalar es exactamente «más o menos luz sobre la misma
  // pintura», que es la variación que se busca.
  _c.multiplyScalar(factor)
  return '#' + _c.getHexString()
}

/** Mezcla dos hex. */
export function mezclar(a: string, b: string, t: number): string {
  const ca = new Color(a)
  ca.lerp(new Color(b), t)
  return '#' + ca.getHexString()
}
