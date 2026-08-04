import { useEffect, useRef } from 'react'
import {
  footprints,
  MAP_SIZE,
  taller,
  WATER_SOURCE,
} from '../game/world/layout'
import { useGameStore } from '../state/gameStore'
import type { PerfilCliente } from '../game/systems/clients'

/*
 * Minimapa en DOM sobre el canvas 3D: un <canvas> 2D que se redibuja con
 * THROTTLE (5 veces por segundo), no cada frame — a 0.4 px por metro en
 * compacto, nada de lo que enseña se mueve tan rápido como para más.
 *
 * Muestra: tú (flecha con tu orientación; manejando, la flecha ES la pipa),
 * la pipa estacionada, el pozo y los PUNTOS DE ENTREGA de los pedidos
 * activos con el color de su perfil — adónde vas, no de dónde vienes.
 *
 * Un toque lo expande a pantalla (casi) completa; otro lo regresa.
 */

const REDRAW_MS = 200

/* Colores del tema (theme.css). En duro porque canvas no lee variables CSS
 * sin computar estilos; si el tema cambia, cambia aquí. */
const COLOR = {
  fondo: '#17171c',
  calle: '#4b4b52',
  pozo: '#37d0a7',
  taller: '#e0a33a',
  pipa: '#4da3ff',
  jugador: '#f2f2f2',
  perfil: {
    paciente: '#3ddc84',
    normal: '#ffb74d',
    exigente: '#ff5252',
  } satisfies Record<PerfilCliente, string>,
}

/** Yaw (atan2(x, z)) del frente de la pipa desde su cuaternión. */
function vehicleYaw(r: { x: number; y: number; z: number; w: number }) {
  return Math.atan2(2 * (r.x * r.z + r.w * r.y), 1 - 2 * (r.x * r.x + r.y * r.y))
}

function draw(el: HTMLCanvasElement) {
  const css = el.clientWidth
  if (css === 0) return
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  const W = Math.round(css * dpr)
  if (el.width !== W) {
    el.width = W
    el.height = W
  }
  const ctx = el.getContext('2d')
  if (!ctx) return

  const escala = W / MAP_SIZE
  /** Mundo → mapa. +x del mundo a la derecha, +z hacia abajo. */
  const M = (n: number) => (n + MAP_SIZE / 2) * escala

  /*
   * El dibujo va al revés que el trazo viejo: primero se rellena TODO de
   * color calle y encima se pintan las manzanas. En el trazo nuevo las calles
   * son el hueco que dejan las manzanas, así que pintarlas una por una ya no
   * tiene sentido — y de paso los callejones salen gratis, como las rendijas
   * que quedan entre dos manzanas.
   */
  ctx.fillStyle = COLOR.calle
  ctx.fillRect(0, 0, W, W)

  ctx.fillStyle = COLOR.fondo
  for (const f of footprints) {
    ctx.fillRect(
      M(f.pos[0]) - (f.size[0] * escala) / 2,
      M(f.pos[2]) - (f.size[2] * escala) / 2,
      f.size[0] * escala,
      f.size[2] * escala,
    )
  }

  const s = useGameStore.getState()
  const lado = Math.max(4, W * 0.03) // tamaño base de los marcadores

  // El pozo: cuadrito verde agua.
  ctx.fillStyle = COLOR.pozo
  ctx.fillRect(M(WATER_SOURCE.pos[0]) - lado / 2, M(WATER_SOURCE.pos[2]) - lado / 2, lado, lado)

  /*
   * El taller: casita ámbar sobre su PORTÓN, que es donde hay que dejar la
   * pipa, no sobre el centro de la nave. Va con forma propia y no solo con
   * color propio: a este tamaño, dos cuadritos de distinto color se
   * confunden de reojo, y un techo no se confunde con nada.
   */
  const tx = M(taller.door[0])
  const tz = M(taller.door[2])
  const t = lado * 0.75
  ctx.fillStyle = COLOR.taller
  ctx.beginPath()
  ctx.moveTo(tx, tz - t)
  ctx.lineTo(tx + t, tz)
  ctx.lineTo(tx + t * 0.55, tz)
  ctx.lineTo(tx + t * 0.55, tz + t * 0.8)
  ctx.lineTo(tx - t * 0.55, tz + t * 0.8)
  ctx.lineTo(tx - t * 0.55, tz)
  ctx.lineTo(tx - t, tz)
  ctx.closePath()
  ctx.fill()

  // Pedidos activos: punto del color del perfil en el PUNTO DE ENTREGA.
  for (const o of s.economy.orders) {
    ctx.fillStyle = COLOR.perfil[o.perfil]
    ctx.beginPath()
    ctx.arc(M(o.delivery[0]), M(o.delivery[2]), lado * 0.55, 0, Math.PI * 2)
    ctx.fill()
  }

  const driving = s.mode === 'DRIVING'

  // La pipa estacionada (a pie): rectangulito orientado.
  if (!driving) {
    ctx.save()
    ctx.translate(M(s.vehicle.pos.x), M(s.vehicle.pos.z))
    ctx.rotate(Math.PI - vehicleYaw(s.vehicle.rot))
    ctx.fillStyle = COLOR.pipa
    ctx.fillRect(-lado * 0.4, -lado * 0.7, lado * 0.8, lado * 1.4)
    ctx.restore()
  }

  // Tú: flecha con tu orientación. Manejando, la flecha es la pipa.
  const pos = driving ? s.vehicle.pos : s.player.pos
  const yaw = driving ? vehicleYaw(s.vehicle.rot) : s.player.yaw
  ctx.save()
  ctx.translate(M(pos.x), M(pos.z))
  // π − yaw: yaw 0 mira a +z del mundo, que en el mapa es hacia abajo.
  ctx.rotate(Math.PI - yaw)
  ctx.fillStyle = driving ? COLOR.pipa : COLOR.jugador
  const f = lado * (driving ? 1.1 : 0.9)
  ctx.beginPath()
  ctx.moveTo(0, -f)
  ctx.lineTo(f * 0.7, f * 0.8)
  ctx.lineTo(0, f * 0.4)
  ctx.lineTo(-f * 0.7, f * 0.8)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

export function Minimap() {
  // En el store y no en useState: App oculta los controles de manejo
  // mientras el mapa está expandido.
  const expanded = useGameStore((s) => s.minimapExpanded)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const tick = () => {
      if (canvasRef.current) draw(canvasRef.current)
    }
    // Redibuja ya (el cambio de tamaño no debe esperar al throttle)…
    tick()
    // …y de ahí en adelante, al paso del throttle.
    const id = setInterval(tick, REDRAW_MS)
    return () => clearInterval(id)
  }, [expanded])

  const setExpanded = (on: boolean) =>
    useGameStore.getState().setMinimapExpanded(on)

  return (
    <>
      {expanded && (
        <div
          className="minimap-backdrop"
          onPointerDown={() => setExpanded(false)}
        />
      )}
      <div
        className={`minimap${expanded ? ' expanded' : ''}`}
        onPointerDown={() => setExpanded(!expanded)}
      >
        <canvas ref={canvasRef} className="minimap-canvas" />
      </div>
    </>
  )
}
