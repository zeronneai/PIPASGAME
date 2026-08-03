import { lazy, Suspense, useState } from 'react'

/*
 * El panel se carga solo cuando lo abres. Por eso puede existir también en
 * producción sin costarle nada a la carga inicial: el chunk de leva (70 KB
 * gzip) no se descarga hasta el primer toque al botón.
 *
 * Antes estaba detrás de `import.meta.env.DEV`, así que en el link desplegado
 * simplemente no existía, que era la razón principal de que no se viera en el
 * teléfono. La sección 8 del documento pide poder ajustar en vivo DESDE el
 * teléfono, y en Fase 0 el único que abre el link eres tú.
 */
const TuningPanel = lazy(() => import('./TuningPanel'))

export function TuningDrawer() {
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <button
        className="tuning-toggle"
        aria-label="Abrir ajustes"
        onClick={() => setOpen(true)}
      >
        ☰
      </button>
    )
  }

  /*
   * Abierto ocupa el costado izquierdo, pero SIN llegar hasta abajo: ahí
   * están los botones del volante y la barra de resistencia. Cortarlo antes
   * de esa fila es lo que permite seguir manejando mientras ajustas, que es
   * el punto de ajustar en vivo. La derecha queda libre entera para el
   * acelerador, el freno y el botón de contexto.
   */
  return (
    <div className="tuning-drawer">
      <div className="tuning-drawer-header">
        <span>ajustes</span>
        <button
          className="tuning-close"
          aria-label="Cerrar ajustes"
          onClick={() => setOpen(false)}
        >
          ✕
        </button>
      </div>
      <div className="tuning-drawer-body">
        <Suspense fallback={<p className="tuning-cargando">cargando…</p>}>
          <TuningPanel />
        </Suspense>
      </div>
    </div>
  )
}
