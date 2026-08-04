import { describe, expect, it } from 'vitest'
import {
  CALLEJONES,
  DOMICILIOS,
  EPHEMERAL_SPOTS,
  MAP_SIZE,
  ANILLO,
  PLAYER_SPAWN,
  PLAZAS,
  WATER_SOURCE,
  esLibre,
  holgura,
  layoutStats,
  locales,
  mapaOcupacion,
  topes,
} from './layout'
import { floodFill } from './raster'
import { PIPA_SPAWN } from '../vehicle/pipaParts'

/*
 * Las invariantes del trazo. `layout.ts` es dato puro (no importa three ni
 * React), así que la colonia entera se puede probar como una función.
 *
 * Lo que se prueba aquí no son detalles de implementación: son las tres
 * promesas del diseño — que no hay por dónde cortar a campo traviesa, que
 * todo lo que hay que alcanzar se alcanza, y que los callejones peatonales
 * son de verdad peatonales. Si alguna se rompe al mover una calle, el trazo
 * está mal, no el test.
 *
 * Con `MAPA=1 npx vitest run layout` imprime el mapa en ASCII: es la
 * herramienta para ajustar curvas sin abrir el navegador.
 */

const { n, celda, distSolido, calle } = mapaOcupacion
const aCelda = mapaOcupacion.aCelda

/** Radio del cuerpo del jugador (CapsuleCollider 0.55, 0.35). */
const RADIO_PIE = 0.45
/** Medio ancho de la pipa (chassis 2.4) más un dedo de holgura. */
const RADIO_PIPA = 1.35

function inundar(radio: number) {
  const pasable = new Uint8Array(n * n)
  for (let k = 0; k < pasable.length; k++) {
    pasable[k] = calle[k] && distSolido[k] >= radio ? 1 : 0
  }
  // Semillas: el anillo perimetral entero, que es la calle garantizada.
  const semillas: number[] = []
  for (let i = 0; i < n; i++) {
    for (const z of [-ANILLO, ANILLO]) {
      const j = aCelda(z)
      semillas.push(j * n + i, i * n + aCelda(z))
    }
  }
  return floodFill(pasable, n, semillas)
}

const aPie = inundar(RADIO_PIE)
const enPipa = inundar(RADIO_PIPA)

/** ¿Hay una celda alcanzada a menos de `radio` metros de (x, z)? */
function alcanzaA(flood: Uint8Array, x: number, z: number, radio: number) {
  const r = Math.ceil(radio / celda)
  const ci = aCelda(x)
  const cj = aCelda(z)
  for (let j = Math.max(0, cj - r); j <= Math.min(n - 1, cj + r); j++) {
    for (let i = Math.max(0, ci - r); i <= Math.min(n - 1, ci + r); i++) {
      if (!flood[j * n + i]) continue
      const dx = (i - ci) * celda
      const dz = (j - cj) * celda
      if (Math.hypot(dx, dz) <= radio) return true
    }
  }
  return false
}

/**
 * Puntos del tramo central del callejón. Las bocas quedan fuera a propósito:
 * un callejón se dibuja entrando un poco a la calle para que amarre, así que
 * cerca de la boca la holgura es la de la calle, no la del callejón.
 */
function ejeCallejon(c: (typeof CALLEJONES)[number], pasos = 10) {
  const pts: [number, number][] = []
  for (let k = 0; k <= pasos; k++) {
    const t = 0.25 + (0.5 * k) / pasos
    pts.push([c.a[0] + (c.b[0] - c.a[0]) * t, c.a[1] + (c.b[1] - c.a[1]) * t])
  }
  return pts
}

