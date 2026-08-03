import { useRef } from 'react'
import type { PointerEvent, ReactNode } from 'react'

/**
 * Botón que vale 1 mientras lo tienes apretado y 0 al soltarlo.
 *
 * Rastrea su propio pointerId, así que varios botones (volante y acelerador)
 * funcionan a la vez sin pelearse, que es el requisito de multitouch de la
 * sección 4. Con setPointerCapture además no se queda pegado si arrastras el
 * pulgar fuera del botón.
 */
export function HoldButton({
  className,
  label,
  ariaLabel,
  onChange,
}: {
  className?: string
  label: ReactNode
  ariaLabel: string
  onChange: (value: number) => void
}) {
  const pointer = useRef<number | null>(null)

  const press = (e: PointerEvent<HTMLButtonElement>) => {
    if (pointer.current !== null) return
    pointer.current = e.pointerId
    e.currentTarget.setPointerCapture(e.pointerId)
    onChange(1)
  }

  const release = (e: PointerEvent<HTMLButtonElement>) => {
    if (pointer.current !== e.pointerId) return
    pointer.current = null
    onChange(0)
  }

  return (
    <button
      className={`drive-button ${className ?? ''}`}
      aria-label={ariaLabel}
      onPointerDown={press}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
    >
      {label}
    </button>
  )
}
