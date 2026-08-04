import { BufferGeometry, Color, Float32BufferAttribute } from 'three'
import { useGameStore } from '../../state/gameStore'
import {
  buildings,
  groundSlab,
  hitos,
  locales,
  sidewalks,
  taller,
  topes,
  kiosco,
  waterParts,
  worldColliderCylinders,
  type Box,
} from './layout'

/*
 * El visor de colliders: las aristas de TODOS los colliders estáticos del
 * mundo, en un solo LineSegments con color por tipo. Se prende desde leva
 * (carpeta «debug») para ver desde el teléfono dónde la física no coincide
 * con lo visible.
 *
 * Barato a propósito: la geometría se construye UNA vez, perezosa, la
 * primera vez que se enciende (~40k vértices) y de ahí es +1 draw call
 * mientras esté activo y cero trabajo por frame. Vive como singleton de
 * módulo: es una herramienta, no estado de juego.
 *
 * Para los colliders DINÁMICOS (la pipa, las ruedas) está el otro toggle,
 * «física (rapier)», que usa el debugRender del motor — ese sí reconstruye
 * geometría cada frame y es de escritorio, no de teléfono.
 */

// Las 12 aristas del cubo unitario, como pares de esquinas.
const C = 0.5
const ESQUINAS: [number, number, number][] = [
  [-C, -C, -C], [C, -C, -C], [C, -C, C], [-C, -C, C],
  [-C, C, -C], [C, C, -C], [C, C, C], [-C, C, C],
]
const ARISTAS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 0], // base
  [4, 5], [5, 6], [6, 7], [7, 4], // tapa
  [0, 4], [1, 5], [2, 6], [3, 7], // verticales
]

const _c = new Color()

let geometria: BufferGeometry | null = null

function construir(): BufferGeometry {
  const positions: number[] = []
  const colors: number[] = []

  const caja = (b: Box, hex: string) => {
    _c.set(hex)
    const rot = b.rotY ?? 0
    const cos = Math.cos(rot)
    const sin = Math.sin(rot)
    for (const [i, j] of ARISTAS) {
      for (const k of [i, j]) {
        const [lx, ly, lz] = ESQUINAS[k]
        const x = lx * b.size[0]
        const y = ly * b.size[1]
        const z = lz * b.size[2]
        positions.push(
          b.pos[0] + x * cos + z * sin,
          b.pos[1] + y,
          b.pos[2] - x * sin + z * cos,
        )
        colors.push(_c.r, _c.g, _c.b)
      }
    }
  }

  const cilindro = (
    pos: [number, number, number],
    radio: number,
    alto: number,
    hex: string,
  ) => {
    _c.set(hex)
    const segs = 32
    for (const y of [pos[1] - alto / 2, pos[1] + alto / 2]) {
      for (let s = 0; s < segs; s++) {
        for (const a of [(s / segs) * Math.PI * 2, ((s + 1) / segs) * Math.PI * 2]) {
          positions.push(pos[0] + radio * Math.cos(a), y, pos[2] + radio * Math.sin(a))
          colors.push(_c.r, _c.g, _c.b)
        }
      }
    }
    for (let s = 0; s < 8; s++) {
      const a = (s / 8) * Math.PI * 2
      for (const y of [pos[1] - alto / 2, pos[1] + alto / 2]) {
        positions.push(pos[0] + radio * Math.cos(a), y, pos[2] + radio * Math.sin(a))
        colors.push(_c.r, _c.g, _c.b)
      }
    }
  }

  // Mismo inventario que worldColliderBoxes, con color por tipo.
  caja(groundSlab, '#44464f')
  for (const b of sidewalks) caja(b, '#3ddc84')
  for (const b of buildings) caja(b, '#8d93a8')
  for (const l of locales) caja({ pos: l.pos, size: l.size }, '#4d8fe0')
  for (const h of hitos) caja({ pos: h.pos, size: h.size }, '#b06fd6')
  caja({ pos: taller.pos, size: taller.size }, '#e0a33a')
  caja({ pos: taller.letrero.pos, size: taller.letrero.size }, '#e0a33a')
  for (const t of topes) caja(t, '#ffd54f')
  caja(kiosco, '#37d0a7')
  caja(waterParts.base, '#37d0a7')
  caja(waterParts.valve, '#37d0a7')
  for (const c of worldColliderCylinders) cilindro(c.pos, c.radius, c.height, '#8fd08f')

  const geo = new BufferGeometry()
  geo.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geo.setAttribute('color', new Float32BufferAttribute(colors, 3))
  return geo
}

/** Perezosa y de una sola vez: nadie paga el visor hasta encenderlo. */
function obtenerGeometria(): BufferGeometry {
  if (!geometria) geometria = construir()
  return geometria
}

export function ColliderDebugView() {
  const activo = useGameStore((s) => s.debug.colliders)
  if (!activo) return null
  return (
    <lineSegments geometry={obtenerGeometria()}>
      <lineBasicMaterial vertexColors depthTest={false} transparent opacity={0.85} />
    </lineSegments>
  )
}
