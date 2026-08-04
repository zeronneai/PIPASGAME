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
  sanitizarRotulo,
  type Estilo,
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

describe('aplicarCambio', () => {
  it('pintar cobra, y repintar vuelve a cobrar', () => {
    const r1 = aplicarCambio(
      pipaDeFabrica('mediana'),
      { tipo: 'pintura', parte: 'cabina', color: 'rojo' },
      cartera,
      B,
    )
    expect(r1.ok).toBe(true)
    if (!r1.ok) return
    expect(r1.costo).toBe(B.garage.estilo.pintura.cabina)
    expect(r1.pipa.estilo?.pintura.cabina).toBe('rojo')
    // El tanque no se movió: son colores por separado.
    expect(r1.pipa.estilo?.pintura.tanque).toBe('aluminio')
    const r2 = aplicarCambio(
      r1.pipa,
      { tipo: 'pintura', parte: 'cabina', color: 'azul' },
      cartera,
      B,
    )
    expect(r2.ok && r2.costo).toBe(B.garage.estilo.pintura.cabina)
  })

  it('el color puesto no se cobra ni avisa: SIN_CAMBIO', () => {
    const r = aplicarCambio(
      pipaDeFabrica('mediana'),
      { tipo: 'pintura', parte: 'tanque', color: 'aluminio' },
      cartera,
      B,
    )
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.motivo).toBe('SIN_CAMBIO')
  })

  it('el rótulo llega sanitizado y quitarlo es gratis', () => {
    const r = aplicarCambio(
      pipaDeFabrica('mediana'),
      { tipo: 'rotulo', texto: '  aguas   ' + 'x'.repeat(60) },
      cartera,
      B,
    )
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.pipa.estilo?.rotulo).toHaveLength(ROTULO_MAX)
    expect(r.costo).toBe(B.garage.estilo.rotulo)
    const borrar = aplicarCambio(r.pipa, { tipo: 'rotulo', texto: '   ' }, 0, B)
    expect(borrar.ok && borrar.costo).toBe(0)
  })

  it('la calca cobra al poner y no al quitar', () => {
    const puesta = aplicarCambio(
      pipaDeFabrica('mediana'),
      { tipo: 'calca', calca: 'olas' },
      cartera,
      B,
    )
    expect(puesta.ok && puesta.costo).toBe(B.garage.estilo.calca)
    if (!puesta.ok) return
    const fuera = aplicarCambio(puesta.pipa, { tipo: 'calca', calca: null }, 0, B)
    expect(fuera.ok && fuera.costo).toBe(0)
  })

  it('una pieza se compra UNA vez; la segunda es YA_LA_TIENES', () => {
    const r1 = aplicarCambio(
      pipaDeFabrica('mediana'),
      { tipo: 'pieza', pieza: 'rines' },
      cartera,
      B,
    )
    expect(r1.ok && r1.costo).toBe(B.garage.estilo.piezas.rines)
    if (!r1.ok) return
    expect(r1.pipa.estilo?.cromo.rines).toBe(true)
    const r2 = aplicarCambio(r1.pipa, { tipo: 'pieza', pieza: 'rines' }, cartera, B)
    expect(r2.ok).toBe(false)
    if (!r2.ok) expect(r2.motivo).toBe('YA_LA_TIENES')
    // Y quitada sigue siendo tuya: alternar no borra la llave, así que
    // tampoco se puede volver a cobrar.
    const quitada = alternarPieza(r1.pipa, 'rines')!
    expect(quitada.estilo?.cromo.rines).toBe(false)
    const r3 = aplicarCambio(quitada, { tipo: 'pieza', pieza: 'rines' }, cartera, B)
    expect(r3.ok).toBe(false)
  })

  it('sin dinero dice cuánto costaba y no toca la pipa', () => {
    const antes = pipaDeFabrica('mediana')
    const r = aplicarCambio(antes, { tipo: 'pieza', pieza: 'luces' }, 1, B)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.motivo).toBe('SIN_DINERO')
    expect(r.costo).toBe(B.garage.estilo.piezas.luces)
    expect(antes.estilo).toBeUndefined()
  })

  it('no muta la pipa que recibe: devuelve una nueva', () => {
    const antes = tuneada()
    const r = aplicarCambio(antes, { tipo: 'pintura', parte: 'cabina', color: 'verde' }, cartera, B)
    expect(antes.estilo?.pintura.cabina).toBe('rojo')
    expect(r.ok && r.pipa.estilo?.pintura.cabina).toBe('verde')
  })
})

describe('alternarPieza', () => {
  it('solo alterna lo comprado', () => {
    expect(alternarPieza(pipaDeFabrica('mediana'), 'claxon')).toBeNull()
    const conClaxon = aplicarCambio(
      pipaDeFabrica('mediana'),
      { tipo: 'pieza', pieza: 'claxon' },
      cartera,
      B,
    )
    if (!conClaxon.ok) throw new Error('la compra debía pasar')
    const apagado = alternarPieza(conClaxon.pipa, 'claxon')!
    expect(apagado.estilo?.detalles.claxon).toBe(false)
    expect(alternarPieza(apagado, 'claxon')!.estilo?.detalles.claxon).toBe(true)
  })

  it('el catálogo cubre las siete piezas', () => {
    expect([...PIEZAS_CROMO, ...DETALLES]).toHaveLength(7)
    for (const id of [...CALCA_IDS]) expect(typeof id).toBe('string')
  })
})
