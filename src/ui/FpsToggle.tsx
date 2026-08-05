import { useGameStore } from '../state/gameStore'

/** Botón chip para ocultar/mostrar el overlay de FPS/draw calls. Vive junto
 *  al ☰ de ajustes; el estado está en el store (debug.fps), así que
 *  sobrevive a abrir y cerrar el cajón de leva. */
export function FpsToggle() {
  const visible = useGameStore((s) => s.debug.fps)
  const setDebugFps = useGameStore((s) => s.setDebugFps)

  return (
    <button
      className={`fps-toggle${visible ? ' fps-toggle--on' : ''}`}
      onPointerDown={() => setDebugFps(!visible)}
    >
      FPS
    </button>
  )
}
