import { describe, expect, it } from 'vitest'
import { balance, type Balance } from '../balance'
import { tuning } from '../tuning'
import { PIPA_MATERIALS } from '../vehicle/pipaParts'
import {
  CALCA_IDS,
  COLORES,
  DETALLES,
  ESTILO_DE_FABRICA,
  PIEZAS_CROMO,
  ROTULO_MAX,
  aplicarCambio,
  alternarPieza,
  estiloDe,
  inventarioDesdeGarage,
  inventarioInicial,
  precioCambio,
  sanitizarRotulo,
  tieneColor,
  type Estilo,
  type InventarioEstilo,
} from './estilo'
import { CATEGORIAS, computeStats, pipaDeFabrica, precioMejora } from './garage'

const B: Balance = structuredClone(balance)

const cartera = 1_000_000

/** Una pipa con TODO el estilo cargado, para la regla de oro. */
const tuneada = (): ReturnType<typeof pipaDeFabrica> => ({
  ...pipaDeFabrica('mediana'),
  estilo: {
    pintura: { cabina: 'rojo', tanque: 'negro' },
    rotulo: 'CHUY EL PIPERO',
    calca: 'llamas',
    cromo: { defensa: true, espejos: true, escapes: true, rines: true },
    detalles: { claxon: true, luces: true, cortinas: true },
  } satisfies Estilo,
})

describe('la regla de oro: cero efecto en el juego', () => {
  it('computeStats ni se entera del estilo', () => {
    /*
     * Sección 1 del documento: la personalización es SOLO estética. Si algún
     * día alguien le cuelga un factor al estilo, este test truena — y debe
     * seguir tronando, porque en cuanto lo cosmético da ventaja el jugador
     * deja de elegir lo que le gusta.
     */
    const pelona = computeStats(pipaDeFabrica('mediana'), tuning.vehicle, B)
    const vestida = computeStats(tuneada(), tuning.vehicle, B)
    expect(vestida).toEqual(pelona)
  })

  it('los colores de fábrica reproducen los materiales actuales', () => {
    // Una pipa vieja (guardado sin estilo) debe verse IDÉNTICA a como se veía
    // antes del Paso 5.
    expect(COLORES[ESTILO_DE_FABRICA.pintura.cabina].hex).toBe(PIPA_MATERIALS.cabina)
    expect(COLORES[ESTILO_DE_FABRICA.pintura.tanque].hex).toBe(PIPA_MATERIALS.tanque)
    expect(ESTILO_DE_FABRICA.rotulo).toBe('')
    expect(ESTILO_DE_FABRICA.calca).toBeNull()
  })

  it('estiloDe devuelve SIEMPRE la misma referencia para pipas sin estilo', () => {
    // De esta identidad estable depende que PipaModel no se re-renderice de
    // gratis en cada cambio del store.
    expect(estiloDe(pipaDeFabrica('mediana'))).toBe(estiloDe(pipaDeFabrica('grandota')))
  })
})

describe('el estilo es barato a propósito', () => {
  it('nada del estilo cuesta lo que una mejora', () => {
    // «Todo esto es barato comparado con las mejoras: la idea es que puedas
    // verte bien desde temprano, no que sea el premio final» (sección 5).
    const e = balance.garage.estilo
    const masCaro = Math.max(
      e.pintura.cabina,
      e.pintura.tanque,
      e.rotulo,
      e.calca,
      ...Object.values(e.piezas),
    )
    const mejoraMasBarata = Math.min(
      ...CATEGORIAS.map((c) => precioMejora(c, 0, balance) ?? Infinity),
    )
    expect(masCaro).toBeLessThan(mejoraMasBarata)
  })
})

describe('sanitizarRotulo', () => {
  it('recorta, colapsa y limpia', () => {
    expect(sanitizarRotulo('  Chuy   el  Pipero  ')).toBe('Chuy el Pipero')
    expect(sanitizarRotulo('agua​pura')).toBe('aguapura')
    expect(sanitizarRotulo('x'.repeat(100))).toHaveLength(ROTULO_MAX)
    expect(sanitizarRotulo('\n\t')).toBe('')
  })
})

