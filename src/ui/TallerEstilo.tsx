import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { balance } from '../game/balance'
import {
  CALCAS,
  CALCA_IDS,
  COLORES,
  COLOR_IDS,
  DETALLES,
  PIEZAS,
  PIEZAS_CROMO,
  ROTULO_MAX,
  estiloDe,
  precioCambio,
  sanitizarRotulo,
  tieneCalca,
  tieneColor,
  tienePieza,
  type CalcaId,
  type CambioEstilo,
  type ColorId,
  type Estilo,
  type Pieza,
} from '../game/systems/estilo'
import { dibujarPlaca } from '../game/vehicle/estiloRender'
import { useGameStore } from '../state/gameStore'
import { pesos } from './formato'

/*
 * La pestaña de Estilo (Fase 2, Paso 5, segunda pasada).
 *
 * Tres reglas de esta pantalla:
 *   - TOCAR NO COMPRA. Tocar selecciona y se ve en la pipa del aparador (la
 *     vista previa 3D de la izquierda); pagar es un botón aparte con el
 *     precio enfrente.
 *   - Lo comprado es TUYO para siempre (inventario del jugador, global):
 *     el botón dice «Comprar $X» la primera vez y «Aplicar» gratis después.
 *   - Tres marcas visuales por ficha: anillo acento = puesto en esta pipa,
 *     anillo claro = seleccionado (aún sin pagar), puntito = ya es tuyo.
 *
 * La vista previa entra con lazy(): una Canvas de r3f importada estática
 * aquí metería three al bundle del arranque, y three vive en su chunk aparte
 * desde la Fase 0.
 */

const PipaPreview = lazy(() =>
  import('./PipaPreview').then((m) => ({ default: m.PipaPreview })),
)

const comprar = (cambio: CambioEstilo) =>
  useGameStore.getState().comprarEstilo(cambio)

/** Lo seleccionado y aún sin pagar. undefined = sin selección en ese campo. */
type Sel = {
  cabina?: ColorId
  tanque?: ColorId
  calca?: CalcaId | null
  piezas: Partial<Record<Pieza, boolean>>
}

/** Ficha de calca: un canvas chico pintado con el pincel del mundo. */
function CalcaPreview({ calca, tanqueHex }: { calca: CalcaId; tanqueHex: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    dibujarPlaca(el.getContext('2d')!, el.width, el.height, {
      rotulo: '',
      calca,
      tanqueHex,
    })
  }, [calca, tanqueHex])
  return <canvas ref={ref} width={128} height={44} className="estilo-calca-lienzo" />
}

/** El botón de pagar de una sección: Comprar $X, Aplicar (gratis) o Quitar. */
function BotonPagar({
  costo,
  alcanza,
  quitar,
  onPagar,
}: {
  costo: number
  alcanza: boolean
  quitar?: boolean
  onPagar: () => void
}) {
  return (
    <button
      className={`estilo-btn${alcanza ? '' : ' no-alcanza'}`}
      disabled={!alcanza}
      onPointerDown={onPagar}
    >
      {costo > 0 ? `Comprar · ${pesos(costo)}` : quitar ? 'Quitar' : 'Aplicar'}
    </button>
  )
}

