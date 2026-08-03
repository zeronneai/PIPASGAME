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
 */
export function SegundaButton() {
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