describe('aplicarCambio y el inventario', () => {
  const inv0 = inventarioInicial()

  it('la primera vez cobra y da de alta; aplicar lo tuyo es gratis', () => {
    const r1 = aplicarCambio(
      pipaDeFabrica('mediana'),
      inv0,
      { tipo: 'pintura', parte: 'cabina', color: 'rojo' },
      cartera,
      B,
    )
    expect(r1.ok).toBe(true)
    if (!r1.ok) return
    expect(r1.costo).toBe(B.garage.estilo.pintura.cabina)
    expect(r1.pipa.estilo?.pintura.cabina).toBe('rojo')
    expect(r1.inv.colores).toContain('rojo')
    // El tanque no se movió: son colores por separado.
    expect(r1.pipa.estilo?.pintura.tanque).toBe('aluminio')

    // Cambia a azul (cobra) y REGRESA al rojo: ya es tuyo, sale en cero.
    const r2 = aplicarCambio(
      r1.pipa,
      r1.inv,
      { tipo: 'pintura', parte: 'cabina', color: 'azul' },
      cartera,
      B,
    )
    expect(r2.ok && r2.costo).toBe(B.garage.estilo.pintura.cabina)
    if (!r2.ok) return
    const r3 = aplicarCambio(
      r2.pipa,
      r2.inv,
      { tipo: 'pintura', parte: 'cabina', color: 'rojo' },
      0, // sin un peso en la cartera
      B,
    )
    expect(r3.ok).toBe(true)
    if (!r3.ok) return
    expect(r3.costo).toBe(0)
    expect(r3.inv).toBe(r2.inv) // sin alta nueva, misma referencia
  })

  it('el inventario es del jugador: sirve en otra pipa', () => {
    const conRojo: InventarioEstilo = { ...inv0, colores: ['rojo'] }
    expect(
      precioCambio({ tipo: 'pintura', parte: 'cabina', color: 'rojo' }, conRojo, B),
    ).toBe(0)
    const r = aplicarCambio(
      pipaDeFabrica('grandota'),
      conRojo,
      { tipo: 'pintura', parte: 'cabina', color: 'rojo' },
      0,
      B,
    )
    expect(r.ok && r.costo).toBe(0)
  })

  it('los grises de fábrica siempre son tuyos', () => {
    expect(tieneColor(inv0, 'gris-flota')).toBe(true)
    expect(tieneColor(inv0, 'aluminio')).toBe(true)
    expect(
      precioCambio({ tipo: 'pintura', parte: 'tanque', color: 'gris-flota' }, inv0, B),
    ).toBe(0)
  })

  it('el color puesto no se cobra ni avisa: SIN_CAMBIO', () => {
    const r = aplicarCambio(
      pipaDeFabrica('mediana'),
      inv0,
      { tipo: 'pintura', parte: 'tanque', color: 'aluminio' },
      cartera,
      B,
    )
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.motivo).toBe('SIN_CAMBIO')
  })

  it('el rótulo NO entra al inventario: cada texto se paga', () => {
    const r = aplicarCambio(
      pipaDeFabrica('mediana'),
      inv0,
      { tipo: 'rotulo', texto: '  aguas   ' + 'x'.repeat(60) },
      cartera,
      B,
    )
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.pipa.estilo?.rotulo).toHaveLength(ROTULO_MAX)
    expect(r.costo).toBe(B.garage.estilo.rotulo)
    expect(r.inv).toBe(inv0)
    // Otro texto vuelve a cobrar; quitarlo es gratis.
    const r2 = aplicarCambio(r.pipa, r.inv, { tipo: 'rotulo', texto: 'CHUY' }, cartera, B)
    expect(r2.ok && r2.costo).toBe(B.garage.estilo.rotulo)
    const borrar = aplicarCambio(r.pipa, r.inv, { tipo: 'rotulo', texto: '   ' }, 0, B)
    expect(borrar.ok && borrar.costo).toBe(0)
  })

  it('la calca cobra una vez; quitar y volver a poner es gratis', () => {
    const puesta = aplicarCambio(
      pipaDeFabrica('mediana'),
      inv0,
      { tipo: 'calca', calca: 'olas' },
      cartera,
      B,
    )
    expect(puesta.ok && puesta.costo).toBe(B.garage.estilo.calca)
    if (!puesta.ok) return
    expect(puesta.inv.calcas).toContain('olas')
    const fuera = aplicarCambio(puesta.pipa, puesta.inv, { tipo: 'calca', calca: null }, 0, B)
    expect(fuera.ok && fuera.costo).toBe(0)
    if (!fuera.ok) return
    const deVuelta = aplicarCambio(fuera.pipa, fuera.inv, { tipo: 'calca', calca: 'olas' }, 0, B)
    expect(deVuelta.ok && deVuelta.costo).toBe(0)
  })

  it('una pieza se compra UNA vez y de ahí en adelante se alterna gratis', () => {
    const r1 = aplicarCambio(
      pipaDeFabrica('mediana'),
      inv0,
      { tipo: 'pieza', pieza: 'rines' },
      cartera,
      B,
    )
    expect(r1.ok && r1.costo).toBe(B.garage.estilo.piezas.rines)
    if (!r1.ok) return
    expect(r1.pipa.estilo?.cromo.rines).toBe(true)
    expect(r1.inv.piezas).toContain('rines')
    // Puesta y tuya → volverla a pedir no hace nada.
    const r2 = aplicarCambio(r1.pipa, r1.inv, { tipo: 'pieza', pieza: 'rines' }, cartera, B)
    expect(r2.ok).toBe(false)
    if (!r2.ok) expect(r2.motivo).toBe('SIN_CAMBIO')
    // Quitada sigue tuya: ponerla otra vez es gratis.
    const quitada = alternarPieza(r1.pipa, r1.inv, 'rines')!
    expect(quitada.estilo?.cromo.rines).toBe(false)
    const r3 = aplicarCambio(quitada, r1.inv, { tipo: 'pieza', pieza: 'rines' }, 0, B)
    expect(r3.ok && r3.costo).toBe(0)
  })

  it('sin dinero dice cuánto costaba y no toca nada', () => {
    const antes = pipaDeFabrica('mediana')
    const r = aplicarCambio(antes, inv0, { tipo: 'pieza', pieza: 'luces' }, 1, B)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.motivo).toBe('SIN_DINERO')
    expect(r.costo).toBe(B.garage.estilo.piezas.luces)
    expect(antes.estilo).toBeUndefined()
    expect(inv0.piezas).toHaveLength(0)
  })

  it('no muta ni la pipa ni el inventario que recibe', () => {
    const antes = tuneada()
    const r = aplicarCambio(
      antes,
      inv0,
      { tipo: 'pintura', parte: 'cabina', color: 'verde' },
      cartera,
      B,
    )
    expect(antes.estilo?.pintura.cabina).toBe('rojo')
    expect(inv0.colores).toHaveLength(0)
    expect(r.ok && r.pipa.estilo?.pintura.cabina).toBe('verde')
  })
})

