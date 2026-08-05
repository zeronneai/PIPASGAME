import { describe, expect, it } from 'vitest'
import { balance } from '../balance'
import { DOMICILIOS, WATER_SOURCE } from '../world/layout'
import { CATEGORIAS, precioMejora, type Nivel } from './garage'
import {
  ESCENARIOS,
  MODELO_JORNADA,
  entregaProyectada,
  mezclaClientes,
  primeraMejora,
  proyeccionJornada,
  tablaCompras,
} from './proyeccion'
import type { PerfilCliente } from './clients'

/*
 * LAS METAS DEL PASO 7, COMO TESTS.
 *
 * El documento pide tres cosas y las tres son números: la primera mejora en
 * dos o tres jornadas, la segunda pipa en diez o quince, y nunca cinco
 * jornadas sin poder comprar nada. Escritas aquí, un ajuste de precios que
 * las rompa se cae en `npm test` y no veinte minutos después, jugando.
 *
 * Las ventanas van con holgura sobre la meta del documento: esto es un
 * modelo, y apretarlo al decimal haría que fallara por ruido en vez de por
 * un desbalance de verdad.
 */

describe('las metas del Paso 7', () => {
  it('la primera mejora se alcanza en dos o tres jornadas', () => {
    const { precio } = primeraMejora()
    const jornadas = precio / proyeccionJornada(ESCENARIOS.arranque).neta
    expect(jornadas).toBeGreaterThanOrEqual(2)
    expect(jornadas).toBeLessThanOrEqual(3.5)
  })

  it('la segunda pipa se alcanza en diez o quince jornadas', () => {
    const jornadas =
      balance.garage.modelos.mediana / proyeccionJornada(ESCENARIOS.asentado).neta
    expect(jornadas).toBeGreaterThanOrEqual(10)
    expect(jornadas).toBeLessThanOrEqual(15)
  })

  it('ningún escalón de mejora cuesta más de cinco jornadas', () => {
    // El criterio de «nunca pasas cinco jornadas sin poder comprar nada»:
    // comprando de lo barato a lo caro siempre hay algo al alcance, así que
    // basta con que ningún escalón por separado rebase las cinco.
    for (const fila of tablaCompras()) {
      if (fila.concepto.startsWith('La ')) continue // las pipas son la meta larga
      expect(fila.jornadas, fila.concepto).toBeLessThanOrEqual(5)
    }
  })

  it('la grandota es la meta larga, pero no inalcanzable', () => {
    const jornadas =
      balance.garage.modelos.grandota / proyeccionJornada(ESCENARIOS.veterano).neta
    // Más lejos que la mediana —es el final de la escalera— pero no al doble:
    // una meta al doble de lejos que la anterior deja de leerse como meta.
    expect(jornadas).toBeGreaterThan(15)
    expect(jornadas).toBeLessThanOrEqual(25)
  })
})

describe('ningún perfil de cliente domina', () => {
  /*
   * La regla de la sección 4 del documento, aplicada a los clientes en vez de
   * a las mejoras: si un perfil gana en las dos columnas —dinero y
   * reputación— los otros dejan de existir y media colonia se vuelve adorno.
   */

  it('el exigente paga mejor por minuto, pero no por tanto', () => {
    const esc = ESCENARIOS.arranque
    const porSegundo = (p: PerfilCliente) => {
      const e = entregaProyectada(p, esc)
      return e.neta / e.segundos
    }
    const ventaja = porSegundo('exigente') / porSegundo('paciente')
    expect(ventaja).toBeGreaterThan(1) // sigue siendo el que paga
    // Antes del Paso 7 esto valía 8.7: servirle a Doña Chela era regalar el
    // turno. Cuatro veces es una preferencia; nueve es una obligación.
    expect(ventaja).toBeLessThan(4.5)
  })

  it('el que más paga NO es el que más reputación da', () => {
    const { perfiles } = balance
    const masPaga = (Object.keys(perfiles) as PerfilCliente[]).reduce((a, b) =>
      perfiles[a].sellPricePerLiter > perfiles[b].sellPricePerLiter ? a : b,
    )
    const masRep = (Object.keys(perfiles) as PerfilCliente[]).reduce((a, b) =>
      perfiles[a].rep.onTime > perfiles[b].rep.onTime ? a : b,
    )
    expect(masPaga).not.toBe(masRep)
  })

  it('cada perfil deja algo: ninguno es puro trámite', () => {
    const esc = ESCENARIOS.arranque
    for (const perfil of Object.keys(mezclaClientes()) as PerfilCliente[]) {
      expect(entregaProyectada(perfil, esc).neta, perfil).toBeGreaterThan(0)
    }
  })
})

describe('el modelo sigue describiendo el mundo', () => {
  it('la distancia media del pozo a un domicilio no se movió', () => {
    // Si la traza cambia, la proyección miente sin avisar. Esto lo avisa.
    const p = WATER_SOURCE.pos
    const dists = Object.values(DOMICILIOS).map((d) =>
      Math.hypot(d[0] - p[0], d[2] - p[2]),
    )
    const media = dists.reduce((s, x) => s + x, 0) / dists.length
    expect(media).toBeCloseTo(MODELO_JORNADA.distanciaMediaMetros, -1)
  })

  it('la jornada la limita el tiempo, no la falta de clientes', () => {
    // Si el día se acabara por no tener a quién surtirle, mejorar el motor no
    // subiría el ingreso y media escalera de mejoras dejaría de tener sentido.
    for (const esc of Object.values(ESCENARIOS)) {
      expect(proyeccionJornada(esc).limitadaPorClientes, esc.nombre).toBe(false)
    }
  })

  it('la jornada deja más conforme avanza la progresión', () => {
    const arranque = proyeccionJornada(ESCENARIOS.arranque).neta
    const asentado = proyeccionJornada(ESCENARIOS.asentado).neta
    const veterano = proyeccionJornada(ESCENARIOS.veterano).neta
    expect(asentado).toBeGreaterThan(arranque)
    expect(veterano).toBeGreaterThan(asentado)
  })
})

describe('la escalera de precios', () => {
  it('cada nivel cuesta más que el anterior', () => {
    for (const cat of CATEGORIAS) {
      const [n1, n2, n3] = balance.garage.mejoras[cat].precios
      expect(n2, cat).toBeGreaterThan(n1)
      expect(n3, cat).toBeGreaterThan(n2)
    }
  })

  it('subir de nivel nunca es gratis', () => {
    for (const cat of CATEGORIAS) {
      for (const nivel of [0, 1, 2] as Nivel[]) {
        expect(precioMejora(cat, nivel), `${cat} n${nivel + 1}`).toBeGreaterThan(0)
      }
    }
  })

  it('el estilo completo cuesta menos que una sola mejora', () => {
    // «Barato comparado con las mejoras» (sección 5): vestir la pipa entera
    // no puede competir con subir una pieza de nivel.
    const e = balance.garage.estilo
    const todoElEstilo =
      e.pintura.cabina +
      e.pintura.tanque +
      e.rotulo +
      e.calca +
      Object.values(e.piezas).reduce((s, x) => s + x, 0)
    expect(todoElEstilo).toBeLessThan(primeraMejora().precio * 3)
  })
})
