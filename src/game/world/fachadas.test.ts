import { describe, expect, it } from 'vitest'
import { buildingLote, buildings, esLibre, locales } from './layout'
import { CUADRANTES, construirFachadas } from './fachadas'
import { Malla, dado, tinte } from './malla'
import { caja, fusionarPanos, panel, type Pano } from './panos'
import { construirEfimero } from './efimerosGeom'

/*
 * EL PRESUPUESTO Y LAS TRES LECCIONES DEL PASO 2.
 *
 * La primera versión de este paso se entregó y falló en el aparato: los
 * edificios vibraban, las fachadas se veían a rayas y los locales no se
 * distinguían de una casa. Los tres fallos eran comprobables sin un teléfono
 * y ninguno tenía test. Estos son esos tests.
 */

const { stats } = construirFachadas()

describe('la colonia cabe en el presupuesto', () => {
  it('sale en cuatro draw calls, uno por cuadrante', () => {
    const { mallas } = construirFachadas()
    expect(mallas).toHaveLength(CUADRANTES)
    // Ninguno puede quedar vacío: un cuadrante sin geometría querría decir que
    // el reparto está mal y toda la colonia cayó en uno solo.
    for (const m of mallas) expect(m.triangulos).toBeGreaterThan(1000)
  })

  it('los triángulos dejan sitio para todo lo demás', () => {
    // El tope del documento son 120,000 visibles. Encima de esto van la pipa,
    // el jugador, las banquetas, los efímeros y lo que traigan los pasos 3
    // a 7. Y son los del mundo ENTERO: el frustum descarta la mayoría.
    expect(stats.triangulos).toBeLessThan(85_000)
  })
})

