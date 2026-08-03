import { COLONIAS, type PerfilCliente } from '../game/systems/clients'
import { useGameStore } from '../state/gameStore'

/*
 * La pantalla del pedido (Paso 3): cliente, perfil, litros, ventana y pago
 * estimado, con aceptar o rechazar. El perfil va en un chip de color con su
 * trade-off escrito — legible ANTES de aceptar, no adivinanza (sección 2.3).
 *
 * Es un modal de verdad: el fondo bloquea los controles porque aceptar un
 * pedido ES la decisión del juego, y merece el momento.
 */

const PERFIL: Record<PerfilCliente, { titulo: string; desc: string }> = {
  paciente: { titulo: 'Paciente', desc: 'Ventana amplia · perdona retrasos · paga poco' },
  normal: { titulo: 'Normal', desc: 'Ventana media · tolera poco · paga regular' },
  exigente: { titulo: 'Exigente', desc: 'Ventana corta · cancela si tardas · paga bien' },
}

const litros = (n: number) => n.toLocaleString('es-MX')

export function OfferPanel() {
  const offer = useGameStore((s) => s.offer)
  if (!offer) return null

  const perfil = PERFIL[offer.perfil]
  return (
    <div className="offer-backdrop">
      <div className="offer-card">
        <div className="offer-cliente">{offer.name}</div>
        <div className="offer-colonia">
          {COLONIAS[offer.colonia]?.name ?? offer.colonia} · quiere agua
        </div>

        <div className={`perfil-chip perfil-${offer.perfil}`}>{perfil.titulo}</div>
        <div className="offer-desc">{perfil.desc}</div>

        <div className="offer-rows">
          <div className="offer-row">
            <span>Pide</span>
            <b>{litros(offer.litros)} L</b>
          </div>
          <div className="offer-row">
            <span>Ventana</span>
            <b>{offer.windowMinutes} min</b>
          </div>
          <div className="offer-row">
            {/* La entrega ya no es aquí: este número es el que hace pensar
                en la ruta antes de decir que sí. */}
            <span>Entrega</span>
            <b>a {Math.round(offer.deliveryDist)} m</b>
          </div>
          <div className="offer-row">
            <span>Pago a tiempo</span>
            <b>~${offer.estimate.toFixed(2)}</b>
          </div>
        </div>

        <div className="offer-actions">
          <button
            className="offer-btn offer-no"
            // onPointerDown, como todo botón de acción: en móvil el click tarda.
            onPointerDown={() => useGameStore.getState().rejectOffer()}
          >
            Ahora no
          </button>
          <button
            className="offer-btn offer-si"
            onPointerDown={() => useGameStore.getState().acceptOffer()}
          >
            Aceptar
          </button>
        </div>
      </div>
    </div>
  )
}
