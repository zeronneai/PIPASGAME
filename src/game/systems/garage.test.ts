import { describe, expect, it } from 'vitest'
import { balance, type Balance } from '../balance'
import { tuning } from '../tuning'
import {
  CATEGORIAS,
  MEJORAS,
  MODELOS,
  NIVEL_MAX,
  computeStats,
  pipaDeFabrica,
  precioMejora,
  tieneCostoFisico,
  type Categoria,
  type ModeloId,
  type Nivel,
  type PipaConfig,
} from './garage'

/*
 * Dos capas, como en economy.test.ts: aritmética exacta contra un balance
 * congelado, y unas cuantas pruebas de INVARIANTE contra el balance real, para
 * que un rebalanceo que rompa una regla de diseño falle ruidosamente en vez de
 * volverse un «el juego se siente raro» imposible de rastrear.
 */
const B: Balance = structuredClone(balance)
B.tank.capacity = 10_000

const con = (
  modelo: ModeloId,
  mejoras: Partial<Record<Categoria, Nivel>> = {},
) =>
  ({
    ...pipaDeFabrica(modelo),
    mejoras: { ...pipaDeFabrica(modelo).mejoras, ...mejoras },
  }) as PipaConfig

const stats = (
  modelo: ModeloId,
  mejoras: Partial<Record<Categoria, Nivel>> = {},
) => computeStats(con(modelo, mejoras), tuning.vehicle, B)

describe('computeStats', () => {
  it('la mediana de fábrica es exactamente la pipa de tuning', () => {
    /*
     * ESTA es la prueba del Paso 1 («nada se rompió»). Modelos y mejoras son
     * factores sobre la referencia, así que la mediana pelona tiene todos sus
     * factores en 1 y tiene que devolver el mismo objeto, campo por campo. Si
     * este test falla, el refactor movió la física.
     */
    expect(stats('mediana').fisica).toEqual(tuning.vehicle)
    expect(stats('mediana').capacidadLitros).toBe(B.tank.capacity)
    expect(stats('mediana').escala).toBe(1)
  })

  it('las tres capacidades salen de la de referencia', () => {
    expect(stats('heredada').capacidadLitros).toBe(5_000)
    expect(stats('mediana').capacidadLitros).toBe(10_000)
    expect(stats('grandota').capacidadLitros).toBe(20_000)
  })

  it('el agua sigue a la capacidad: el doble de tanque pesa el doble lleno', () => {
    const media = stats('mediana').fisica
    const grande = stats('grandota').fisica
    expect(grande.waterMass).toBe(media.waterMass * 2)
    // Y la tara NO se duplica: por eso la grandota vacía sigue siendo manejable.
    expect(grande.tareMass).toBeLessThan(media.tareMass * 2)
  })

  it('la heredada es más ligera y más ágil, y carga la mitad', () => {
    const chica = stats('heredada')
    const media = stats('mediana')
    expect(chica.capacidadLitros).toBe(media.capacidadLitros / 2)
    expect(chica.fisica.tareMass).toBeLessThan(media.fisica.tareMass)
    expect(chica.fisica.steer.maxDeg).toBeGreaterThan(media.fisica.steer.maxDeg)
    expect(chica.fisica.chassis.width).toBeLessThan(media.fisica.chassis.width)
  })

  it('un modelo desconocido no revienta: cae en la de referencia', () => {
    const raro = computeStats(
      {
        modelo: 'trailer' as ModeloId,
        mejoras: pipaDeFabrica('mediana').mejoras,
      },
      tuning.vehicle,
      B,
    )
    expect(raro.modelo).toBe('mediana')
    expect(raro.fisica).toEqual(tuning.vehicle)
  })

  it('un nivel fuera de rango se recorta al tope', () => {
    const alTope = stats('mediana', { motor: NIVEL_MAX })
    const pasado = stats('mediana', { motor: 9 as Nivel })
    const negativo = stats('mediana', { motor: -3 as Nivel })
    expect(pasado.fisica.engineForce).toBe(alTope.fisica.engineForce)
    expect(negativo.fisica.engineForce).toBe(
      stats('mediana').fisica.engineForce,
    )
  })
})