describe('alternarPieza', () => {
  it('solo alterna lo que está en el inventario', () => {
    const inv0 = inventarioInicial()
    expect(alternarPieza(pipaDeFabrica('mediana'), inv0, 'claxon')).toBeNull()
    const conClaxon = aplicarCambio(
      pipaDeFabrica('mediana'),
      inv0,
      { tipo: 'pieza', pieza: 'claxon' },
      cartera,
      B,
    )
    if (!conClaxon.ok) throw new Error('la compra debía pasar')
    const apagado = alternarPieza(conClaxon.pipa, conClaxon.inv, 'claxon')!
    expect(apagado.estilo?.detalles.claxon).toBe(false)
    expect(
      alternarPieza(apagado, conClaxon.inv, 'claxon')!.estilo?.detalles.claxon,
    ).toBe(true)
  })

  it('el catálogo cubre las siete piezas', () => {
    expect([...PIEZAS_CROMO, ...DETALLES]).toHaveLength(7)
    for (const id of [...CALCA_IDS]) expect(typeof id).toBe('string')
  })
})

describe('inventarioDesdeGarage (amnistía de guardados viejos)', () => {
  it('lo que las pipas traían puesto o comprado se da por pagado', () => {
    const inv = inventarioDesdeGarage({
      mediana: tuneada(),
      heredada: pipaDeFabrica('heredada'),
    })
    expect(inv.colores).toContain('rojo')
    expect(inv.colores).toContain('negro')
    // Los de fábrica no gastan lugar: ya son de todos.
    expect(inv.colores).not.toContain('gris-flota')
    expect(inv.calcas).toContain('llamas')
    // La semántica vieja: llave presente (aunque fuera false) era comprada.
    expect(inv.piezas).toEqual(
      expect.arrayContaining(['defensa', 'espejos', 'escapes', 'rines', 'claxon', 'luces', 'cortinas']),
    )
  })

  it('un garage sin estilo da inventario vacío', () => {
    const inv = inventarioDesdeGarage({ heredada: pipaDeFabrica('heredada') })
    expect(inv.colores).toHaveLength(0)
    expect(inv.calcas).toHaveLength(0)
    expect(inv.piezas).toHaveLength(0)
  })
})
