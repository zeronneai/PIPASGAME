import { balance } from '../game/balance'
import { COLONIAS } from '../game/systems/clients'
import { useGameStore } from '../state/gameStore'
import { useInputStore } from '../state/inputStore'
import { HoldButton } from './HoldButton'

/**
 * «Meterle segunda»: se MANTIENE apretada, no es un toque.
 *
 * Va del lado izquierdo, junto a los del volante, y no es capricho: la
 * segunda solo entra con el volante centrado, así que mientras la usas el
 * pulgar que dirige está ocioso. El derecho sigue en el acelerador, que
 * también hay que mantener apretado.
 *
 * El botón NO sabe si la segunda está entrando o no: eso lo decide
 * driveModel según velocidad, volante y temperatura. Aquí solo se declara la
 * intención, igual que hacen las fuentes de volante.
 *
 * Desde el Paso 6 la segunda SE GANA. Mientras no sea tuya, el botón se
 * queda a la vista pero con candado — el hueco en los mandos es el «te
 * falta algo» que pide el documento — y tocarlo te dice cómo ganarla. La
 * física la corta aparte en useVehicleController: esto es solo la cara.
 */
export function SegundaButton() {
  const desbloqueada = useGameStore((s) => s.economy.segundaDesbloqueada)

  if (!desbloqueada) {
    const colonia = Object.values(COLONIAS)[0].name
    return (
      <div className="segunda-wrap">
        <button
          className="drive-button segunda segunda-bloqueada"
          aria-label="La segunda, todavía sin ganar"
          onPointerDown={() =>
            useGameStore
              .getState()
              .showNotice(
                `La segunda se gana: llega a ${balance.reputacion.segundaUnlock} de reputación en ${colonia}`,
              )
          }
        >
          <span className="segunda-candado">🔒</span>
          2ª
        </button>
      </div>
    )
  }

  return (
    <div className="segunda-wrap">
      <HoldButton
        className="segunda"
        ariaLabel="Meterle segunda"
        label="2ª"
        onChange={(v) => {
          useInputStore.getState().drive.boost = v
        }}
      />
    </div>
  )
}
