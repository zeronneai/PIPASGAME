/*
 * El pincel del rotulista: dibuja las placas del tanque (rótulo + calca) en
 * un canvas 2D. Funciones puras sin React ni three — las usa el hook de
 * textura para el mundo Y la pestaña de Estilo para sus previews, así lo que
 * se ve en el menú es EXACTAMENTE lo que queda pintado en la pipa.
 *
 * Todo es generado: cero imágenes, cero fuentes, cero bytes de bundle. Es la
 * «textura simple o placeholder» que autoriza la sección 6 del documento —
 * burdo a propósito, el arte de verdad es de la Fase 3.
 */

import type { CalcaId } from '../systems/estilo'

/** Luminancia relativa aproximada de un #rrggbb, 0 (negro) a 1 (blanco). */
export function luminancia(hex: string): number {
  const n = parseInt(hex.slice(1), 16)
  const r = (n >> 16) & 0xff
  const g = (n >> 8) & 0xff
  const b = n & 0xff
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
}

/** Mezcla un color hacia blanco (t>0) o negro (t<0), t en [-1, 1]. */
export function mezclar(hex: string, t: number): string {
  const n = parseInt(hex.slice(1), 16)
  const meta = t > 0 ? 255 : 0
  const f = Math.abs(t)
  const canal = (c: number) => Math.round(c + (meta - c) * f)
  const r = canal((n >> 16) & 0xff)
  const g = canal((n >> 8) & 0xff)
  const b = canal(n & 0xff)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

type Ctx = CanvasRenderingContext2D

/** Estrella de 5 picos, para sembrar la calca de estrellas. */
function estrella(ctx: Ctx, cx: number, cy: number, r: number) {
  ctx.beginPath()
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.45
    const a = (i * Math.PI) / 5 - Math.PI / 2
    ctx.lineTo(cx + rad * Math.cos(a), cy + rad * Math.sin(a))
  }
  ctx.closePath()
  ctx.fill()
}

/** Cada motivo pinta a lo ancho del canvas, detrás del texto. */
const MOTIVOS: Record<CalcaId, (ctx: Ctx, w: number, h: number) => void> = {
  gota: (ctx, w, h) => {
    const r = h * 0.32
    const cx = w * 0.5
    const cy = h * 0.58
    ctx.fillStyle = '#2f9ee0'
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    // El pico de la gota, subiendo del círculo.
    ctx.moveTo(cx - r * 0.7, cy - r * 0.6)
    ctx.quadraticCurveTo(cx, cy - r * 2.1, cx + r * 0.7, cy - r * 0.6)
    ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.4)'
    ctx.beginPath()
    ctx.ellipse(cx - r * 0.35, cy - r * 0.2, r * 0.18, r * 0.3, -0.5, 0, Math.PI * 2)
    ctx.fill()
  },
  llamas: (ctx, w, h) => {
    const colores = ['#d84315', '#f4901e', '#ffd54f']
    colores.forEach((color, i) => {
      const alto = h * (0.9 - i * 0.22)
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.moveTo(0, h)
      for (let k = 0; k <= 4; k++) {
        const x = (w * 0.55 * (k + 1)) / 5 - i * 12
        const punta = h - alto * (k % 2 === 0 ? 1 : 0.55)
        ctx.quadraticCurveTo(x - w * 0.05, h - alto * 0.2, x, punta)
        ctx.quadraticCurveTo(x + w * 0.03, h - alto * 0.15, x + w * 0.07, h)
      }
      ctx.closePath()
      ctx.fill()
    })
  },
  rayas: (ctx, w, h) => {
    ctx.save()
    ctx.transform(1, 0, -0.45, 1, h * 0.45, 0)
    const anchos = [w * 0.14, w * 0.07, w * 0.035]
    const colores = ['#c23b2e', '#20242b', '#c23b2e']
    let x = w * 0.55
    anchos.forEach((a, i) => {
      ctx.fillStyle = colores[i]
      ctx.fillRect(x, 0, a, h)
      x += a + w * 0.03
    })
    ctx.restore()
  },
  olas: (ctx, w, h) => {
    const franjas = [
      { color: '#1f6db2', base: h * 0.62, amp: h * 0.1 },
      { color: '#5fb6e8', base: h * 0.76, amp: h * 0.08 },
    ]
    for (const f of franjas) {
      ctx.fillStyle = f.color
      ctx.beginPath()
      ctx.moveTo(0, h)
      for (let x = 0; x <= w; x += 8) {
        ctx.lineTo(x, f.base + Math.sin((x / w) * Math.PI * 4) * f.amp)
      }
      ctx.lineTo(w, h)
      ctx.closePath()
      ctx.fill()
    }
  },
  estrellas: (ctx, w, h) => {
    ctx.fillStyle = '#e0b52e'
    const puntos: [number, number, number][] = [
      [0.12, 0.3, 0.16],
      [0.28, 0.7, 0.1],
      [0.5, 0.22, 0.12],
      [0.72, 0.68, 0.11],
      [0.88, 0.3, 0.15],
      [0.4, 0.5, 0.07],
    ]
    for (const [px, py, pr] of puntos) estrella(ctx, w * px, h * py, h * pr)
  },
}

/**
 * Pinta una placa completa: fondo ligado a la pintura del tanque, motivo de
 * calca detrás y rótulo encima, autoescalado al ancho.
 */
export function dibujarPlaca(
  ctx: Ctx,
  w: number,
  h: number,
  placa: { rotulo: string; calca: CalcaId | null; tanqueHex: string },
) {
  // Fondo: el color del tanque aclarado, como panel pintado aparte, con un
  // borde más oscuro que lo despega del cilindro.
  const fondo = mezclar(placa.tanqueHex, 0.35)
  ctx.fillStyle = fondo
  ctx.fillRect(0, 0, w, h)
  ctx.strokeStyle = mezclar(placa.tanqueHex, -0.25)
  ctx.lineWidth = 8
  ctx.strokeRect(0, 0, w, h)

  if (placa.calca) {
    ctx.save()
    ctx.globalAlpha = 0.85
    MOTIVOS[placa.calca](ctx, w, h)
    ctx.restore()
  }

  if (placa.rotulo) {
    const texto = placa.rotulo.toUpperCase()
    let size = h * 0.55
    ctx.font = `bold ${size}px system-ui, sans-serif`
    const ancho = ctx.measureText(texto).width
    size *= Math.min(1, (w - h * 0.4) / ancho)
    ctx.font = `bold ${size}px system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const oscuro = luminancia(fondo) > 0.45
    ctx.strokeStyle = oscuro ? 'rgba(255,255,255,0.85)' : 'rgba(20,22,27,0.85)'
    ctx.lineWidth = Math.max(2, size * 0.09)
    ctx.strokeText(texto, w / 2, h / 2)
    ctx.fillStyle = oscuro ? '#20242b' : '#f2f2f2'
    ctx.fillText(texto, w / 2, h / 2)
  }
}
