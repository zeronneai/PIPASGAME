import { useEffect } from 'react'
import { useGameStore } from '../state/gameStore'

/** Cuánto vive un aviso en pantalla. Lo justo para leerlo dos veces. */
const NOTICE_MS = 3200

/**
 * Aviso pasajero (Paso 3): el «no» del cliente, el enfriamiento, el pedido
 * que ya existe. Un renglón arriba del centro y se va solo; el porqué del
 * rechazo es información de juego, pero no amerita un modal.
 */
export function NoticeToast() {
  const notice = useGameStore((s) => s.notice)

  useEffect(() => {
    if (!notice) return
    // clearNotice verifica el id: si mientras tanto llegó un aviso nuevo,
    // este timer viejo ya no borra nada.
    const t = setTimeout(
      () => useGameStore.getState().clearNotice(notice.id),
      NOTICE_MS,
    )
    return () => clearTimeout(t)
  }, [notice])

  if (!notice) return null
  // key: un texto nuevo remonta el nodo y reinicia la animación de entrada.
  return (
    <div className="notice-toast" key={notice.id}>
      {notice.text}
    </div>
  )
}
