/*
 * La aritmética de la volcadura, pura y sin three: el sistema (Volcadura.tsx)
 * la aplica y los tests la miden sola, igual que economy.ts o garage.ts.
 */

import { balance, type Balance } from '../balance'

type Quat = { x: number; y: number; z: number; w: number }

/**
 * Componente Y del vector «arriba» de la pipa: 1 derecha, ~0 de costado,
 * −1 de cabeza. Es (0,1,0) rotado por el cuaternión, sin construir vectores:
 * la columna Y de la matriz de rotación.
 */
export function upY(r: Quat): number {
  return 1 - 2 * (r.x * r.x + r.z * r.z)
}

/** ¿Está volcada? Umbral en tuning.vuelco.upY. */
export function estaVolcada(r: Quat, umbral: number): boolean {
  return upY(r) < umbral
}

/**
 * Litros que se derraman al enderezar: fracción de lo que traías,
 * interpolada entre derrameMin y derrameMax según lo brusco del golpe
 * (velocidad al empezar a volcarse contra el tope de la pipa). Hasta la
 * volcadura más mansa tira algo — el agua de arriba se sale sola.
 */
export function derrameVolcadura(
  litros: number,
  golpe: number,
  velTope: number,
  b: Balance = balance,
): number {
  const { derrameMin, derrameMax } = b.rescate.volcadura
  const factor = velTope > 0 ? Math.min(1, Math.max(0, golpe / velTope)) : 1
  return litros * (derrameMin + (derrameMax - derrameMin) * factor)
}
