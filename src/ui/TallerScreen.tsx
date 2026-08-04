import { useState } from 'react'
import { MODELOS } from '../game/systems/garage'
import { capacidadPipa, useGameStore } from '../state/gameStore'

/*
 * EL TALLER (Fase 2, Paso 2). Por ahora es el cascarón: llegas manejando, se
 * abre, y las tres pestañas están vacías. Lo que se prueba en este paso es que
 * la pantalla se sienta bien en el teléfono, no lo que se puede comprar.
 *
 * Tres reglas de la sección 4 del documento de Fase 0, que aquí no son
 * negociables porque esta pantalla es TODA de dedo:
 *   - nada tocable menor a 44x44 px
 *   - safe areas: ni el notch ni la barra de gestos tapan nada
 *   - los colores salen de theme.css, ninguno en duro
 *
 * El reloj de la jornada sigue corriendo mientras está abierto: ir al taller
 * cuesta tiempo del día, y esa es justo la decisión que el documento quiere.
 */

const PESTANAS = [
  {
    id: 'lote',
    nombre: 'Lote',
    titulo: 'Comprar otra pipa',
    de: 'Aquí se compran los otros modelos. Conservas la que traes: elegir con cuál sales es parte del juego.',
  },
  {
    id: 'mejoras',
    nombre: 'Mejoras',
    titulo: 'Mejorar la que traes',
    de: 'Tanque, motor, bomba, suspensión, llantas y enfriamiento. Casi toda mejora cobra algo a cambio.',
  },
  {
    id: 'estilo',
    nombre: 'Estilo',
    titulo: 'Cómo se ve',
    de: 'Pintura, rótulos, calcas y cromo. Puro gusto: no da ventaja, y por eso puedes armarla como se te antoje.',
  },
] as const

type PestanaId = (typeof PESTANAS)[number]['id']

export function TallerScreen() {
  const abierto = useGameStore((s) => s.tallerAbierto)
  const equipada = useGameStore((s) => s.garage.equipada)
  const money = useGameStore((s) => s.economy.money)
  const [pestana, setPestana] = useState<PestanaId>('mejoras')

  if (!abierto) return null

  const activa = PESTANAS.find((p) => p.id === pestana)!
  const modelo = MODELOS[equipada]

  return (
    <div className="taller-backdrop">
      <div className="taller-panel">
        <header className="taller-header">
          <div>
            <div className="taller-titulo">Taller</div>
            <div className="taller-sub">
              {modelo.nombre} · {capacidadPipa().toLocaleString('es-MX')} L
            </div>
          </div>
          <div className="taller-cartera">${money.toFixed(2)}</div>
          <button
            className="taller-cerrar"
            aria-label="Salir del taller"
            onPointerDown={() => useGameStore.getState().setTallerAbierto(false)}
          >
            ✕
          </button>
        </header>

        <nav className="taller-tabs" role="tablist">
          {PESTANAS.map((p) => (
            <button
              key={p.id}
              role="tab"
              aria-selected={p.id === pestana}
              className={`taller-tab${p.id === pestana ? ' activa' : ''}`}
              onPointerDown={() => setPestana(p.id)}
            >
              {p.nombre}
            </button>
          ))}
        </nav>

        <section className="taller-cuerpo" role="tabpanel">
          <div className="taller-vacio">
            <div className="taller-vacio-titulo">{activa.titulo}</div>
            <p className="taller-vacio-texto">{activa.de}</p>
            <div className="taller-vacio-pronto">Todavía no abre</div>
          </div>
        </section>
      </div>
    </div>
  )
}
