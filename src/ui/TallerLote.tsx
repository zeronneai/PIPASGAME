import {
  CATEGORIAS,
  MODELOS,
  NIVEL_MAX,
  computeStats,
  pipaDeFabrica,
  precioModelo,
  type ModeloId,
  type PipaConfig,
} from '../game/systems/garage'
import { useGameStore } from '../state/gameStore'
import { pesos } from './formato'

/*
 * La pestaña del Lote (Fase 2, Paso 4): comprar otro modelo y elegir con cuál
 * sales. Conservas las que ya tienes, y cada una guarda SUS mejoras.
 *
 * Lo importante de esta pantalla es que el ancho esté a la vista junto a la
 * capacidad: la grandota carga el doble Y mide 2.88 m, y hay calles donde eso
 * no pasa. Si solo se enseñaran los litros, parecería simplemente mejor — que
 * es exactamente lo que la sección 3 del documento prohíbe.
 */

const ORDEN: ModeloId[] = ['heredada', 'mediana', 'grandota']

/** Cuántos niveles de mejora trae puestos, sobre el total posible. */
function nivelesPuestos(pipa: PipaConfig) {
  return CATEGORIAS.reduce((sum, cat) => sum + (pipa.mejoras[cat] ?? 0), 0)
}

export function TallerLote() {
  const garage = useGameStore((s) => s.garage)
  const money = useGameStore((s) => s.economy.money)

  return (
    <ul className="lote-lista">
      {ORDEN.map((id) => {
        const modelo = MODELOS[id]
        const tuya = garage.pipas[id]
        const equipada = garage.equipada === id
        // La tuya se enseña como está (con sus mejoras); la del lote, de fábrica.
        const stats = computeStats(tuya ?? pipaDeFabrica(id))
        const precio = precioModelo(id)
        const alcanza = money >= precio

        return (
          <li key={id} className={`lote-pipa${equipada ? ' equipada' : ''}`}>
            <div className="lote-info">
              <div className="lote-encabezado">
                <span className="lote-nombre">{modelo.nombre}</span>
                {equipada && <span className="lote-insignia">La traes puesta</span>}
              </div>
              <p className="lote-perfil">{modelo.perfil}</p>
              <div className="lote-cifras">
                <span>
                  Capacidad{' '}
                  <b>{Math.round(stats.capacidadLitros).toLocaleString('es-MX')} L</b>
                </span>
                <span>
                  Ancho <b>{stats.fisica.chassis.width.toFixed(2)} m</b>
                </span>
                <span>
                  Tara{' '}
                  <b>{Math.round(stats.fisica.tareMass).toLocaleString('es-MX')} kg</b>
                </span>
              </div>
              <div className="lote-mejoras">
                {tuya
                  ? `Mejoras: ${nivelesPuestos(tuya)} de ${CATEGORIAS.length * NIVEL_MAX}`
                  : 'Sale del lote sin mejoras'}
              </div>
            </div>

            {!equipada &&
              (tuya ? (
                <button
                  className="lote-btn salir"
                  onPointerDown={() => useGameStore.getState().equiparPipa(id)}
                >
                  Salir con esta
                </button>
              ) : (
                <button
                  className={`lote-btn${alcanza ? '' : ' no-alcanza'}`}
                  disabled={!alcanza}
                  onPointerDown={() => useGameStore.getState().comprarPipa(id)}
                >
                  {pesos(precio)}
                </button>
              ))}
          </li>
        )
      })}
    </ul>
  )
}
