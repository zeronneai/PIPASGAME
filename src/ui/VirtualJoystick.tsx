import { useRef } from 'react'
import type { PointerEvent } from 'react'
import { useInputStore } from '../state/inputStore'

const RADIUS = 60
const DEAD_ZONE = 0.15

export function VirtualJoystick() {
  const baseRef = useRef<HTMLDivElement>(null)
  const knobRef = useRef<HTMLDivElement>(null)
  const origin = useRef({ x: 0, y: 0 })

  const place = (el: HTMLDivElement, x: number, y: number) => {
    el.style.left = `${x}px`
    el.style.top = `${y}px`
  }

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    const input = useInputStore.getState()
    if (input.pointers.move !== null) return
    input.pointers.move = e.pointerId
    e.currentTarget.setPointerCapture(e.pointerId)
    origin.current = { x: e.clientX, y: e.clientY }
    if (baseRef.current && knobRef.current) {
      place(baseRef.current, e.clientX, e.clientY)
      place(knobRef.current, e.clientX, e.clientY)
      baseRef.current.style.display = 'block'
      knobRef.current.style.display = 'block'
    }
  }

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const input = useInputStore.getState()
    if (input.pointers.move !== e.pointerId) return
    let dx = e.clientX - origin.current.x
    let dy = e.clientY - origin.current.y
    const dist = Math.hypot(dx, dy)
    const clamped = Math.min(dist, RADIUS)
    if (dist > 0) {
      dx *= clamped / dist
      dy *= clamped / dist
    }
    if (knobRef.current) {
      place(knobRef.current, origin.current.x + dx, origin.current.y + dy)
    }
    const raw = clamped / RADIUS
    const mag = raw < DEAD_ZONE ? 0 : (raw - DEAD_ZONE) / (1 - DEAD_ZONE)
    if (mag > 0) {
      input.move.x = (dx / clamped) * mag
      input.move.y = (-dy / clamped) * mag
    } else {
      input.move.x = 0
      input.move.y = 0
    }
  }

  const release = (e: PointerEvent<HTMLDivElement>) => {
    const input = useInputStore.getState()
    if (input.pointers.move !== e.pointerId) return
    input.pointers.move = null
    input.move.x = 0
    input.move.y = 0
    if (baseRef.current && knobRef.current) {
      baseRef.current.style.display = 'none'
      knobRef.current.style.display = 'none'
    }
  }

  return (
    <div
      className="touch-zone left"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
    >
      <div ref={baseRef} className="joystick-base" style={{ display: 'none' }} />
      <div ref={knobRef} className="joystick-knob" style={{ display: 'none' }} />
    </div>
  )
}