describe('trazo de la colonia', () => {
  it('no deja campo abierto por donde cortar', () => {
    /*
     * Toda calle está a menos de 8.5 m de un muro, salvo dentro de la
     * glorieta: es la traducción literal de «las calles tienen que servir de
     * algo». Un llano de 17 m de diámetro ya no cabe en ningún lado.
     *
     * El límite no baja de ahí porque un CRUCE de dos calles anchas mide eso
     * por construcción: el centro de un cruce de 11×11 con las puntas
     * redondeadas queda a ~8 m de la esquina sólida más cercana.
     */
    const abiertas: [number, number, number][] = []
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const k = j * n + i
        if (!calle[k] || distSolido[k] <= 8.5) continue
        const x = mapaOcupacion.aMundo(i)
        const z = mapaOcupacion.aMundo(j)
        const enPlaza = PLAZAS.some(
          (p) => Math.hypot(x - p.c[0], z - p.c[1]) <= p.r,
        )
        if (!enPlaza) abiertas.push([x, z, distSolido[k]])
      }
    }
    expect(abiertas.slice(0, 8)).toEqual([])
  })

  it('no planta ningún local a media calle', () => {
    // Los locales se dibujan aparte de los lotes, así que un mal frente no se
    // ve como hueco en la manzana: se ve como una caja de color estorbando en
    // el pavimento.
    for (const l of locales) {
      let invade = 0
      for (let dx = -l.size[0] / 2; dx <= l.size[0] / 2; dx += 0.5) {
        for (let dz = -l.size[2] / 2; dz <= l.size[2] / 2; dz += 0.5) {
          if (esLibre(l.pos[0] + dx, l.pos[2] + dz)) invade++
        }
      }
      expect(invade, `${l.id} invade la calle`).toBe(0)
    }
  })

  it('no deja ningún tope enterrado en una manzana', () => {
    // Un tope mal puesto no se ve mal: simplemente deja de existir, y el
    // camino por el que se supone que hay que ir de despacio queda libre.
    for (const t of topes) {
      expect(
        holgura(t.pos[0], t.pos[2]),
        `tope en (${t.pos[0]}, ${t.pos[2]})`,
      ).toBeGreaterThan(RADIO_PIPA)
    }
  })

  it('conecta a pie todo lo que hay que tocar a pie', () => {
    for (const l of locales) {
      expect(
        alcanzaA(aPie, l.door[0], l.door[2], 1.5),
        `puerta de ${l.id} en ${l.door}`,
      ).toBe(true)
    }
    for (const s of EPHEMERAL_SPOTS) {
      expect(alcanzaA(aPie, s.pos[0], s.pos[2], 6), `bahía ${s.id}`).toBe(true)
    }
    expect(alcanzaA(aPie, PLAYER_SPAWN[0], PLAYER_SPAWN[2], 0.5)).toBe(true)
  })

  it('conecta en pipa todo lo que hay que alcanzar manejando', () => {
    // Las entregas y la carga se miden de la PIPA al punto (radio 12 m en
    // tuning): con 8 m de margen queda holgado incluso mal estacionado.
    for (const [id, d] of Object.entries(DOMICILIOS)) {
      expect(alcanzaA(enPipa, d[0], d[2], 8), `domicilio de ${id}`).toBe(true)
    }
    for (const s of EPHEMERAL_SPOTS) {
      expect(alcanzaA(enPipa, s.pos[0], s.pos[2], 8), `bahía ${s.id}`).toBe(true)
    }
    expect(
      alcanzaA(enPipa, WATER_SOURCE.pos[0], WATER_SOURCE.pos[2], 8),
      'toma de agua',
    ).toBe(true)
    expect(alcanzaA(enPipa, PIPA_SPAWN[0], PIPA_SPAWN[2], 0.5)).toBe(true)
  })

  it('los callejones peatonales no dejan pasar la pipa', () => {
    for (const c of CALLEJONES) {
      const eje = ejeCallejon(c)
      const anchoMin = Math.min(...eje.map(([x, z]) => holgura(x, z)))
      if (c.soloAPie) {
        // Cabe el jugador (0.35 de radio) y NO cabe la pipa (1.2).
        expect(anchoMin, `${c.id} para el jugador`).toBeGreaterThan(RADIO_PIE)
        expect(anchoMin, `${c.id} para la pipa`).toBeLessThan(1.2)
        for (const [x, z] of eje) {
          expect(alcanzaA(aPie, x, z, 0.5), `${c.id} a pie`).toBe(true)
          expect(alcanzaA(enPipa, x, z, 0.5), `${c.id} en pipa`).toBe(false)
        }
      } else {
        for (const [x, z] of eje) {
          expect(alcanzaA(enPipa, x, z, 0.5), `${c.id} en pipa`).toBe(true)
        }
      }
    }
  })

  it('no deja calle a la que no se pueda llegar', () => {
    // Un patio que quedó abierto por dentro, o un callejón que no llegó a
    // conectar, aparece aquí como pavimento suelto: se ve bien desde arriba y
    // no se puede pisar.
    let sueltas = 0
    for (let k = 0; k < calle.length; k++) {
      if (calle[k] && distSolido[k] >= RADIO_PIE && !aPie[k]) sueltas++
    }
    expect(sueltas).toBe(0)
  })

  it('deja limpio el anillo del rescate', () => {
    // Rescue.tsx suelta al jugador sobre el anillo asumiendo que es calle en
    // todo su recorrido. Un lote encima lo dejaría dentro de una barda.
    for (let t = -ANILLO; t <= ANILLO; t += 2) {
      for (const p of [
        [t, -ANILLO],
        [t, ANILLO],
        [-ANILLO, t],
        [ANILLO, t],
      ] as [number, number][]) {
        expect(esLibre(p[0], p[1]), `anillo en ${p}`).toBe(true)
        expect(holgura(p[0], p[1]), `holgura del anillo en ${p}`).toBeGreaterThanOrEqual(3)
      }
    }
  })

  it('amanece sobre la calle', () => {
    expect(holgura(PLAYER_SPAWN[0], PLAYER_SPAWN[2])).toBeGreaterThanOrEqual(1)
    expect(holgura(PIPA_SPAWN[0], PIPA_SPAWN[2])).toBeGreaterThanOrEqual(2)
    // Lejos como para caminar de una a otra, cerca como para verla.
    const d = Math.hypot(
      PIPA_SPAWN[0] - PLAYER_SPAWN[0],
      PIPA_SPAWN[2] - PLAYER_SPAWN[2],
    )
    expect(d).toBeGreaterThan(8)
    expect(d).toBeLessThan(30)
  })

  it('respeta el presupuesto', () => {
    /*
     * Todo el mundo estático son cuboides primitivos en UN cuerpo fijo y se
     * dibuja con dos InstancedMesh, así que el presupuesto de draw calls de la
     * sección 2 ni se entera. Lo que sí se acumula es el conteo de cuboides:
     * seguir el borde de una curva a medio metro cuesta cajas. Este tope está
     * para que no crezca sin que nadie se dé cuenta.
     */
    expect(layoutStats.colliders).toBeLessThanOrEqual(1600)
    // ~12 tris por caja: hay que quedar muy por debajo de los 120 k del doc.
    expect(layoutStats.buildings * 12).toBeLessThan(40_000)
    // Si la colonia es casi la mitad calle, dejó de ser una colonia.
    expect(layoutStats.fraccionCalle).toBeLessThan(0.48)
    expect(layoutStats.fraccionCalle).toBeGreaterThan(0.15)
  })

  it('imprime el mapa con MAPA=1', () => {
    // Sin `@types/node` en la app: se lee del global con cuidado.
    const env = (globalThis as { process?: { env?: Record<string, string | undefined> } })
      .process?.env
    if (!env?.MAPA) return
    const paso = 2 // metros por carácter
    const marcas = new Map<string, string>()
    const marca = (x: number, z: number, ch: string) =>
      marcas.set(
        `${Math.round((x + MAP_SIZE / 2) / paso)},${Math.round((z + MAP_SIZE / 2) / paso)}`,
        ch,
      )
    locales.forEach((l, i) => marca(l.door[0], l.door[2], String(i + 1)))
    Object.values(DOMICILIOS).forEach((d) => marca(d[0], d[2], 'D'))
    EPHEMERAL_SPOTS.forEach((s) => marca(s.pos[0], s.pos[2], 'e'))
    marca(WATER_SOURCE.pos[0], WATER_SOURCE.pos[2], 'W')
    marca(PLAYER_SPAWN[0], PLAYER_SPAWN[2], 'P')
    marca(PIPA_SPAWN[0], PIPA_SPAWN[2], 'T')

    const filas: string[] = []
    for (let z = -MAP_SIZE / 2; z < MAP_SIZE / 2; z += paso) {
      let fila = ''
      for (let x = -MAP_SIZE / 2; x < MAP_SIZE / 2; x += paso) {
        const key = `${Math.round((x + MAP_SIZE / 2) / paso)},${Math.round((z + MAP_SIZE / 2) / paso)}`
        const m = marcas.get(key)
        if (m) {
          fila += m
          continue
        }
        if (!esLibre(x, z)) fila += '#'
        else if (holgura(x, z) < 1.35) fila += ':' // solo a pie
        else fila += ' '
      }
      filas.push(fila)
    }
    console.log(
      `\n${filas.join('\n')}\n\n` +
        `lotes ${layoutStats.lotes}  cajas ${layoutStats.buildings}  ` +
        `banquetas ${layoutStats.sidewalks}  colliders ${layoutStats.colliders}  ` +
        `calle ${(layoutStats.fraccionCalle * 100).toFixed(1)}%`,
    )
  })
})
