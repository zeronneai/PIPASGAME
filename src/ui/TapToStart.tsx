// iOS no tiene API de fullscreen: la única pantalla completa real es
// "Agregar a pantalla de inicio" + display standalone en el manifest.
const isStandalone =
  window.matchMedia('(display-mode: standalone)').matches ||
  ('standalone' in navigator &&
    (navigator as { standalone?: boolean }).standalone === true)

export function TapToStart({ onStart }: { onStart: () => void }) {
  return (
    <button type="button" className="overlay start-screen" onPointerUp={onStart}>
      <h1>PIPERO</h1>
      <p className="tap">Toca para empezar</p>
      {!isStandalone && (
        <p className="hint">
          Para jugar a pantalla completa: Compartir → «Agregar a pantalla de
          inicio» y ábrelo desde ahí
        </p>
      )}
    </button>
  )
}
