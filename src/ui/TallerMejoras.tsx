import { balance } from '../game/balance'
import {
  CATEGORIAS,
  MEJORAS,
  NIVEL_MAX,
  computeStats,
  precioMejora,
  type Categoria,
  type Nivel,
  type PipaConfig,
} from '../game/systems/garage'
import { useGameStore } from '../state/gameStore'

/*
 * La pestaña de Mejoras (Fase 2, Paso 3).
 *
 * Lo importante de esta pantalla NO es el botón de comprar: es que se vea EL
 * TRATO. Casi toda mejora cobra algo a cambio (sección 4), y si el costo no
 * está a la vista al mismo tamaño que el beneficio, la decisión desaparece y
 * queda un orden de compra.
 *
 * Por eso cada renglón enseña el antes → después de las dos cifras que
 * importan: lo que sube y lo que se paga. Con números, no con adjetivos.
 */

const pesos = (n: number) =>
  `$${n.toLocaleString('es-MX', { maximumFractionDigits: 0 })}`

/** Las dos cifras que enseña cada categoría, ya con su formato. */
const CIFRAS: Record<
  Categoria,
  {
    sube: { que: string; de: (c: PipaConfig) => string }
    cuesta?: { que: string; de: (c: PipaConfig) => string }
  }
> = {
  tanque: {
    sube: {
      que: 'Capacidad',
      de: (c) => `${Math.round(computeStats(c).capacidadLitros).toLocaleString('es-MX')} L`,
    },
    cuesta: {
      que: 'Tara',
      de: (c) => `${Math.round(computeStats(c).fisica.tareMass).toLocaleString('es-MX')} kg`,
    },
  },
  motor: {
    sube: {
      que: 'Empuje',
      de: (c) => `${Math.round(computeStats(c).fisica.engineForce).toLocaleString('es-MX')} N`,
    },
    cuesta: {
      que: 'Se calienta',
      de: (c) => `${(computeStats(c).fisica.boost.heatRate * 100).toFixed(0)} %/s`,
    },
  },
  bomba: {
    sube: { que: 'Caudal', de: (c) => `×${computeStats(c).bomba.carga.toFixed(2)}` },
  },
  suspension: {
    sube: {
      que: 'Rigidez',
      de: (c) => computeStats(c).fisica.suspension.stiffness.toFixed(0),
    },
    cuesta: {
      que: 'Tara',
      de: (c) => `${Math.round(computeStats(c).fisica.tareMass).toLocaleString('es-MX')} kg`,
    },
  },
  llantas: {
    sube: { que: 'Agarre', de: (c) => computeStats(c).fisica.frictionSlip.toFixed(2) },
  },
  enfriamiento: {
    sube: {
      que: 'Enfría',
      de: (c) => `${(computeStats(c).fisica.boost.coolRate * 100).toFixed(0)} %/s`,
    },
    cuesta: {
      que: 'Se calienta',
      de: (c) => `${(computeStats(c).fisica.boost.heatRate * 100).toFixed(0)} %/s`,
    },
  },
}

/** La pipa como quedaría con esa categoría un nivel más arriba. */
function conNivelSiguiente(pipa: PipaConfig, cat: Categoria): PipaConfig {
  const nivel = Math.min(NIVEL_MAX, (pipa.mejoras[cat] ?? 0) + 1) as Nivel
  return { ...pipa, mejoras: { ...pipa.mejoras, [cat]: nivel } }
}

export function TallerMejoras() {
  const garage = useGameStore((s) => s.garage)
  const money = useGameStore((s) => s.economy.money)
  const pipa = garage.pipas[garage.equipada]
  if (!pipa) return null

  return (
    <ul className="mejoras-lista">
      {CATEGORIAS.map((cat) => {
        const nivel = pipa.mejoras[cat] ?? 0
        const precio = precioMejora(cat, nivel, balance)
        const alTope = precio === null
        const alcanza = precio !== null && money >= precio
        const despues = conNivelSiguiente(pipa, cat)
        const cifras = CIFRAS[cat]

        return (
          <li key={cat} className="mejora">
            <div className="mejora-info">
              <div className="mejora-encabezado">
                <span className="mejora-nombre">{MEJORAS[cat].nombre}</span>
                <span className="mejora-pips" aria-label={`nivel ${nivel} de ${NIVEL_MAX}`}>
                  {Array.from({ length: NIVEL_MAX }, (_, i) => (
                    <i key={i} className={i < nivel ? 'lleno' : ''} />
                  ))}
                </span>
              </div>

              <div className="mejora-cifras">
                <span className="mejora-sube">
                  {cifras.sube.que} {cifras.sube.de(pipa)}
                  {!alTope && <b> → {cifras.sube.de(despues)}</b>}
                </span>
                {cifras.cuesta ? (
                  <span className="mejora-cuesta">
                    {cifras.cuesta.que} {cifras.cuesta.de(pipa)}
                    {!alTope && <b> → {cifras.cuesta.de(despues)}</b>}
                  </span>
                ) : (
                  /* Las limpias lo dicen: no engañan, se pagan en la caja. */
                  <span className="mejora-limpia">Sin contra — por eso es cara</span>
                )}
              </div>
            </div>

            <button
              className={`mejora-btn${alcanza ? '' : ' no-alcanza'}`}
              disabled={alTope || !alcanza}
              onPointerDown={() => useGameStore.getState().comprarMejora(cat)}
            >
              {alTope ? 'Al tope' : pesos(precio)}
            </button>
          </li>
        )
      })}
    </ul>
  )
}