describe('lección 1: nada coplanar', () => {
  /*
   * El parpadeo salía de dibujar el detalle 5 cm encima del muro. Ahora el
   * detalle ES el muro (rejilla de celdas) y lo que necesita relieve sale como
   * volumen. Estos tests fijan las dos mitades de esa regla.
   */

  it('la rejilla no deja dos celdas sobre el mismo sitio', () => {
    // Dos quads con el mismo centro y la misma normal es exactamente el patrón
    // que causó el bug. Se comprueba sobre la colonia real.
    const { mallas } = construirFachadas()
    for (const malla of mallas) {
      const g = malla.geometria()
      const pos = g.getAttribute('position')
      const nor = g.getAttribute('normal')
      const vistos = new Set<string>()
      let repetidos = 0
      // Una muestra: recorrer los 126,000 vértices por parejas sería lento y
      // no haría falta — un solapamiento sistemático aparece en cualquier tajo.
      for (let i = 0; i < pos.count; i += 4) {
        const k = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}|${nor.getX(i).toFixed(2)},${nor.getY(i).toFixed(2)},${nor.getZ(i).toFixed(2)}`
        if (vistos.has(k)) repetidos++
        vistos.add(k)
      }
      // Cero sería ideal, pero dos volúmenes distintos pueden compartir una
      // esquina legítimamente (una cornisa y su pretil). Lo que no puede haber
      // es un patrón sistemático.
      expect(repetidos / (pos.count / 4)).toBeLessThan(0.02)
    }
  })

  it('lo que lleva relieve se rehunde o sobresale, nunca queda al ras', () => {
    /*
     * La regla que sustituye al `RELIEVE` de 5 cm que causó el parpadeo: el
     * vidrio va 12 cm ADENTRO y la cornisa 10 cm AFUERA. Lo que no puede
     * existir es geometría en la franja de ±8 cm alrededor del plano del muro,
     * que es donde el buffer de profundidad no alcanza a separar dos caras.
     *
     * Se mide sobre un paño de plano conocido: cualquier vértice que caiga en
     * esa franja prohibida —y que no sea la pared misma— es el bug de vuelta.
     */
    const m = new Malla()
    const plano = 12
    const p: Pano = { dx: 0, dz: 1, plano, a: -4, b: 4, alto: 3.2 }
    // Un hueco rehundido y una cornisa saliente, con los MISMOS offsets que
    // usa `fachada`: el vidrio de −0.32 a −0.12 y la cornisa de −0.12 a +0.10.
    caja(m, p, -1, 1, 1, 2.2, -0.32, -0.12, '#000000')
    caja(m, p, -4, 4, 3, 3.2, -0.12, 0.1, '#ffffff')
    panel(m, p, -4, 4, 0, 3, '#888888')

    const pos = m.geometria().getAttribute('position')
    let enLaFranja = 0
    for (let i = 0; i < pos.count; i++) {
      const d = pos.getZ(i) - plano // distancia con signo al plano del muro
      if (Math.abs(d) > 0.001 && Math.abs(d) < 0.08) enLaFranja++
    }
    expect(enLaFranja).toBe(0)
  })
})

describe('lección 2: un predio, un color', () => {
  it('las cajas se agrupan por lote, no se pintan una por una', () => {
    // 1059 cajas colapsan a ~194 predios. Ahí muere el código de barras: antes
    // cada rectángulo del fusionador se pintaba como una casa aparte.
    expect(stats.predios).toBeGreaterThan(100)
    expect(stats.predios).toBeLessThan(buildings.length / 3)
  })

  it('todas las cajas tienen etiqueta de lote', () => {
    expect(buildingLote).toHaveLength(buildings.length)
    for (const e of buildingLote) expect(e).toBeGreaterThan(0)
  })

  it('las cajas de un lote comparten altura', () => {
    // Es lo que permite fusionar sus caras en un paño corrido sin escalones.
    const alturas = new Map<number, number>()
    for (let i = 0; i < buildings.length; i++) {
      const l = buildingLote[i]
      const h = buildings[i].size[1]
      const previa = alturas.get(l)
      if (previa === undefined) alturas.set(l, h)
      else expect(h).toBeCloseTo(previa, 5)
    }
  })

  it('los frentes son de casa, no de columna', () => {
    // La queja era «parecen columnas de 2 metros». Una casa de colonia tiene
    // entre 6 y 10 m de frente, y eso es lo que mide la mediana de los paños
    // que reciben fachada completa.
    expect(stats.frenteMediano).toBeGreaterThanOrEqual(6)
    expect(stats.fachadas).toBeGreaterThan(150)
  })

  it('fusionar une los paños que se tocan de punta', () => {
    // El caso exacto del layout: dos cajas vecinas del mismo lote, separadas
    // por la junta de TRASLAPE. Tienen que salir como un solo paño.
    const a: Pano = { dx: 0, dz: 1, plano: 10, a: 0, b: 4.06, alto: 3 }
    const b: Pano = { dx: 0, dz: 1, plano: 10, a: 3.94, b: 8, alto: 3 }
    const [uno, ...resto] = fusionarPanos([a, b])
    expect(resto).toHaveLength(0)
    expect(uno.a).toBeCloseTo(0)
    expect(uno.b).toBeCloseTo(8)
  })

  it('fusionar NO une paños de planos distintos', () => {
    // Los escalones de una manzana curva están en planos distintos y tienen
    // que quedarse separados, o la fachada atravesaría el aire.
    const a: Pano = { dx: 0, dz: 1, plano: 10, a: 0, b: 4, alto: 3 }
    const b: Pano = { dx: 0, dz: 1, plano: 10.5, a: 4, b: 8, alto: 3 }
    expect(fusionarPanos([a, b])).toHaveLength(2)
  })
})

describe('lección 3: un local se ve local', () => {
  it('los seis locales están vestidos', () => {
    expect(stats.locales).toBe(locales.length)
  })

  it('los locales sobresalen del perfil de una planta', () => {
    // Medio nivel por encima del vecino (2.8 m) para que el rótulo asome por
    // encima de su barda. Sin pasarse: los hitos arrancan en 12 m.
    for (const l of locales) {
      expect(l.size[1], l.id).toBeGreaterThan(4.5)
      expect(l.size[1], l.id).toBeLessThan(8)
    }
  })

  it('la puerta de cada local da a la calle', () => {
    for (const l of locales) {
      expect(esLibre(l.door[0], l.door[2]), l.id).toBe(true)
    }
  })
})

describe('la glorieta es una plaza', () => {
  it('tiene kiosco, guarnición, caminos y jardineras', () => {
    // Antes eran dos piezas: un cilindro y una caja. Ahora son decenas —
    // guarnición a franjas, cuatro caminos radiales, cuatro jardineras, dos
    // escalones, ocho columnas, barandal y techo.
    expect(stats.glorieta).toBeGreaterThan(50)
  })
})

describe('el resto del mundo sigue en pie', () => {
  it('la azotea de la colonia tiene tinacos, uno por predio', () => {
    // Antes se ponía uno por CAJA: una casa partida en cinco rectángulos salía
    // con cinco tinacos pegados.
    expect(stats.tinacos).toBeGreaterThan(50)
    expect(stats.tinacos).toBeLessThanOrEqual(stats.predios)
  })

  it('los accesos peatonales están marcados', () => {
    expect(stats.bolardos).toBeGreaterThan(10)
  })

  it('las fachadas no mueven un solo collider', () => {
    // El paso es visual: la física sigue leyendo `buildings`, que no se toca.
    const antes = buildings.length
    construirFachadas()
    expect(buildings.length).toBe(antes)
  })

  it('un efímero trae sus señas de que ahí hace falta agua', () => {
    const casa = construirEfimero('casa', 1)
    const obra = construirEfimero('obra', 1)
    expect(casa.getAttribute('position').count).toBeGreaterThan(200)
    expect(obra.getAttribute('position').count).toBeGreaterThan(200)
  })
})

describe('la geometría sale bien formada', () => {
  it('cada cara mira hacia afuera', () => {
    /*
     * Una cara con el orden de vértices al revés queda de espaldas a la luz y
     * se ve NEGRA — el error más caro de depurar a ojo, porque parece un
     * problema de iluminación y es de winding.
     */
    const m = new Malla()
    m.caja([0, 0, 0], [2, 2, 2], '#ffffff')
    const g = m.geometria()
    const pos = g.getAttribute('position')
    const nor = g.getAttribute('normal')
    for (let i = 0; i < pos.count; i++) {
      const d =
        pos.getX(i) * nor.getX(i) + pos.getY(i) * nor.getY(i) + pos.getZ(i) * nor.getZ(i)
      expect(d).toBeGreaterThan(0)
    }
  })

  it('el prisma cierra: cilindro, tronco y cono', () => {
    for (const [rAbajo, rArriba] of [[1, 1], [1, 0.5], [1, 0]]) {
      const m = new Malla()
      m.prisma([0, 0, 0], rAbajo, rArriba, 2, 8, '#ffffff')
      expect(m.triangulos).toBeGreaterThan(7)
    }
  })

  it('dos predios seguidos no salen iguales', () => {
    const distintos = new Set<string>()
    for (let i = 0; i < 40; i++) distintos.add(`${dado(i, 4).toFixed(3)}|${dado(i, 2).toFixed(3)}`)
    expect(distintos.size).toBeGreaterThan(35)
  })

  it('el tinte respeta el color y solo mueve la luz', () => {
    expect(tinte('#808080', 1)).toBe('#808080')
    expect(tinte('#808080', 0.5)).not.toBe('#808080')
  })
})
