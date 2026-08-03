import { useRef } from 'react'
import type { PointerEvent } from 'react'
import { useInputStore } from '../state/inputStore'

/**
 * Mitad derecha de la pantalla: arrastrar para orbitar la cámara, sin botón
 * visible. Solo acumula deltas en el inputStore; la ThirdPersonCamera los
 * consume con consumeLook() en su useFrame.
 */
export function CameraDragArea() {
  const last = useRef({ x: 0, y: 0 })

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    const input = useInputStore.getState()
    if (input.pointers.look !== null) return
    input.pointers.look = e.pointerId
    e.currentTarget.setPointerCapture(e.pointerId)
    last.current = { x: e.clientX, y: e.clientY }
  }

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const input = useInputStore.getState()
    if (input.pointers.look !== e.pointerId) return
    input.look.x += e.clientX - last.current.x
    input.look.y += e.clientY - last.current.y
    last.current = { x: e.clientX, y: e.clientY }
  }

  const release = (e: PointerEvent<HTMLDivElement>) => {
    const input = useInputStore.getState()
    if (input.pointers.look !== e.pointerId) return
    input.pointers.look = null
  }

  return (
    <div
      className="touch-zone right"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
    />
  )
}
