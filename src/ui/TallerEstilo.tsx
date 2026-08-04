import { useEffect, useRef, useState } from 'react'
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
  sanitizarRotulo,
  type CalcaId,
  type CambioEstilo,
  type Pieza,
} from '../game/systems/estilo'
import { dibujarPlaca } from '../game/vehicle/estiloRender'
import { useGameStore } from '../state/gameStore'
import { pesos } from './formato'

/*
 * La pestaña de Estilo (Fase 2, Paso 5). Puro gusto, cero ventaja — y por eso
 * la pantalla no enseña «antes → después» como Mejoras: no hay trato que
 * pesar, solo cómo quieres que se vea la tuya.
 *
 * De dedo en horizontal: secciones apiladas que scrollean vertical (el
 * .taller-cuerpo ya lo hace), y dentro de cada una filas de fichas de 44 px
 * con scroll horizontal. Los previews de calca se dibujan con EL MISMO
 * dibujarPlaca del mundo: lo que ves en la ficha es lo que queda pintado.
 */

const comprar = (cambio: CambioEstilo) =>
  useGameStore.getState().comprarEstilo(cambio)

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

export function TallerEstilo() {
  const garage = useGameStore((s) => s.garage)
  const money = useGameStore((s) => s.economy.money)
  const pipa = garage.pipas[garage.equipada]
  const [texto, setTexto] = useState<string | null>(null)
  if (!pipa) return null

  const estilo = estiloDe(pipa)
  const precios = balance.garage.estilo
  const tanqueHex = COLORES[estilo.pintura.tanque].hex

  // El borrador del rotulista: arranca en el rótulo puesto y vive local
  // hasta que se paga. null = todavía no se toca el input.
  const borrador = texto ?? estilo.rotulo
  const rotuloListo = sanitizarRotulo(borrador)
  const rotuloCambia = rotuloListo !== estilo.rotulo
  const rotuloPrecio = rotuloListo === '' ? 0 : precios.rotulo

  const filaPieza = (pieza: Pieza) => {
    const bolsa = PIEZAS_CROMO.includes(pieza as (typeof PIEZAS_CROMO)[number])
      ? estilo.cromo
      : estilo.detalles
    const tuya = pieza in bolsa
    const puesta = bolsa[pieza as keyof typeof bolsa] === true
    const precio = precios.piezas[pieza]
    return (
      <li key={pieza} className="estilo-pieza">
        <div className="estilo-pieza-info">
          <span className="estilo-pieza-nombre">{PIEZAS[pieza].nombre}</span>
          <span className="estilo-pieza-de">{PIEZAS[pieza].de}</span>
        </div>
        {tuya ? (
          <button
            className={`estilo-palanca${puesta ? ' puesta' : ''}`}
            onPointerDown={() => useGameStore.getState().togglePiezaEstilo(pieza)}
          >
            {puesta ? 'Puesta' : 'Quitada'}
          </button>
        ) : (
          <button
            className={`estilo-btn${money >= precio ? '' : ' no-alcanza'}`}
            disabled={money < precio}
            onPointerDown={() => comprar({ tipo: 'pieza', pieza })}
          >
            {pesos(precio)}
          </button>
        )}
      </li>
    )
  }

  return (
    <div className="estilo">
      {(['cabina', 'tanque'] as const).map((parte) => (
        <section key={parte} className="estilo-seccion">
          <header className="estilo-titulo">
            {parte === 'cabina' ? 'Cabina' : 'Tanque'}
            <span className="estilo-precio">
              pintar · {pesos(precios.pintura[parte])}
            </span>
          </header>
          <div className="estilo-fila" role="listbox" aria-label={`color de ${parte}`}>
            {COLOR_IDS.map((color) => {
              const puesta = estilo.pintura[parte] === color
              const alcanza = money >= precios.pintura[parte]
              return (
                <button
                  key={color}
                  role="option"
                  aria-selected={puesta}
                  aria-label={COLORES[color].nombre}
                  className={`estilo-swatch${puesta ? ' puesta' : ''}${alcanza || puesta ? '' : ' no-alcanza'}`}
                  style={{ background: COLORES[color].hex }}
                  disabled={!puesta && !alcanza}
                  onPointerDown={() => comprar({ tipo: 'pintura', parte, color })}
                />
              )
            })}
          </div>
        </section>
      ))}

      <section className="estilo-seccion">
        <header className="estilo-titulo">
          Rótulo
          <span className="estilo-precio">rotular · {pesos(precios.rotulo)}</span>
        </header>
        <div className="estilo-rotulo">
          <input
            className="estilo-rotulo-input"
            type="text"
            maxLength={ROTULO_MAX}
            placeholder="Chuy el Pipero"
            value={borrador}
            onChange={(e) => setTexto(e.target.value)}
            aria-label="texto del rótulo"
          />
          <button
            className={`estilo-btn${money >= rotuloPrecio ? '' : ' no-alcanza'}`}
            disabled={!rotuloCambia || money < rotuloPrecio}
            onPointerDown={() => {
              comprar({ tipo: 'rotulo', texto: borrador })
              setTexto(null)
            }}
          >
            {rotuloListo === '' ? 'Borrar' : pesos(rotuloPrecio)}
          </button>
        </div>
      </section>

      <section className="estilo-seccion">
        <header className="estilo-titulo">
          Calcas
          <span className="estilo-precio">poner · {pesos(precios.calca)}</span>
        </header>
        <div className="estilo-fila" role="listbox" aria-label="calca">
          <button
            role="option"
            aria-selected={estilo.calca === null}
            className={`estilo-calca${estilo.calca === null ? ' puesta' : ''}`}
            onPointerDown={() => comprar({ tipo: 'calca', calca: null })}
          >
            <span className="estilo-calca-nada">Ninguna</span>
          </button>
          {CALCA_IDS.map((calca) => {
            const alcanza = money >= precios.calca
            const puesta = estilo.calca === calca
            return (
              <button
                key={calca}
                role="option"
                aria-selected={puesta}
                aria-label={CALCAS[calca].nombre}
                className={`estilo-calca${puesta ? ' puesta' : ''}${alcanza || puesta ? '' : ' no-alcanza'}`}
                disabled={!puesta && !alcanza}
                onPointerDown={() => comprar({ tipo: 'calca', calca })}
              >
                <CalcaPreview calca={calca} tanqueHex={tanqueHex} />
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
  )
}