export function TallerEstilo() {
  const garage = useGameStore((s) => s.garage)
  const inv = useGameStore((s) => s.inventarioEstilo)
  const money = useGameStore((s) => s.economy.money)
  const [texto, setTexto] = useState<string | null>(null)
  const [sel, setSel] = useState<Sel>({ piezas: {} })
  const pipa = garage.pipas[garage.equipada]
  if (!pipa) return null

  const estilo = estiloDe(pipa)
  const precios = balance.garage.estilo

  // El borrador del rotulista: arranca en el rótulo puesto y vive local
  // hasta que se paga. null = todavía no se toca el input.
  const borrador = texto ?? estilo.rotulo
  const rotuloListo = sanitizarRotulo(borrador)
  const rotuloCambia = rotuloListo !== estilo.rotulo
  const rotuloPrecio = rotuloListo === '' ? 0 : precios.rotulo

  /** Lo que enseña el aparador: lo puesto más lo seleccionado sin pagar. */
  const previewEstilo: Estilo = {
    pintura: {
      cabina: sel.cabina ?? estilo.pintura.cabina,
      tanque: sel.tanque ?? estilo.pintura.tanque,
    },
    rotulo: rotuloListo,
    calca: sel.calca === undefined ? estilo.calca : sel.calca,
    cromo: { ...estilo.cromo },
    detalles: { ...estilo.detalles },
  }
  for (const [pieza, puesta] of Object.entries(sel.piezas)) {
    if (PIEZAS_CROMO.includes(pieza as (typeof PIEZAS_CROMO)[number])) {
      previewEstilo.cromo[pieza as (typeof PIEZAS_CROMO)[number]] = puesta
    } else {
      previewEstilo.detalles[pieza as (typeof DETALLES)[number]] = puesta
    }
  }

  const tanqueHex = COLORES[previewEstilo.pintura.tanque].hex

  const seccionPintura = (parte: 'cabina' | 'tanque') => {
    const puesto = estilo.pintura[parte]
    const elegido = sel[parte]
    const pendiente = elegido !== undefined && elegido !== puesto
    const costo = pendiente
      ? precioCambio({ tipo: 'pintura', parte, color: elegido }, inv)
      : 0
    return (
      <section key={parte} className="estilo-seccion">
        <header className="estilo-titulo">
          {parte === 'cabina' ? 'Cabina' : 'Tanque'}
          {pendiente ? (
            <BotonPagar
              costo={costo}
              alcanza={money >= costo}
              onPagar={() => {
                comprar({ tipo: 'pintura', parte, color: elegido })
                setSel((p) => ({ ...p, [parte]: undefined }))
              }}
            />
          ) : (
            <span className="estilo-precio">
              color nuevo · {pesos(precios.pintura[parte])}
            </span>
          )}
        </header>
        <div className="estilo-fila" role="listbox" aria-label={`color de ${parte}`}>
          {COLOR_IDS.map((color) => {
            const clases = [
              'estilo-swatch',
              color === puesto ? 'puesta' : '',
              pendiente && color === elegido ? 'sel' : '',
              tieneColor(inv, color) ? 'tuya' : '',
            ]
            return (
              <button
                key={color}
                role="option"
                aria-selected={color === (elegido ?? puesto)}
                aria-label={COLORES[color].nombre}
                className={clases.filter(Boolean).join(' ')}
                style={{ background: COLORES[color].hex }}
                onPointerDown={() =>
                  setSel((p) => ({ ...p, [parte]: color === puesto ? undefined : color }))
                }
              />
            )
          })}
        </div>
      </section>
    )
  }

  const filaPieza = (pieza: Pieza) => {
    const esCromo = PIEZAS_CROMO.includes(pieza as (typeof PIEZAS_CROMO)[number])
    const puesta = esCromo
      ? estilo.cromo[pieza as (typeof PIEZAS_CROMO)[number]] === true
      : estilo.detalles[pieza as (typeof DETALLES)[number]] === true
    const tuya = tienePieza(inv, pieza)
    const precio = precios.piezas[pieza]
    return (
      <li
        key={pieza}
        className={`estilo-pieza${sel.piezas[pieza] !== undefined ? ' preview' : ''}`}
        onPointerDown={() =>
          // Tocar el renglón previsualiza; los botones se encargan de pagar.
          setSel((p) => ({
            ...p,
            piezas: {
              ...p.piezas,
              [pieza]: sel.piezas[pieza] === undefined ? !puesta : undefined,
            },
          }))
        }
      >
        <div className="estilo-pieza-info">
          <span className="estilo-pieza-nombre">
            {PIEZAS[pieza].nombre}
            {tuya && <i className="estilo-punto" aria-label="ya es tuya" />}
          </span>
          <span className="estilo-pieza-de">{PIEZAS[pieza].de}</span>
        </div>
        {tuya ? (
          <button
            className={`estilo-palanca${puesta ? ' puesta' : ''}`}
            onPointerDown={(e) => {
              e.stopPropagation()
              useGameStore.getState().togglePiezaEstilo(pieza)
              setSel((p) => ({ ...p, piezas: { ...p.piezas, [pieza]: undefined } }))
            }}
          >
            {puesta ? 'Puesta' : 'Quitada'}
          </button>
        ) : (
          <button
            className={`estilo-btn${money >= precio ? '' : ' no-alcanza'}`}
            disabled={money < precio}
            onPointerDown={(e) => {
              e.stopPropagation()
              comprar({ tipo: 'pieza', pieza })
              setSel((p) => ({ ...p, piezas: { ...p.piezas, [pieza]: undefined } }))
            }}
          >
            {pesos(precio)}
          </button>
        )}
      </li>
    )
  }

  const calcaPendiente = sel.calca !== undefined && sel.calca !== estilo.calca
  const calcaCosto = calcaPendiente
    ? precioCambio({ tipo: 'calca', calca: sel.calca! }, inv)
    : 0

  return (
    <div className="estilo">
      <div className="estilo-vista">
        <Suspense fallback={<div className="estilo-vista-cargando">La pipa…</div>}>
          <PipaPreview estilo={previewEstilo} />
        </Suspense>
        <p className="estilo-vista-pista">Arrastra para girarla</p>
      </div>

      <div className="estilo-opciones">
        {seccionPintura('cabina')}
        {seccionPintura('tanque')}

        <section className="estilo-seccion">
          <header className="estilo-titulo">
            Rótulo
            {rotuloCambia ? (
              <button
                className={`estilo-btn${money >= rotuloPrecio ? '' : ' no-alcanza'}`}
                disabled={money < rotuloPrecio}
                onPointerDown={() => {
                  comprar({ tipo: 'rotulo', texto: borrador })
                  setTexto(null)
                }}
              >
                {rotuloListo === ''
                  ? 'Borrar'
                  : `Rotular · ${pesos(rotuloPrecio)}`}
              </button>
            ) : (
              <span className="estilo-precio">
                cada texto · {pesos(precios.rotulo)}
              </span>
            )}
          </header>
          <input
            className="estilo-rotulo-input"
            type="text"
            maxLength={ROTULO_MAX}
            placeholder="Chuy el Pipero"
            value={borrador}
            onChange={(e) => setTexto(e.target.value)}
            aria-label="texto del rótulo"
          />
        </section>

        <section className="estilo-seccion">
          <header className="estilo-titulo">
            Calcas
            {calcaPendiente ? (
              <BotonPagar
                costo={calcaCosto}
                alcanza={money >= calcaCosto}
                quitar={sel.calca === null}
                onPagar={() => {
                  comprar({ tipo: 'calca', calca: sel.calca! })
                  setSel((p) => ({ ...p, calca: undefined }))
                }}
              />
            ) : (
              <span className="estilo-precio">nueva · {pesos(precios.calca)}</span>
            )}
          </header>
          <div className="estilo-fila" role="listbox" aria-label="calca">
            {([null, ...CALCA_IDS] as (CalcaId | null)[]).map((calca) => {
              const mostrada = sel.calca === undefined ? estilo.calca : sel.calca
              const clases = [
                'estilo-calca',
                calca === estilo.calca ? 'puesta' : '',
                calcaPendiente && calca === sel.calca ? 'sel' : '',
                calca !== null && tieneCalca(inv, calca) ? 'tuya' : '',
              ]
              return (
                <button
                  key={calca ?? 'nada'}
                  role="option"
                  aria-selected={calca === mostrada}
                  aria-label={calca ? CALCAS[calca].nombre : 'Ninguna'}
                  className={clases.filter(Boolean).join(' ')}
                  onPointerDown={() =>
                    setSel((p) => ({
                      ...p,
                      calca: calca === estilo.calca ? undefined : calca,
                    }))
                  }
                >
                  {calca ? (
                    <CalcaPreview calca={calca} tanqueHex={tanqueHex} />
                  ) : (
                    <span className="estilo-calca-nada">Ninguna</span>
                  )}
                </button>
              )
            })}
          </div>
        </section>

        <section className="estilo-seccion">
          <header className="estilo-titulo">Cromo</header>
          <ul className="estilo-piezas">{PIEZAS_CROMO.map(filaPieza)}</ul>
        </section>

        <section className="estilo-seccion">
          <header className="estilo-titulo">Detalles</header>
          <ul className="estilo-piezas">{DETALLES.map(filaPieza)}</ul>
        </section>
      </div>
    </div>
  )
}
