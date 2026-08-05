import { describe, expect, it } from 'vitest'
import { buildings, esLibre, locales } from './layout'
import { construirFachadas } from './fachadas'
import { Malla, dado, tinte } from './malla'
import { construirEfimero } from './efimerosGeom'

/*
 * EL PRESUPUESTO DEL PASO 2, COMO TEST.
 *
 * La sección 3 del documento pone el tope en 120,000 triángulos visibles y
 * menos de 100 draw calls, y avisa de lo que de verdad pasa en esta fase: el
 * rendimiento se degrada poco a poco y cuando se nota ya no se sabe qué lo
 * causó. Medirlo aquí es lo que convierte esa advertencia en algo que falla
 * solo, en `npm test`, el día que alguien le agregue una cornisa a cada casa.
 */

describe('la colonia cabe en el presupuesto', () => {
  const { stats } = construirFachadas()

  it('la colonia entera va en UN draw call', () => {
    // Es lo que hace viable el detalle: 1059 lotes con fachada propia serían
    // 1059 draw calls, y el tope son 100. La prueba real es que
    // `construirFachadas` devuelva UNA malla, no una lista.
    const { malla } = construirFachadas()
    expect(malla.geometria().getAttribute('position')).toBeTruthy()
  })

  it('los triángulos de la colonia dejan sitio para todo lo demás', () => {
    // La mitad del presupuesto es un tope generoso: encima van la pipa, el
    // jugador, las banquetas, los efímeros y todo lo que traigan los pasos 3
    // a 7 (props, hitos, personaje, la pipa detallada).
    expect(stats.triangulos).toBeLessThan(60_000)
  })

  it('las medianeras se quedan lisas', () => {
    // Solo las caras que dan a la calle llevan fachada. Si esto se rompiera,
    // los triángulos se multiplicarían por cerca de tres sin que se viera
    // nada nuevo: nadie ve la pared que da al lote vecino.
    const caras = buildings.length * 4
    expect(stats.frentesALaCalle).toBeLessThan(caras * 0.6)
    expect(stats.frentesALaCalle).toBeGreaterThan(caras * 0.15)
  })

  it('la azotea de la colonia tiene tinacos de verdad', () => {
    // Es el objeto que cuenta de qué va el juego. Con cuatro contados, no.
    expect(stats.tinacos).toBeGreaterThan(80)
  })

  it('los seis locales están vestidos', () => {
    expect(stats.locales).toBe(locales.length)
  })

  it('los accesos peatonales están marcados', () => {
    // Tres callejones de a pie y tres angosturas, con postes en sus dos
    // bocas: si alguien agrega un callejón sin salida y no lo marca, esto no
    // lo detecta, pero sí detecta que se haya dejado de marcar todo.
    expect(stats.bolardos).toBeGreaterThan(10)
  })
})

describe('la geometría sale bien formada', () => {
  it('cada cara mira hacia afuera', () => {
    /*
     * Una cara con el orden de vértices al revés queda de espaldas a la luz y
     * se ve NEGRA — el error más caro de depurar a ojo, porque parece un
     * problema de iluminación y es de winding. Se comprueba sobre una caja
     * suelta: sus normales tienen que apuntar en el sentido de cada cara.
     */
    const m = new Malla()
    m.caja([0, 0, 0], [2, 2, 2], '#ffffff')
    const g = m.geometria()
    const pos = g.getAttribute('position')
    const nor = g.getAttribute('normal')
    for (let i = 0; i < pos.count; i++) {
      // Para una caja centrada en el origen, la normal de cada vértice tiene
      // que apuntar hacia el mismo lado que el propio vértice.
      const d =
        pos.getX(i) * nor.getX(i) + pos.getY(i) * nor.getY(i) + pos.getZ(i) * nor.getZ(i)
      expect(d).toBeGreaterThan(0)
    }
  })

  it('un efímero trae sus señas de que ahí hace falta agua', () => {
    // La casa saca tinaco y tambos; la obra, cimbra y varilla. Las dos tienen
    // que traer bastante más geometría que la cajita que eran antes.
    const casa = construirEfimero('casa', 1)
    const obra = construirEfimero('obra', 1)
    expect(casa.getAttribute('position').count).toBeGreaterThan(200)
    expect(obra.getAttribute('position').count).toBeGreaterThan(200)
  })

  it('dos predios seguidos no salen iguales', () => {
    // El corazón de la parte A: que dos casas del mismo color no se vean la
    // misma casa. Si el dado dejara de variar, esto se cae.
    const distintos = new Set<string>()
    for (let i = 0; i < 40; i++) distintos.add(`${dado(i, 4).toFixed(3)}|${dado(i, 2).toFixed(3)}`)
    expect(distintos.size).toBeGreaterThan(35)
  })

  it('el tinte respeta el color y solo mueve la luz', () => {
    expect(tinte('#808080', 1)).toBe('#808080')
    expect(tinte('#808080', 0.5)).not.toBe('#808080')
  })
})

describe('el mundo sigue siendo el mismo', () => {
  it('las fachadas no mueven un solo collider', () => {
    // El Paso 2 es puramente visual: la física sigue leyendo `buildings`, que
    // no se toca. Si esto cambiara, la colonia se vería distinta a como se
    // siente, que es el peor error posible en un juego de manejar.
    const antes = buildings.length
    construirFachadas()
    expect(buildings.length).toBe(antes)
  })

  it('una cara a la calle de verdad da a la calle', () => {
    // El detector de frentes es lo que decide qué se viste. Se comprueba con
    // la puerta de cada local, que por construcción está sobre el pavimento.
    for (const l of locales) {
      expect(esLibre(l.door[0], l.door[2]), l.id).toBe(true)
    }
  })
})