describe('las mejoras hacen lo que prometen', () => {
  const base = () => stats('mediana').fisica

  it('el tanque sube la capacidad Y la tara', () => {
    const mejorada = stats('mediana', { tanque: 3 })
    expect(mejorada.capacidadLitros).toBeGreaterThan(10_000)
    expect(mejorada.fisica.tareMass).toBeGreaterThan(base().tareMass)
    // El agua también sube: si no, subir el tanque no serviría de nada.
    expect(mejorada.fisica.waterMass).toBeGreaterThan(base().waterMass)
  })

  it('el motor empuja más y se calienta más rápido', () => {
    const m = stats('mediana', { motor: 3 }).fisica
    expect(m.engineForce).toBeGreaterThan(base().engineForce)
    expect(m.maxSpeed).toBeGreaterThan(base().maxSpeed)
    expect(m.boost.heatRate).toBeGreaterThan(base().boost.heatRate)
  })

  it('el enfriamiento alarga la segunda sin tocar el motor', () => {
    const e = stats('mediana', { enfriamiento: 3 }).fisica
    expect(e.boost.heatRate).toBeLessThan(base().boost.heatRate)
    expect(e.boost.coolRate).toBeGreaterThan(base().boost.coolRate)
    expect(e.engineForce).toBe(base().engineForce)
  })

  it('las llantas agarran y frenan más', () => {
    const l = stats('mediana', { llantas: 3 }).fisica
    expect(l.frictionSlip).toBeGreaterThan(base().frictionSlip)
    expect(l.brakeForce).toBeGreaterThan(base().brakeForce)
  })

  it('la suspensión aguanta más y pesa más', () => {
    const s = stats('mediana', { suspension: 3 }).fisica
    expect(s.suspension.stiffness).toBeGreaterThan(base().suspension.stiffness)
    expect(s.suspension.maxTravel).toBeGreaterThan(base().suspension.maxTravel)
    expect(s.angularDamping).toBeGreaterThan(base().angularDamping)
    expect(s.tareMass).toBeGreaterThan(base().tareMass)
  })

  it('la bomba solo toca la carga: la física no se entera', () => {
    const b = stats('mediana', { bomba: 3 })
    expect(b.bomba.carga).toBeGreaterThan(1)
    expect(b.bomba.descarga).toBeGreaterThan(1)
    expect(b.fisica).toEqual(base())
    expect(b.capacidadLitros).toBe(10_000)
  })

  it('cada nivel rinde más que el anterior, en las seis categorías', () => {
    // El eje que mejora cada una, para poder recorrerlas sin escribir seis
    // pruebas casi iguales.
    const eje: Record<Categoria, (s: ReturnType<typeof stats>) => number> = {
      tanque: (s) => s.capacidadLitros,
      motor: (s) => s.fisica.engineForce,
      bomba: (s) => s.bomba.carga,
      suspension: (s) => s.fisica.suspension.stiffness,
      llantas: (s) => s.fisica.frictionSlip,
      enfriamiento: (s) => s.fisica.boost.coolRate,
    }
    for (const cat of CATEGORIAS) {
      const valores = ([0, 1, 2, 3] as Nivel[]).map((n) =>
        eje[cat](stats('mediana', { [cat]: n })),
      )
      for (let i = 1; i < valores.length; i++) {
        expect(valores[i], `${cat} nivel ${i}`).toBeGreaterThan(valores[i - 1])
      }
    }
  })

  it('un nivel es el total de ese nivel, no la suma de los anteriores', () => {
    // Se lee del catálogo lo que rinde la pipa al comprar, sin multiplicar
    // tres números de cabeza.
    const n2 = stats('mediana', { motor: 2 }).fisica.engineForce
    expect(n2).toBeCloseTo(
      tuning.vehicle.engineForce * (MEJORAS.motor.niveles[1].motor ?? 1),
      6,
    )
  })
})

describe('las reglas de diseño del documento', () => {
  it('ninguna mejora es puro sí: la que no cobra en física, cobra en la caja', () => {
    /*
     * Sección 4: «casi toda mejora debe traer un costo. Si todas son puro sí,
     * no hay decisión, solo hay orden de compra. Las dos que no tienen costo
     * se compensan con precio alto».
     *
     * Contra el balance REAL: abaratar la bomba por debajo de las que sí
     * pesan tiene que romper este test.
     */
    const conCosto = CATEGORIAS.filter(tieneCostoFisico)
    const sinCosto = CATEGORIAS.filter((c) => !tieneCostoFisico(c))
    expect(conCosto.length).toBeGreaterThan(0)
    const masCaraConCosto = Math.max(
      ...conCosto.map((c) => precioMejora(c, 0, balance) ?? 0),
    )
    for (const cat of sinCosto) {
      expect(
        precioMejora(cat, 0, balance) ?? 0,
        `${cat} sale barata`,
      ).toBeGreaterThanOrEqual(masCaraConCosto)
    }
  })

  it('ningún modelo es mejor que otro en todo', () => {
    /*
     * Sección 3: «la grandota no debe ser simplemente mejor. Si es superior en
     * todo, los otros dos modelos dejan de existir y la progresión se acaba».
     */
    const virtudes = {
      capacidad: (s: ReturnType<typeof stats>) => s.capacidadLitros,
      potencia: (s: ReturnType<typeof stats>) => s.fisica.engineForce,
      velocidad: (s: ReturnType<typeof stats>) => s.fisica.maxSpeed,
      volante: (s: ReturnType<typeof stats>) => s.fisica.steer.maxDeg,
      agarre: (s: ReturnType<typeof stats>) => s.fisica.frictionSlip,
      // Menos es más: caber y pesar poco son virtudes.
      estrechez: (s: ReturnType<typeof stats>) => 1 / s.fisica.chassis.width,
      ligereza: (s: ReturnType<typeof stats>) => 1 / s.fisica.tareMass,
    }
    const ids = Object.keys(MODELOS) as ModeloId[]
    for (const a of ids) {
      for (const b of ids) {
        if (a === b) continue
        const gana = Object.values(virtudes).some(
          (v) => v(stats(a)) > v(stats(b)),
        )
        expect(gana, `${a} no le gana a ${b} en nada`).toBe(true)
      }
    }
  })

  it('la mediana es la referencia: todos sus factores son neutros', () => {
    expect(MODELOS.mediana.factores).toEqual({})
  })

  it('cada categoría tiene exactamente tres niveles con precio', () => {
    for (const cat of CATEGORIAS) {
      expect(MEJORAS[cat].niveles).toHaveLength(NIVEL_MAX)
      expect(balance.garage.mejoras[cat]).toHaveLength(NIVEL_MAX)
      // Y cada nivel cuesta más que el anterior.
      const precios = balance.garage.mejoras[cat]
      for (let i = 1; i < precios.length; i++) {
        expect(precios[i], `${cat} nivel ${i + 1}`).toBeGreaterThan(
          precios[i - 1],
        )
      }
    }
  })
})

describe('precioMejora', () => {
  it('cobra el nivel que sigue, y nada cuando ya está al tope', () => {
    expect(precioMejora('motor', 0, B)).toBe(B.garage.mejoras.motor[0])
    expect(precioMejora('motor', 2, B)).toBe(B.garage.mejoras.motor[2])
    expect(precioMejora('motor', NIVEL_MAX, B)).toBeNull()
  })
})
